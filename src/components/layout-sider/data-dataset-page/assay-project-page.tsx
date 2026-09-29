import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Pagination, Popconfirm, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  deleteAssayApi,
  listAssayByProjectApi,
  listFileByAssayApi,
} from "@/api/data";
import type { AssayItem, DataFileItem, DatasetItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface AssayProjectPageProps {
  /** Optional client-side filters; the list is already scoped to the active project. */
  id?: string;
  sample_name?: string;
  assay_type?: string;
  role?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (assay: AssayItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePageSize = (value?: number | string) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 10;
};

/** Assay label: sample_name -> library_id -> assay_type -> PK. */
const assayLabel = (record: AssayItem) =>
  record.sample_name || record.library_id || record.assay_type || record.id;

const assayMeta = (record: AssayItem) =>
  [record.assay_type, record.platform, record.library_id, record.dataset_name]
    .filter(Boolean)
    .join(" · ");

/** File label: file_name -> file_id -> primary key. */
const fileLabel = (record: DataFileItem) =>
  record.file_name || record.file_id || `File-${record.id}`;

const fileMeta = (record: DataFileItem) =>
  [record.format, record.file_key].filter(Boolean).join(" · ");

/**
 * Dataset -> Assay -> File data page.
 *
 * A dataset binds directly to an Assay through go_dataset_assay, so the project's
 * assays are the entry point (go_project_dataset -> go_dataset_assay -> go_assay).
 * Expanding an assay lazily loads its files (go_file.assay_id owns the assay ->
 * file relation).
 *
 * The assay itself carries its biological sample name (go_assay.sample_name), so
 * there is no separate Sample entity. CRUD is delegated to the existing drawers:
 * `editAssayPage` (which also writes the DatasetAssay binding on create) and
 * `editAssayFilePage` / `assayFileListPage` for the files of one assay.
 */
const AssayProjectPage = ({
  id,
  sample_name,
  assay_type,
  role,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: AssayProjectPageProps) => {
  const message = useGlobalMessage();

  const [assays, setAssays] = useState<AssayItem[]>([]);
  const [filesByAssay, setFilesByAssay] = useState<Record<string, DataFileItem[]>>({});
  const [filesLoading, setFilesLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedAssays, setExpandedAssays] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => normalizePageSize(page_size));

  const selectable = Boolean(onOk || onCancel);

  // The list is scoped to the current user's active project by the backend.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAssayByProjectApi();
      setAssays((response.data ?? []) as AssayItem[]);
      setFailed(false);
    } catch {
      // already reported by the global interceptor
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Files are owned by an assay and loaded lazily the first time it expands.
  const loadFiles = useCallback(async (assayId: string) => {
    setFilesLoading((map) => ({ ...map, [assayId]: true }));
    try {
      const response = await listFileByAssayApi(assayId);
      setFilesByAssay((map) => ({ ...map, [assayId]: (response.data ?? []) as DataFileItem[] }));
    } catch {
      // already reported by the global interceptor
    } finally {
      setFilesLoading((map) => ({ ...map, [assayId]: false }));
    }
  }, []);

  const filteredAssays = useMemo(() => {
    const idFilter = normalizeText(id);
    const nameFilter = normalizeText(sample_name)?.toLowerCase();
    const typeFilter = normalizeText(assay_type)?.toLowerCase();
    const roleFilter = normalizeText(role)?.toLowerCase();

    return assays.filter((assay) => {
      if (idFilter && String(assay.id) !== idFilter) return false;
      if (nameFilter && !(assay.sample_name ?? "").toLowerCase().includes(nameFilter)) {
        return false;
      }
      if (typeFilter && !(assay.assay_type ?? "").toLowerCase().includes(typeFilter)) {
        return false;
      }
      if (roleFilter && !(assay.role ?? "").toLowerCase().includes(roleFilter)) {
        return false;
      }
      return true;
    });
  }, [assays, id, sample_name, assay_type, role]);

  const pagedAssays = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssays.slice(start, start + pageSize);
  }, [filteredAssays, page, pageSize]);

  const selectedItem = useMemo(
    () => assays.find((item) => item.id === selectedId),
    [assays, selectedId]
  );

  // ---- CRUD ---------------------------------------------------------------

  const handleImport = async () => {
    try {
      await invoke.importAssayTsvPage.openDrawerAsync({}, { width: 760, title: "Import TSV" });
      await load();
    } catch {
      // user cancelled
    }
  };

  const handleCreateAssay = async () => {
    try {
      // An assay joins a project through go_dataset_assay, so pick the owning
      // dataset first; editAssayPage writes the binding after creating the assay.
      const dataset = await invoke.datasetProjectPage.openDrawerAsync(
        {},
        { width: 900, title: "Select Dataset" }
      );
      if (!dataset?.id) {
        return;
      }

      await invoke.editAssayPage.openDrawerAsync(
        { dataset: dataset as DatasetItem },
        { width: 560, title: `New Assay: ${dataset.dataset_name || dataset.id}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  const handleEditAssay = async (assay: AssayItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { assay },
        { width: 560, title: `Edit Assay: ${assayLabel(assay)}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  // Deleting an assay also removes the files it owns and its dataset bindings.
  const handleDeleteAssay = async (assay: AssayItem) => {
    try {
      await deleteAssayApi({ id: assay.id });
      message.success("Assay deleted successfully");
      if (selectedId === assay.id) {
        setSelectedId(undefined);
      }
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Assay files --------------------------------------------------------

  const handleOpenFiles = (assay: AssayItem) => {
    // Fire-and-forget: the file list drawer is a list, not a form, so it does not
    // resolve openDrawerAsync. Files are refreshed the next time the assay expands.
    invoke.assayFileListPage.drawer(
      { assay_id: assay.id, assay_label: assayLabel(assay) },
      { width: 880, title: `Assay Files: ${assayLabel(assay)}` }
    );
  };

  const handleAddFile = async (assay: AssayItem) => {
    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id: assay.id, assay_label: assayLabel(assay) },
        { width: 520, title: `Add File: ${assayLabel(assay)}` }
      );
    } catch {
      // user cancelled
    }
    await loadFiles(assay.id);
  };

  // ---- Render -------------------------------------------------------------

  const renderFiles = (assay: AssayItem) => {
    const rows = filesByAssay[assay.id] ?? [];
    const isLoading = Boolean(filesLoading[assay.id]);

    return (
      <div style={{ padding: "2px 0 8px 44px" }}>
        <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isLoading ? "Loading files..." : rows.length === 0 ? "No files" : `${rows.length} file(s)`}
          </Text>
          <Flex gap="small">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<FileAddOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleAddFile(assay);
              }}
            >
              Add File
            </Button>
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleOpenFiles(assay);
              }}
            >
              Manage
            </Button>
          </Flex>
        </Flex>

        {rows.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This assay has no file yet.
          </Text>
        ) : (
          <Flex vertical gap={2}>
            {rows.map((file) => (
              <Flex key={file.id} align="center" gap={6}>
                <FileOutlined className="project-report-item-icon" />
                <Tooltip title={file.path || fileLabel(file)}>
                  <span className="project-report-item-title" style={{ flex: 1, minWidth: 0 }}>
                    {fileLabel(file)}
                  </span>
                </Tooltip>
                <Text type="secondary" ellipsis style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                  {fileMeta(file) || "-"}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </div>
    );
  };

  const assayColumns: ColumnsType<AssayItem> = [
    {
      key: "assay",
      render: (_value: unknown, record) => {
        const label = assayLabel(record);
        const meta = assayMeta(record);
        return (
          <div className="project-report-item">
            <ExperimentOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <Tooltip placement="topLeft" title={label}>
                <span className="project-report-item-title">{label}</span>
              </Tooltip>
              {meta && (
                <span className="project-report-item-meta" title={meta}>
                  {meta}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      align: "right",
      render: (_value: unknown, record) => (
        <span
          className="project-report-item-actions project-report-item-actions-static"
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip title="Add File">
            <Button
              type="text"
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => void handleAddFile(record)}
            />
          </Tooltip>
          <Tooltip title="Manage Files">
            <Button
              type="text"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => void handleOpenFiles(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Assay">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => void handleEditAssay(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this assay?"
            description="Its files are deleted too."
            onConfirm={() => void handleDeleteAssay(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const handleConfirm = () => {
    if (!selectedItem || !onOk) {
      return;
    }
    onOk(selectedItem);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Assays"}</span>
        <div className="project-report-panel-actions">
          <Tooltip title="Import TSV">
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              onClick={() => void handleImport()}
            />
          </Tooltip>
          <Tooltip title="New Assay">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => void handleCreateAssay()}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void load()} />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body">
        {pagedAssays.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={failed ? "Failed to load assays" : "No assays"}
          />
        ) : (
          <Table<AssayItem>
            rowKey="id"
            size="small"
            columns={assayColumns}
            dataSource={pagedAssays}
            loading={loading}
            pagination={false}
            showHeader={selectable}
            expandable={{
              expandedRowKeys: expandedAssays,
              onExpandedRowsChange: (keys) => {
                const next = keys.map(String);
                setExpandedAssays(next);
                // Refresh files for every expanded assay so the inline list
                // reflects changes made through the Manage drawer.
                for (const key of next) {
                  void loadFiles(key);
                }
              },
              expandedRowRender: renderFiles,
            }}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            rowSelection={
              selectable
                ? {
                    type: "radio",
                    selectedRowKeys: selectedId ? [selectedId] : [],
                    onChange: (selectedRowKeys) => {
                      setSelectedId(String(selectedRowKeys[0] || ""));
                    },
                  }
                : undefined
            }
            onRow={(record) => ({
              onClick: () => {
                if (selectable) {
                  setSelectedId(record.id);
                  return;
                }
                setExpandedAssays((keys) =>
                  keys.includes(record.id)
                    ? keys.filter((key) => key !== record.id)
                    : [...keys, record.id]
                );
              },
            })}
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={filteredAssays.length}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            onChange={(nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
              }
              setPage(nextPage);
            }}
            showTotal={(value) => `Total ${value}`}
          />
          {selectable && (
            <Flex gap="small">
              <Button size="small" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="small" type="primary" disabled={!selectedItem} onClick={handleConfirm}>
                Confirm
              </Button>
            </Flex>
          )}
        </Flex>
      </div>
    </div>
  );
};

export default AssayProjectPage;

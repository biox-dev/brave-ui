import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Pagination, Popconfirm, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  deleteAssayApi,
  deleteSampleApi,
  listAssayByProjectApi,
  listSampleByProjectApi,
} from "@/api/data";
import type { AssayItem, SampleWithDatasetItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface SampleAssayProjectPageProps {
  /** Optional client-side filters; the list itself is already scoped to the active project. */
  id?: string;
  sample_key?: string;
  sample_name?: string;
  subject_id?: string;
  tissue?: string;
  cell_type?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (sample: SampleWithDatasetItem) => void;
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

/** Sample label: display name -> business key -> primary key. */
const sampleLabel = (record: SampleWithDatasetItem) =>
  record.sample_name || record.sample_key || `Sample-${record.id}`;

/** Assay has no name column, so the label derives from library_id -> assay_type -> PK. */
const assayLabel = (record: AssayItem) => record.library_id || record.assay_type || record.id;

const assayMeta = (record: AssayItem) =>
  [record.assay_type, record.platform, record.library_id].filter(Boolean).join(" · ");

/**
 * Sample -> Assay -> File data page.
 *
 * A project's samples are resolved through `go_dataset_sample` — the only
 * project binding left now that DatasetAssay is gone: an assay belongs to a
 * sample, and the sample is what is bound to a dataset. That is why the dataset
 * is read from the sample row and why only DatasetSample carries `dataset_id`.
 *
 * Expanding a sample reveals its assays (grouped client-side from the project's
 * assay list); each assay owns its files through `go_file.assay_id`, so files
 * are added/edited/removed from the assay row actions.
 *
 * CRUD is delegated to the existing drawers: `editSamplePage` (which also
 * writes the DatasetSample binding), `editAssayPage` (sample-scoped, no
 * dataset), and `editAssayFilePage` / `assayFileListPage` for the files of one
 * assay.
 */
const SampleAssayProjectPage = ({
  id,
  sample_key,
  sample_name,
  subject_id,
  tissue,
  cell_type,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: SampleAssayProjectPageProps) => {
  const message = useGlobalMessage();

  const [samples, setSamples] = useState<SampleWithDatasetItem[]>([]);
  const [assays, setAssays] = useState<AssayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => normalizePageSize(page_size));

  const selectable = Boolean(onOk || onCancel);

  // Both lists are scoped to the current user's active project by the backend,
  // so one round trip is enough and the assays are grouped per sample here.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sampleResponse, assayResponse] = await Promise.all([
        listSampleByProjectApi(),
        listAssayByProjectApi(),
      ]);
      setSamples((sampleResponse.data ?? []) as SampleWithDatasetItem[]);
      setAssays((assayResponse.data ?? []) as AssayItem[]);
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

  const assaysBySample = useMemo(() => {
    const grouped = new Map<string, AssayItem[]>();
    for (const assay of assays) {
      const key = String(assay.sample_id ?? "");
      const list = grouped.get(key);
      if (list) {
        list.push(assay);
      } else {
        grouped.set(key, [assay]);
      }
    }
    return grouped;
  }, [assays]);

  const filteredSamples = useMemo(() => {
    const idFilter = normalizeText(id);
    const keyFilter = normalizeText(sample_key)?.toLowerCase();
    const nameFilter = normalizeText(sample_name)?.toLowerCase();
    const subjectFilter = normalizeText(subject_id);
    const tissueFilter = normalizeText(tissue)?.toLowerCase();
    const cellTypeFilter = normalizeText(cell_type)?.toLowerCase();

    return samples.filter((sample) => {
      if (idFilter && String(sample.id) !== idFilter) return false;
      if (subjectFilter && String(sample.subject_id) !== subjectFilter) return false;
      if (keyFilter && !(sample.sample_key ?? "").toLowerCase().includes(keyFilter)) return false;
      if (nameFilter && !(sample.sample_name ?? "").toLowerCase().includes(nameFilter)) return false;
      if (tissueFilter && !(sample.tissue ?? "").toLowerCase().includes(tissueFilter)) return false;
      if (cellTypeFilter && !(sample.cell_type ?? "").toLowerCase().includes(cellTypeFilter)) {
        return false;
      }
      return true;
    });
  }, [samples, id, sample_key, sample_name, subject_id, tissue, cell_type]);

  const pagedSamples = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSamples.slice(start, start + pageSize);
  }, [filteredSamples, page, pageSize]);

  const selectedItem = useMemo(
    () => samples.find((item) => item.id === selectedId),
    [samples, selectedId]
  );

  const toggleExpanded = (sampleId: string) => {
    setExpandedKeys((keys) =>
      keys.includes(sampleId) ? keys.filter((key) => key !== sampleId) : [...keys, sampleId]
    );
  };

  // ---- Sample CRUD --------------------------------------------------------

  const handleCreateSample = async () => {
    try {
      // The form also writes the DatasetSample binding, which is what makes the
      // sample belong to the active project.
      await invoke.editSamplePage.openDrawerAsync({}, { width: 560, title: "New Sample" });
      await load();
    } catch {
      // user cancelled
    }
  };

  const handleEditSample = async (record: SampleWithDatasetItem) => {
    try {
      await invoke.editSamplePage.openDrawerAsync(
        { sample: record },
        { width: 560, title: `Edit Sample: ${sampleLabel(record)}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  // The backend refuses (409) while the sample still owns assays.
  const handleDeleteSample = async (record: SampleWithDatasetItem) => {
    try {
      await deleteSampleApi({ id: record.id });
      message.success("Sample deleted successfully");
      if (selectedId === record.id) {
        setSelectedId(undefined);
      }
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Assay CRUD ---------------------------------------------------------

  const handleCreateAssay = async (sample: SampleWithDatasetItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { sample },
        { width: 560, title: `New Assay: ${sampleLabel(sample)}` }
      );
      await load();
      setExpandedKeys((keys) => (keys.includes(sample.id) ? keys : [...keys, sample.id]));
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

  // Deleting an assay also removes the files it owns.
  const handleDeleteAssay = async (assay: AssayItem) => {
    try {
      await deleteAssayApi({ id: assay.id });
      message.success("Assay deleted successfully");
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Assay files --------------------------------------------------------

  const handleOpenFiles = (assay: AssayItem) => {
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
  };

  // ---- Render -------------------------------------------------------------

  const renderAssays = (sample: SampleWithDatasetItem) => {
    const rows = assaysBySample.get(String(sample.id)) ?? [];

    return (
      <div style={{ padding: "2px 0 8px 26px" }}>
        <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {rows.length === 0 ? "No assays" : `${rows.length} assay(s)`}
          </Text>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              void handleCreateAssay(sample);
            }}
          >
            Add Assay
          </Button>
        </Flex>

        {rows.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This sample has no assay yet.
          </Text>
        ) : (
          <Flex vertical gap={2}>
            {rows.map((assay) => (
              <Flex key={assay.id} align="center" gap={6}>
                <ExperimentOutlined className="project-report-item-icon" />
                <Tooltip title={[assayLabel(assay), assayMeta(assay)].filter(Boolean).join(" · ")}>
                  <span className="project-report-item-title" style={{ flex: 1, minWidth: 0 }}>
                    {assayLabel(assay)}
                  </span>
                </Tooltip>
                <Text type="secondary" ellipsis style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                  {assayMeta(assay) || "-"}
                </Text>
                <span
                  className="project-report-item-actions project-report-item-actions-static"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Tooltip title="Owned Files">
                    <Button
                      type="text"
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={() => handleOpenFiles(assay)}
                    />
                  </Tooltip>
                  <Tooltip title="Add File">
                    <Button
                      type="text"
                      size="small"
                      icon={<FileAddOutlined />}
                      onClick={() => void handleAddFile(assay)}
                    />
                  </Tooltip>
                  <Tooltip title="Edit Assay">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => void handleEditAssay(assay)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Delete this assay?"
                    description="Its files are deleted too."
                    onConfirm={() => void handleDeleteAssay(assay)}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </span>
              </Flex>
            ))}
          </Flex>
        )}
      </div>
    );
  };

  const actionsColumn: ColumnsType<SampleWithDatasetItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 120,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Add Assay">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => void handleCreateAssay(record)}
          />
        </Tooltip>
        <Tooltip title="Edit Sample">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => void handleEditSample(record)}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this sample?"
          description="Samples that still own assays cannot be deleted."
          onConfirm={() => void handleDeleteSample(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const columns: ColumnsType<SampleWithDatasetItem> = [
    {
      title: "Sample",
      dataIndex: "sample_name",
      key: "sample_name",
      ellipsis: { showTitle: false },
      render: (_value: string, record) => {
        const label = sampleLabel(record);
        const meta = [record.subject_name, record.species, record.tissue, record.dataset_name]
          .filter(Boolean)
          .join(" · ");

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
    actionsColumn,
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
        <span className="project-report-panel-title">{title || "Samples"}</span>
        <div className="project-report-panel-actions">
          <Tooltip title="New Sample">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => void handleCreateSample()}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void load()}
            />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body">
        {pagedSamples.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={failed ? "Failed to load samples" : "No samples"}
          />
        ) : (
          <Table<SampleWithDatasetItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={pagedSamples}
            loading={loading}
            pagination={false}
            showHeader={selectable}
            expandable={{
              expandedRowKeys: expandedKeys,
              onExpandedRowsChange: (keys) => setExpandedKeys(keys.map(String)),
              expandedRowRender: renderAssays,
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
                toggleExpanded(String(record.id));
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
            total={filteredSamples.length}
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

export default SampleAssayProjectPage;

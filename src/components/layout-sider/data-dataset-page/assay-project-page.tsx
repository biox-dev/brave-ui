import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Pagination, Popconfirm, Table, Tag, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAssayProjectPageQuery } from "@/hooks/usePaginationV2";
import { deleteAssayApi, deleteFileApi, listFileByAssayApi } from "@/api/data";
import type { AssayItem, DataFileItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useSelector } from "react-redux";

export interface AssayProjectPageProps {
  project_id?: string;
  id?: string;
  sample_id?: string;
  assay_type?: string;
  platform?: string;
  library_id?: string;
  metadata?: string;
  dataset_id?: string;
  dataset_name?: string;
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

// Assay 没有独立 name 列，展示名按 library_id → assay_type → 主键推导（与后端 assayDisplayName 一致）。
const assayLabel = (record: AssayItem) =>
  record.library_id || record.assay_type || record.id;

const formatBytes = (size?: number) => {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

// Files owned by one assay (go_file.assay_id). A file is assay-private: it is
// created for this assay and carries the role an analysis form input matches
// against its accept formats.
const assayFileColumns = (
  onEdit: (record: DataFileItem) => void,
  onDelete: (record: DataFileItem) => void
): ColumnsType<DataFileItem> => [
  {
    title: "File",
    dataIndex: "file_name",
    key: "file_name",
    ellipsis: { showTitle: false },
    render: (name: string, record) => {
      const label = name || record.file_id || `File-${record.id}`;

      return (
        <div className="project-report-item">
          <FileOutlined className="project-report-item-icon" />
          <div className="project-report-item-text">
            <Tooltip placement="topLeft" title={label}>
              <span className="project-report-item-title">{label}</span>
            </Tooltip>
            {record.path && (
              <span className="project-report-item-meta" title={record.path}>
                {record.path}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    width: 130,
    render: (value: string) => (value ? <Tag color="geekblue">{value}</Tag> : "-"),
  },
  {
    title: "Format",
    dataIndex: "format",
    key: "format",
    width: 100,
    render: (value: string) => value || "-",
  },
  {
    title: "Size",
    dataIndex: "size",
    key: "size",
    width: 100,
    render: (value: number) => formatBytes(value),
  },
  {
    title: "Actions",
    key: "actions",
    width: 80,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} />
        </Tooltip>
        <Popconfirm
          title="Remove this file?"
          description="The file is deleted from the assay."
          onConfirm={() => onDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  },
];

const listColumns: ColumnsType<AssayItem> = [
  {
    title: "Assay",
    dataIndex: "library_id",
    key: "library_id",
    render: (_value: string, record) => (
      <div className="project-report-item">
        <ExperimentOutlined className="project-report-item-icon" />
        <div className="project-report-item-text">
          <span className="project-report-item-title">{assayLabel(record)}</span>
          {[record.assay_type, record.dataset_name].filter(Boolean).length > 0 && (
            <span className="project-report-item-meta">
              {[record.assay_type, record.dataset_name].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    title: "Sample",
    dataIndex: "sample_name",
    key: "sample_name",
    width: 160,
    ellipsis: true,
    render: (value: string, record) => value || record.sample_id || "-",
  },
  {
    title: "Subject",
    dataIndex: "subject_name",
    key: "subject_name",
    width: 150,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Platform",
    dataIndex: "platform",
    key: "platform",
    width: 110,
    render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : "-"),
  },
];

const detailColumns: ColumnsType<AssayItem> = [
  {
    title: "Assay",
    dataIndex: "library_id",
    key: "library_id",
    ellipsis: true,
    render: (_value: string, record) => assayLabel(record),
  },
  {
    title: "Assay Type",
    dataIndex: "assay_type",
    key: "assay_type",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Platform",
    dataIndex: "platform",
    key: "platform",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Sample ID",
    dataIndex: "sample_id",
    key: "sample_id",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Sample Name",
    dataIndex: "sample_name",
    key: "sample_name",
    width: 160,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Subject",
    dataIndex: "subject_name",
    key: "subject_name",
    width: 150,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Dataset",
    dataIndex: "dataset_name",
    key: "dataset_name",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

const AssayProjectPage = ({
  id,
  sample_id,
  assay_type,
  platform,
  library_id,
  metadata,
  dataset_id,
  dataset_name,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: AssayProjectPageProps) => {
  const [selectedId, setSelectedID] = useState<string>();

  const selectable = Boolean(onOk || onCancel);
  const { projectId } = useSelector((state: any) => state.user);

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    setQuery,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAssayProjectPageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
      scopeKey: projectId,
    }
  );

  useEffect(() => {
    setQuery({
      id: normalizeText(id),
      sample_id: normalizeText(sample_id),
      assay_type: normalizeText(assay_type),
      platform: normalizeText(platform),
      library_id: normalizeText(library_id),
      metadata: normalizeText(metadata),
      dataset_id: normalizeText(dataset_id),
      dataset_name: normalizeText(dataset_name),
    });
  }, [id, sample_id, assay_type, platform, library_id, metadata, dataset_id, dataset_name, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const message = useGlobalMessage();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [filesByAssay, setFilesByAssay] = useState<Record<string, DataFileItem[]>>({});
  const [filesLoading, setFilesLoading] = useState<Record<string, boolean>>({});

  const loadAssayFiles = useCallback(async (assayId: string) => {
    setFilesLoading((prev) => ({ ...prev, [assayId]: true }));
    try {
      const response = await listFileByAssayApi(assayId);
      const files = (response.data ?? []) as DataFileItem[];
      setFilesByAssay((prev) => ({ ...prev, [assayId]: files }));
    } catch {
      // already reported by the global interceptor; keep the previous rows
    } finally {
      setFilesLoading((prev) => ({ ...prev, [assayId]: false }));
    }
  }, []);

  const handleToggleExpand = (expanded: boolean, record: AssayItem) => {
    setExpandedKeys((prev) =>
      expanded ? [...new Set([...prev, record.id])] : prev.filter((key) => key !== record.id)
    );
    if (expanded) {
      void loadAssayFiles(record.id);
    }
  };

  const handleAddFile = async (record: AssayItem) => {
    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id: record.id, assay_label: assayLabel(record) },
        { width: 520, title: `Add File: ${assayLabel(record)}` }
      );
      await loadAssayFiles(record.id);
    } catch {
      // user cancelled
    }
  };

  const handleEditFile = async (record: AssayItem, file: DataFileItem) => {
    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id: record.id, assay_label: assayLabel(record), file },
        { width: 520, title: `Edit File: ${file.file_name || file.file_id || file.id}` }
      );
      await loadAssayFiles(record.id);
    } catch {
      // user cancelled
    }
  };

  const handleDeleteFile = async (record: AssayItem, file: DataFileItem) => {
    try {
      await deleteFileApi({ id: file.id });
      message.success("File deleted successfully");
      await loadAssayFiles(record.id);
    } catch {
      // already reported by the global interceptor
    }
  };

  const expandable: TableProps<AssayItem>["expandable"] = {
    expandedRowKeys: expandedKeys,
    onExpand: handleToggleExpand,
    expandedRowRender: (record: AssayItem) => {
      const files = filesByAssay[record.id] ?? [];

      return (
        <div style={{ padding: "4px 8px" }}>
          <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 6 }}>
            <span className="project-report-item-meta">
              {files.length === 0
                ? "No files owned by this assay"
                : `${files.length} file(s) owned by this assay`}
            </span>
            <Flex gap="small">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<FileAddOutlined />}
                onClick={() => handleAddFile(record)}
              >
                Add File
              </Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => loadAssayFiles(record.id)}
              />
            </Flex>
          </Flex>
          <Table<DataFileItem>
            rowKey="id"
            size="small"
            columns={assayFileColumns(
              (file) => void handleEditFile(record, file),
              (file) => void handleDeleteFile(record, file)
            )}
            dataSource={files}
            loading={Boolean(filesLoading[record.id])}
            pagination={false}
            locale={{ emptyText: "No files" }}
          />
        </div>
      );
    },
  };

  // Creating an assay always goes through the dataset-first form: pick a
  // dataset, then select/create the sample (and its subject). Files are added
  // per assay from the row actions ("Add File") or from the expanded panel.
  const handleCreate = async () => {
    try {
      await invoke.editAssayPage.openDrawerAsync({}, { width: 640, title: "New Assay" });
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: AssayItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { assay: record },
        { width: 640, title: `Edit Assay: ${assayLabel(record)}` }
      );
      refetch();
    } catch {
      // user cancelled
    }
  };

  // Deleting an assay also removes the files it owns and its dataset binding.
  const handleDelete = async (record: AssayItem) => {
    try {
      await deleteAssayApi({ id: record.id });
      message.success("Assay deleted successfully");
      if (selectedId === record.id) {
        setSelectedID(undefined);
      }
      refetch();
    } catch {
      message.error("Failed to delete assay");
    }
  };

  const actionsColumn: ColumnsType<AssayItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 150,
    align: "right",
    fixed: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Add File">
          <Button type="text" size="small" icon={<FileAddOutlined />} onClick={() => handleAddFile(record)} />
        </Tooltip>
        <Tooltip title="Edit Assay">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        </Tooltip>
        <Popconfirm
          title="Delete this assay?"
          description="Its files and dataset binding are deleted too."
          onConfirm={() => handleDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const selectColumn: ColumnsType<AssayItem>[number] = {
    title: "Action",
    key: "action",
    width: 96,
    fixed: "right",
    render: (_: unknown, record) => (
      <Button
        type={record.id === selectedId ? "primary" : "default"}
        size="small"
        onClick={() => setSelectedID(record.id)}
      >
        {record.id === selectedId ? "Selected" : "Select"}
      </Button>
    ),
  };

  const columns: ColumnsType<AssayItem> = selectable
    ? [...detailColumns, actionsColumn, selectColumn]
    : [...listColumns, actionsColumn];

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
    if (close) {
      close();
    }
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Assays"}</span>
        <div className="project-report-panel-actions">
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
          </Button>
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "Failed to load assays" : "No assays"}
          />
        ) : (
          <Table<AssayItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            expandable={expandable}
            showHeader={selectable}
            scroll={selectable ? { x: 1500 } : undefined}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            rowSelection={
              selectable
                ? {
                    type: "radio",
                    selectedRowKeys: selectedId ? [selectedId] : [],
                    onChange: (selectedRowKeys) => {
                      setSelectedID(String(selectedRowKeys[0] || ""));
                    },
                  }
                : undefined
            }
            onRow={
              selectable
                ? (record) => ({
                    onClick: () => setSelectedID(record.id),
                  })
                : undefined
            }
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(t) => `${t} assays`}
            onChange={(nextPage, nextSize) => {
              if (nextSize !== pageSize) {
                setPageSize(nextSize);
              } else {
                setPage(nextPage);
              }
            }}
          />
          {selectable && (
            <Flex gap="small">
              <Button size="small" onClick={handleCancel}>Cancel</Button>
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

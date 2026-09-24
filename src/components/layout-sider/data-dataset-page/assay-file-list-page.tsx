import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Flex, Popconfirm, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { deleteFileApi, listFileByAssayApi } from "@/api/data";
import type { DataFileItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface AssayFileListPageProps {
  /** PK of the assay whose files are listed. */
  assay_id?: string;
  /** Human readable assay label, shown in nested add/edit drawer titles. */
  assay_label?: string;
  title?: string;
  onOk?: (files: DataFileItem[]) => void;
  onCancel?: () => void;
  close?: () => void;
}

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

const fileColumns = (
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
    title: "File Key",
    dataIndex: "file_key",
    key: "file_key",
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

// Files owned by one assay (go_file.assay_id). A file is assay-private: it is
// created for this assay and carries the key (go_file.file_key) an analysis form
// input maps onto its accept formats. Opened as a drawer from the assay list, so
// the narrow left panel never has to host this table.
const AssayFileListPage = ({ assay_id, assay_label }: AssayFileListPageProps) => {
  const message = useGlobalMessage();
  const [files, setFiles] = useState<DataFileItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!assay_id) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const response = await listFileByAssayApi(assay_id);
      setFiles((response.data ?? []) as DataFileItem[]);
    } catch {
      // already reported by the global interceptor; keep the previous rows
    } finally {
      setLoading(false);
    }
  }, [assay_id]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleAdd = async () => {
    if (!assay_id) {
      return;
    }

    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id, assay_label },
        { width: 520, title: `Add File: ${assay_label || assay_id}` }
      );
      await loadFiles();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (file: DataFileItem) => {
    if (!assay_id) {
      return;
    }

    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id, assay_label, file },
        { width: 520, title: `Edit File: ${file.file_name || file.file_id || file.id}` }
      );
      await loadFiles();
    } catch {
      // user cancelled
    }
  };

  const handleDelete = async (file: DataFileItem) => {
    try {
      await deleteFileApi({ id: file.id });
      message.success("File deleted successfully");
      await loadFiles();
    } catch {
      // already reported by the global interceptor
    }
  };

  return (
    <Flex vertical gap="small">
      <Flex justify="space-between" align="center" gap="small" wrap>
        <span style={{ fontSize: 12, color: "var(--sharp-text-soft)" }}>
          {files.length === 0
            ? "No files owned by this assay"
            : `${files.length} file(s) owned by this assay`}
        </span>
        <Flex gap="small">
          <Button
            size="small"
            type="primary"
            icon={<FileAddOutlined />}
            disabled={!assay_id}
            onClick={handleAdd}
          >
            Add File
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            disabled={!assay_id}
            onClick={() => void loadFiles()}
          />
        </Flex>
      </Flex>

      {files.length === 0 && !loading ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No files" />
      ) : (
        <Table<DataFileItem>
          rowKey="id"
          size="small"
          columns={fileColumns(
            (file) => void handleEdit(file),
            (file) => void handleDelete(file)
          )}
          dataSource={files}
          loading={loading}
          pagination={false}
          locale={{ emptyText: "No files" }}
        />
      )}
    </Flex>
  );
};

export default AssayFileListPage;

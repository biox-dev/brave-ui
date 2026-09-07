import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Descriptions, Empty, Flex, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, FileOutlined, ReloadOutlined, TableOutlined, TagsOutlined } from "@ant-design/icons";
import { useDatasetFilePageQuery } from "@/hooks/usePaginationV2";
import type { DatasetFileItem } from "@/api/data";
import { deleteFileApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface DatasetFilePageProps {
  project_id?: string;
  file_id?: string;
  file_name?: string;
  path?: string;
  format?: string;
  storage?: string;
  description?: string;
  dataset_id?: string;
  dataset_name?: string;
  role?: string | string[];
  page_size?: number | string;
  title?: string;
  onOk?: (file: DatasetFileItem) => void;
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

  return 20;
};

const normalizeRoles = (role?: string | string[]) => {
  if (!role) {
    return undefined;
  }

  const source = Array.isArray(role) ? role : role.split(",");
  const roles = source
    .map((item) => item.trim())
    .filter(Boolean);

  return roles.length > 0 ? roles : undefined;
};

const isSpreadsheetFile = (item: DatasetFileItem) => {
  const format = String(item.format ?? "").toLowerCase();
  if (["xlsx", "xls", "csv", "tsv"].includes(format)) {
    return true;
  }

  const path = String(item.path ?? "").toLowerCase();
  return [".xlsx", ".xls", ".csv", ".tsv"].some((ext) => path.endsWith(ext));
};

const formatBytes = (size?: number) => {
  if (typeof size !== "number" || !Number.isFinite(size)) {
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

const FileDetailCard = ({ item }: { item: DatasetFileItem }) => (
  <div style={{ width: 380 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "file_name", label: "File Name", children: item.file_name || item.file_id || "-" },
        { key: "file_id", label: "File ID", children: item.file_id || "-" },
        { key: "dataset", label: "Dataset", children: item.dataset_name || "-" },
        { key: "role", label: "Role", children: item.role || "-" },
        { key: "format", label: "Format", children: item.format || "-" },
        { key: "size", label: "Size", children: formatBytes(item.size) },
        { key: "storage", label: "Storage", children: item.storage || "-" },
        { key: "md5", label: "MD5", children: item.md5 || "-" },
        {
          key: "path",
          label: "Path",
          children: item.path ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.path}</span>
          ) : (
            "-"
          ),
        },
        { key: "description", label: "Description", children: item.description || "-" },
        {
          key: "created_at",
          label: "Created At",
          children: item.created_at ? new Date(item.created_at).toLocaleString() : "-",
        },
      ]}
    />
  </div>
);

const listColumns: ColumnsType<DatasetFileItem> = [
  {
    title: "File Name",
    dataIndex: "file_name",
    key: "file_name",
    render: (name: string, record) => (
      <div className="project-report-item">
        <FileOutlined className="project-report-item-icon" />
        <div className="project-report-item-text">
          <span className="project-report-item-title">
            {name || record.file_id || `File-${record.id}`}
          </span>
          {[record.dataset_name, record.format].filter(Boolean).length > 0 && (
            <span className="project-report-item-meta">
              {[record.dataset_name, record.format].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    width: 110,
    render: (value: string) => (value ? <Tag color="cyan">{value}</Tag> : "-"),
  },
];

const detailColumns: ColumnsType<DatasetFileItem> = [
  {
    title: "File Name",
    dataIndex: "file_name",
    key: "file_name",
    ellipsis: true,
  },
  {
    title: "File ID",
    dataIndex: "file_id",
    key: "file_id",
    width: 180,
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
    title: "Role",
    dataIndex: "role",
    key: "role",
    width: 100,
    render: (value: string) => value || "-",
  },
  {
    title: "Path",
    dataIndex: "path",
    key: "path",
    ellipsis: true,
    render: (value: string) => <Tooltip placement="left" title={value || "-"} >{value || "-"}</Tooltip>,
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

const DatasetFilePage = ({
  file_id,
  file_name,
  path,
  format,
  storage,
  description,
  dataset_id,
  dataset_name,
  role,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: DatasetFilePageProps) => {
  const message = useGlobalMessage();
  const navigate = useNavigate();
  const [selectedId, setSelectedID] = useState<string>();

  const selectable = Boolean(onOk || onCancel);

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
  } = useDatasetFilePageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({
      file_id: normalizeText(file_id),
      file_name: normalizeText(file_name),
      path: normalizeText(path),
      format: normalizeText(format),
      storage: normalizeText(storage),
      description: normalizeText(description),
      dataset_id: normalizeText(dataset_id),
      dataset_name: normalizeText(dataset_name),
      role: normalizeRoles(role),
    });
  }, [file_id, file_name, path, format, storage, description, dataset_id, dataset_name, role, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const bodyRow = useMemo(() => {
    const Row = (props: any) => {
      const rowKey = props?.["data-row-key"];
      const record = data.find((item) => String(item.id) === String(rowKey));
      const rowElement = <tr {...props} />;

      if (!record) {
        return rowElement;
      }

      return (
        <Popover
          placement="left"
          mouseEnterDelay={0.2}
          mouseLeaveDelay={0.1}
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileOutlined />
              {record.file_name || record.file_id || `File-${record.id}`}
            </span>
          }
          content={<FileDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  const handleOpenSheet = (item: DatasetFileItem) => {
    if (!isSpreadsheetFile(item)) {
      message.warning("This file format is not supported for opening");
      return;
    }

    navigate(`/dataset-file/${encodeURIComponent(item.id)}`);
  };

  const handleRowClick = (record: DatasetFileItem) => {
    setSelectedID(record.id);
    if (selectable) {
      return;
    }
    navigate(`/dataset-file/${encodeURIComponent(record.id)}`);
  };

  const actionsColumn: ColumnsType<DatasetFileItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 150,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions"
        onClick={(e) => e.stopPropagation()}
      >
        {/* <Tooltip title="Open Sheet">
          <Button
            type="text"
            size="small"
            icon={<TableOutlined />}
            onClick={() => handleOpenSheet(record)}
          />
        </Tooltip> */}
        <Tooltip title="Edit">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={async () => {
              try {
                await invoke.editFilePage.openDrawerAsync(
                  { file: record },
                  { width: 480, title: `Edit File: ${record.file_name || record.file_id}` }
                );
                refetch();
              } catch {
                // user cancelled
              }
            }}
          />
        </Tooltip>
        <Tooltip title="Edit Role">
          <Button
            type="text"
            size="small"
            icon={<TagsOutlined />}
            onClick={async () => {
              try {
                await invoke.editDatasetFileRole.openDrawerAsync(
                  { file: record },
                  { width: 400, title: `Edit Role: ${record.file_name || record.file_id}` }
                );
                refetch();
              } catch {
                // user cancelled
              }
            }}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this file?"
          description="This will remove the file and its dataset associations."
          onConfirm={async () => {
            await deleteFileApi({ id: record.id });
            message.success("File deleted successfully");
            refetch();
          }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const columns: ColumnsType<DatasetFileItem> = selectable
    ? [
        ...detailColumns,
        actionsColumn,
        {
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
        },
      ]
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
        <span className="project-report-panel-title">{title || "Files"}</span>
        <div className="project-report-panel-actions">
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "Failed to load files" : "No files"}
          />
        ) : (
          <Table<DatasetFileItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={selectable}
            scroll={selectable ? { x: 1200 } : undefined}
            components={{ body: { row: bodyRow } }}
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
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
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
            total={total}
            showSizeChanger
            showTotal={(t) => `${t} files`}
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

export default DatasetFilePage;

import { useMemo, useState } from "react";
import { Button, Descriptions, Empty, Flex, Pagination, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, FileOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { useAnalysisNodeFilePageQuery } from "@/hooks/usePaginationV2";
import type { DatasetFileItem } from "@/api/data";
import { deleteFileApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

// Analysis-node-produced files of the active project (go_file.analysis_node_id ->
// analysis_nodes.id). These files are node-private and not dataset-bound, so the
// page mirrors dataset-file-page but drops the dataset/role-editing affordances.
export interface AnalysisNodeFilePageProps {
  page_size?: number | string;
  title?: string;
}

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
        { key: "analysis_node_id", label: "Analysis Node ID", children: item.analysis_node_id || "-" },
        { key: "file_key", label: "File Key", children: item.role || "-" },
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

const AnalysisNodeFilePage = ({ page_size, title }: AnalysisNodeFilePageProps) => {
  const message = useGlobalMessage();
  const [selectedId, setSelectedId] = useState<string>();
  const { projectId } = useSelector((state: any) => state.user);

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAnalysisNodeFilePageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
      scopeKey: projectId,
    }
  );

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

  const listColumn: ColumnsType<DatasetFileItem>[number] = {
    title: "File Name",
    dataIndex: "file_name",
    key: "file_name",
    ellipsis: { showTitle: false },
    render: (name: string, record) => {
      const meta = [record.format, record.role].filter(Boolean).join(" · ");
      const label = name || record.file_id || `File-${record.id}`;

      return (
        <div className="project-report-item">
          <FileOutlined className="project-report-item-icon" />
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
  };

  const columns: ColumnsType<DatasetFileItem> = [
    listColumn,
    {
      title: "Actions",
      key: "actions",
      width: 80,
      align: "right",
      render: (_: unknown, record) => (
        <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
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
          <Popconfirm
            title="Delete this file?"
            description="This will remove the file and its relations."
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
    },
  ];

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Analysis Node Files"}</span>
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
            showHeader={false}
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => setSelectedId(record.id),
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
        </Flex>
      </div>
    </div>
  );
};

export default AnalysisNodeFilePage;

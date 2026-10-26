import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router";
import { Button, Descriptions, Empty, Flex, Pagination, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useSelector } from "react-redux";
import { useProjectFilePageQuery } from "@/hooks/usePaginationV2";
import type { DatasetFileItem } from "@/api/data";
import { deleteFileApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useUI } from "@/core/ui-system/useUI";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import "./file-list-page.css";

/**
 * 文件列表的共享实现。
 *
 * `dataset`（数据集文件 / 用户上传）与 `analysisNode`（分析节点产出文件）的 UI 完全一致，
 * 唯一差别是数据接口，因此合并为一个组件，用 `source` 选择接口：
 * - dataset      -> pageFileByProjectApi
 * - analysisNode -> pageFileByProjectViaAnalysisNodeApi
 *
 * 布局从上到下为：操作区（标题 / 计数 / 操作按钮）-> 可选视图切换（`subHeader`）-> 列表 -> 分页。
 * 合并视图 `project-file-page` 通过 `subHeader` 注入视图切换按钮。
 * 作为文件选择器使用时（invoke 注入 onOk/onCancel）进入选择模式。
 */
export type FileListSource = "dataset" | "analysisNode";

export interface FileListPageProps {
  /** 数据来源，只影响调用的接口与少量文案/操作按钮。 */
  source: FileListSource;
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
  /** 操作区下方的附加区域（合并视图用来渲染视图切换按钮）。 */
  subHeader?: ReactNode;
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

/** 行悬停详情；分析节点文件的 role 实际是 file_key，标签沿用旧页面的叫法。 */
const FileDetailCard = ({ item, isDatasetSource }: { item: DatasetFileItem; isDatasetSource: boolean }) => (
  <div style={{ width: 380 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "file_name", label: "File Name", children: item.file_name || item.file_id || "-" },
        { key: "file_id", label: "File ID", children: item.file_id || "-" },
        { key: "analysis_node_id", label: "Analysis Node ID", children: item.analysis_node_id || "-" },
        ...(isDatasetSource
          ? [{ key: "dataset", label: "Dataset", children: item.dataset_name || "-" }]
          : []),
        { key: "role", label: isDatasetSource ? "Role" : "File Key", children: item.role || "-" },
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

/** 列表态（非选择器）的单列渲染：下拉说明行内只展示摘要信息。 */
const buildListColumn = (isDatasetSource: boolean): ColumnsType<DatasetFileItem>[number] => ({
  title: "File Name",
  dataIndex: "file_name",
  key: "file_name",
  ellipsis: { showTitle: false },
  render: (name: string, record) => {
    const meta = (isDatasetSource
      ? [record.format, record.dataset_name, record.role]
      : [record.format, record.role]
    )
      .filter(Boolean)
      .join(" · ");
    const title = name || record.file_id || `File-${record.id}`;

    return (
      <div className="project-report-item">
        <FileOutlined className="project-report-item-icon" />
        <div className="project-report-item-text">
          <Tooltip placement="topLeft" title={title}>
            <span className="project-report-item-title">{title}</span>
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
});

/** 选择器态使用的详情列（仅数据集文件沿用）。 */
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

const FileListPage = ({
  source,
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
  subHeader,
  onOk,
  onCancel,
  close,
}: FileListPageProps) => {
  const message = useGlobalMessage();
  const navigate = useNavigate();
  const { close: closeUI } = useUI();
  const [selectedId, setSelectedId] = useState<string>();

  const isDatasetSource = source === "dataset";
  const selectable = Boolean(onOk || onCancel);
  // 只关心激活项目 id：它参与 query 的 scopeKey，用于切换项目时重置分页。
  const { projectId } = useSelector((state: { user: { projectId?: string } }) => state.user);

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
  } = useProjectFilePageQuery(source, {}, {
    initialPageSize: normalizePageSize(page_size),
    keepPreviousData: true,
    staleTime: 30_000,
    cacheTime: 5 * 60_000,
    // scopeKey 同时带上数据来源：切换视图时缓存与页码都会重置。
    scopeKey: `${projectId ?? ""}:${source}`,
  });

  useEffect(() => {
    if (!isDatasetSource) {
      return;
    }
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
  }, [isDatasetSource, file_id, file_name, path, format, storage, description, dataset_id, dataset_name, role, setQuery]);

  // 切换数据来源后清空选中行，避免把另一种来源的记录带进选择结果。
  useEffect(() => {
    setSelectedId(undefined);
  }, [source]);

  const selectedItem = useMemo(
    () => data.find((item) => String(item.id) === String(selectedId)),
    [data, selectedId]
  );

  const bodyRow = useMemo(() => {
    // antd Table 会向自定义行组件传入 data-row-key 等属性，这里只用到行 key 做记录匹配。
    type TableRowProps = HTMLAttributes<HTMLTableRowElement> & { "data-row-key"?: string };
    const Row = (props: TableRowProps) => {
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
          content={<FileDetailCard item={record} isDatasetSource={isDatasetSource} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data, isDatasetSource]);

  const handleOpenSheet = (item: DatasetFileItem) => {
    if (!isSpreadsheetFile(item)) {
      message.warning("This file format is not supported for opening");
      return;
    }

    invoke.univerView.open(
      { file_id: item.file_id },
      {
        width: "90%",
        title: `Sheet: ${item.file_name || item.file_id}`,
        footer: null,
      }
    );
  };

  const handleOpenSysFileBrowser = () => {
    const id = invoke.sysFileBrowser.drawer(
      {
        type: "data",
        path: "/",
        onClose: () => {
          closeUI(id);
          refetch();
        },
      },
      { width: 640, title: "System Files" }
    );
  };

  // Upload a local file into a dataset through the shared collected-upload
  // dialog; it resolves once the upload finishes, so refresh the list after.
  const handleUpload = async () => {
    try {
      await invoke.collectedFileUpload.openDrawerAsync(
        {
          title: `${title || "Files"} Upload`,
          role: normalizeRoles(role),
          defaultDatasetId: normalizeText(dataset_id),
        },
        { width: 520, title: `Upload to ${title || "Files"}` }
      );
    } catch {
      // user cancelled
      return;
    }

    refetch();
  };

  const handleRowClick = (record: DatasetFileItem) => {
    setSelectedId(record.id);
    if (selectable) {
      return;
    }
    navigate(`/dataset-file/${encodeURIComponent(record.id)}`);
  };

  const actionsColumn: ColumnsType<DatasetFileItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 80,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="Open Sheet">
          <Button
            type="text"
            size="small"
            icon={<TableOutlined />}
            onClick={() => handleOpenSheet(record)}
          />
        </Tooltip>
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
          description={
            isDatasetSource
              ? "This will remove the file and its dataset associations."
              : "This will remove the file and its relations."
          }
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

  const selectColumn: ColumnsType<DatasetFileItem>[number] = {
    title: "Action",
    key: "action",
    width: 96,
    fixed: "right",
    render: (_: unknown, record) => (
      <Button
        type={String(record.id) === String(selectedId) ? "primary" : "default"}
        size="small"
        onClick={() => setSelectedId(record.id)}
      >
        {String(record.id) === String(selectedId) ? "Selected" : "Select"}
      </Button>
    ),
  };

  const listColumn = useMemo(() => buildListColumn(isDatasetSource), [isDatasetSource]);

  const columns: ColumnsType<DatasetFileItem> = selectable
    ? [
      ...(isDatasetSource ? detailColumns : [listColumn]),
      actionsColumn,
      selectColumn,
    ]
    : [listColumn, actionsColumn];

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

  const panelTitle = title || (isDatasetSource ? "Files" : "Analysis Node Files");

  return (
    <div className="project-report-panel file-list-panel">
      {/* 顶部操作区：标题 + 文件数 + 操作按钮 */}
      <div className="file-list-toolbar">
        <div className="file-list-toolbar-heading">
          <span className="file-list-toolbar-title">{panelTitle}</span>
          {total > 0 && <span className="file-list-toolbar-count">{total}</span>}
        </div>
        <div className="file-list-toolbar-actions">
          {isDatasetSource && (
            <>
              <Tooltip title="Upload">
                <Button
                  type="text"
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={handleUpload}
                />
              </Tooltip>
              <Tooltip title="System Files">
                <Button
                  type="text"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenSysFileBrowser}
                />
              </Tooltip>
            </>
          )}
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => refetch()}
            />
          </Tooltip>
        </div>
      </div>

      {/* 视图切换：位于操作区下方 */}
      {subHeader && <div className="file-list-switch">{subHeader}</div>}
      <div className="file-list-divider" />

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <div className="file-list-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={error ? "Failed to load files" : "No files"}
            />
          </div>
        ) : (
          <Table<DatasetFileItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={selectable}
            scroll={selectable ? { x: isDatasetSource ? 1200 : 900 } : undefined}
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              String(record.id) === String(selectedId) ? "project-report-row-selected" : ""
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
              onClick: () => handleRowClick(record),
            })}
          />
        )}
      </div>

      <div className="file-list-footer">
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

export default FileListPage;

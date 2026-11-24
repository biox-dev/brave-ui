import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Breadcrumb, Button, Empty, Flex, Popconfirm, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileOutlined,
  ReloadOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import {
  deleteFileApi,
  listFileByAnalysisNodeApi,
  type AnalysisNodeFileItem,
  type DatasetFileItem,
  type PageRequest,
  type PageResponse,
} from "@/api/data";
import {
  deleteAnalysisNodeApi,
  pageAnalysisNodeByProjectApi,
  type AnalysisNodeItem,
  type AnalysisNodePageQuery,
} from "@/api/analysis";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import SiderPanelLayout from "../common/sider-panel-layout";
import "./dataset-project-page.css";

/**
 * 分析节点产出文件面板。
 *
 * 结构与 `dataset-project-page` 一致（文件夹式两级浏览）：
 * - 第一级：懒加载当前项目下的分析节点列表（`pageAnalysisNodeByProjectApi`）；
 * - 点击节点进入第二级：按 `go_file.analysis_node_id` 懒加载该节点产出的文件
 *   （`listFileByAnalysisNodeApi`，后端不分页，这里在本地做关键字过滤 + 分页切片）；
 * - 顶部面包屑 + 返回按钮回到节点列表。
 *
 * 选择模式（`invoke.analysisNodeFilePage.openDrawerAsync(...)`）下只勾选文件：
 * 默认单选，传 `multiple` 后为多选，Confirm 回传 `DatasetFileItem`（或数组），
 * 保持既有调用方（Agent 输入区插入 `@file:<id>`）的契约不变。
 */
export interface AnalysisNodeFilePageProps {
  page_size?: number | string;
  title?: string;
  /** 多选模式：列表支持勾选多个文件，Confirm 时以数组回传。 */
  multiple?: boolean;
  onOk?: (file: DatasetFileItem | DatasetFileItem[]) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const normalizePageSize = (value: number | string | undefined, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

/** 节点的人类可读名称：优先 node_name，其次 analysis_node_id，最后回退到 id。 */
const nodeLabel = (node: AnalysisNodeItem) =>
  node.node_name || node.analysis_node_id || `Node-${node.id}`;

const fileLabel = (item: AnalysisNodeFileItem) => item.file_name || item.file_id || `File-${item.id}`;

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

const isSpreadsheetFile = (item: AnalysisNodeFileItem) => {
  const format = String(item.format ?? "").toLowerCase();
  if (["xlsx", "xlsm", "xls", "csv", "tsv"].includes(format)) {
    return true;
  }
  return [".xlsx", ".xlsm", ".xls", ".csv", ".tsv"].some((ext) =>
    String(item.path ?? "").toLowerCase().endsWith(ext)
  );
};

/**
 * 节点文件（go_file）转成选择结果契约里的 `DatasetFileItem`：
 * 该节点文件没有数据集归属，`role` 取它的 `file_key`（与项目级分析节点文件列表一致）。
 */
const toPickedFile = (item: AnalysisNodeFileItem): DatasetFileItem => ({
  id: item.id,
  file_id: item.file_id,
  file_name: item.file_name,
  path: item.path,
  format: item.format,
  size: item.size,
  analysis_node_id: item.analysis_node_id,
  md5: item.md5,
  storage: item.storage,
  description: item.description,
  created_at: item.created_at,
  updated_at: item.updated_at,
  dataset_id: "",
  dataset_name: "",
  role: item.file_key,
});

/** 节点 / 文件行：图标 + 名称 + 一行摘要，样式沿用侧栏的 project-report-item。
 *
 * `actions` 放在行尾并始终占据布局宽度（悬浮行时淡入），文字在按钮前截断，
 * 不会出现按钮盖住文字的情况，也不单独占用一整列（与数据集面板一致）。
 */
const ItemRow = ({
  icon,
  title,
  meta,
  actions,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  actions?: ReactNode;
}) => (
  <div className="project-report-item dataset-project-item">
    {icon}
    <div className="project-report-item-text">
      <span className="project-report-item-title" title={title}>
        {title}
      </span>
      {meta ? (
        <span className="project-report-item-meta" title={meta}>
          {meta}
        </span>
      ) : null}
    </div>
    {actions ? (
      <span
        className="project-report-item-actions dataset-project-item-actions"
        onClick={(event) => event.stopPropagation()}
      >
        {actions}
      </span>
    ) : null}
  </div>
);

// ---------------------------------------------------------------------------
// 分析节点列表（第一级）
// ---------------------------------------------------------------------------

interface AnalysisNodeListPanelProps {
  pageSize: number;
  onOpen: (node: AnalysisNodeItem) => void;
  /** 面板标题（默认 Analysis Nodes）。 */
  title?: string;
  /** 选择器模式下由页面注入的底部操作区。 */
  footer?: ReactNode;
  /** 纵向堆叠折叠时停止列表请求。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态。 */
  onToggleCollapse?: () => void;
}

const AnalysisNodeListPanel = ({
  pageSize,
  onOpen,
  title,
  footer,
  collapsed = false,
  onToggleCollapse,
}: AnalysisNodeListPanelProps) => {
  const message = useGlobalMessage();
  const { locale } = useI18n();
  // 后端按当前用户激活的项目过滤，这里只用它作为 scopeKey：切项目时重置分页。
  const { projectId } = useSelector((state: { user: { projectId?: string } }) => state.user);

  const {
    items: nodes,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    reload,
    error,
    sentinelRef,
  } = useLazyList<AnalysisNodeItem, AnalysisNodePageQuery>({
    fetcher: (payload) => pageAnalysisNodeByProjectApi(payload).then((response) => response.data),
    pageSize,
    scopeKey: projectId,
    enabled: !collapsed,
  });

  const isFetching = loading || loadingMore;

  const handleOpenReport = (node: AnalysisNodeItem) => {
    invoke.analysisNodeDetails.open(
      { analysis_node_id: String(node.id) },
      { width: 960, title: nodeLabel(node), footer: null }
    );
  };

  const handleDelete = async (node: AnalysisNodeItem) => {
    try {
      await deleteAnalysisNodeApi(node.id);
      message.success("Analysis node deleted successfully");
      await reload();
    } catch {
      message.error("Failed to delete analysis node");
    }
  };

  const columns: ColumnsType<AnalysisNodeItem> = [
    {
      title: "Analysis Node",
      dataIndex: "node_name",
      render: (_: string, record) => (
        <ItemRow
          icon={<ExperimentOutlined className="project-report-item-icon" />}
          title={nodeLabel(record)}
          meta={
            [
              record.status,
              record.script_name,
              record.updated_at ? formatRelativeTime(record.updated_at, locale) : undefined,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          actions={
            <>
              <Tooltip title="Report">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleOpenReport(record)}
                />
              </Tooltip>
              <Popconfirm title="Delete this analysis node?" onConfirm={() => handleDelete(record)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          }
        />
      ),
    },
  ];

  return (
    <SiderPanelLayout
      className="dataset-project-panel"
      bodyClassName="dataset-project-panel-body"
      title={title || "Analysis Nodes"}
      titleExtra={total > 0 ? <span className="sider-panel-count">{total}</span> : undefined}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      footer={footer}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search analysis nodes"
            className="project-report-panel-search"
          />
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => reload()}
            />
          </Tooltip>
        </>
      }
    >
      {nodes.length === 0 && !isFetching ? (
        <div className="dataset-project-empty">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "Failed to load analysis nodes" : "No analysis nodes"}
          />
        </div>
      ) : (
        <Table<AnalysisNodeItem>
          rowKey="id"
          size="small"
          showHeader={false}
          tableLayout="fixed"
          columns={columns}
          dataSource={nodes}
          loading={isFetching}
          pagination={false}
          onRow={(record) => ({
            // 点击节点即「进入文件夹」，查看该节点产出的文件。
            onClick: () => onOpen(record),
          })}
        />
      )}

      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={nodes.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more analysis nodes", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

// ---------------------------------------------------------------------------
// 节点内的文件列表（第二级）
// ---------------------------------------------------------------------------

// /data/file/list-by-analysis-node 一次返回该节点的全部产出文件（后端不分页），
// 这里在本地做关键字过滤 + 分页切片，既保留滚动懒加载体验，又保证同一节点只请求一次。
// 缓存放在调用方的 ref 里，刷新时清空即可重新拉取。
const createAnalysisNodeFilesFetcher = (
  analysisNodeId: string,
  cache: { current: Promise<AnalysisNodeFileItem[]> | null }
) => {
  return (payload: PageRequest): Promise<PageResponse<AnalysisNodeFileItem>> => {
    if (!cache.current) {
      const request = listFileByAnalysisNodeApi(analysisNodeId).then((response) => response.data ?? []);
      cache.current = request;
      // 请求失败时不缓存，下次重试仍会真正发起请求。
      void request.catch(() => {
        if (cache.current === request) cache.current = null;
      });
    }

    return cache.current.then((all) => {
      const keyword = payload.keyword?.trim().toLowerCase();
      const matched = keyword
        ? all.filter((file) =>
            [file.file_name, file.file_id, file.path, file.file_key, file.format].some((value) =>
              String(value ?? "").toLowerCase().includes(keyword)
            )
          )
        : all;
      const page = payload.page ?? 1;
      const size = payload.page_size ?? 20;
      const start = (page - 1) * size;

      return {
        data: matched.slice(start, start + size),
        total: matched.length,
        page,
        page_size: size,
      };
    });
  };
};

interface AnalysisNodeFilesPanelProps {
  node: AnalysisNodeItem;
  pageSize: number;
  selectable: boolean;
  multiple: boolean;
  selectedIds: string[];
  onSelectRows: (ids: string[], rows: AnalysisNodeFileItem[]) => void;
  onToggle: (file: AnalysisNodeFileItem) => void;
  /** 返回分析节点列表。 */
  onBack: () => void;
  /** 选择器模式下由页面注入的底部操作区。 */
  footer?: ReactNode;
  /** 纵向堆叠折叠时停止列表请求。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态。 */
  onToggleCollapse?: () => void;
}

const AnalysisNodeFilesPanel = ({
  node,
  pageSize,
  selectable,
  multiple,
  selectedIds,
  onSelectRows,
  onToggle,
  onBack,
  footer,
  collapsed = false,
  onToggleCollapse,
}: AnalysisNodeFilesPanelProps) => {
  const message = useGlobalMessage();
  // 非分页接口的本地缓存（进入节点只请求一次），刷新时清空。
  const cacheRef = useRef<Promise<AnalysisNodeFileItem[]> | null>(null);
  // 版本号：编辑 / 删除后自增，触发列表重新拉取。
  const [version, setVersion] = useState(0);

  const fetcher = useMemo(() => createAnalysisNodeFilesFetcher(node.id, cacheRef), [node.id]);
  const {
    items: files,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    error,
    sentinelRef,
  } = useLazyList<AnalysisNodeFileItem>({
    fetcher,
    pageSize,
    scopeKey: node.id,
    reloadKey: version,
    enabled: !collapsed,
  });

  const refresh = () => {
    cacheRef.current = null;
    setVersion((value) => value + 1);
  };
  const isFetching = loading || loadingMore;

  const handleOpenSheet = (file: AnalysisNodeFileItem) => {
    if (!isSpreadsheetFile(file)) {
      message.warning("This file format is not supported for opening");
      return;
    }
    invoke.univerView.open(
      { file_id: file.file_id },
      { width: "90%", title: `Sheet: ${fileLabel(file)}`, footer: null }
    );
  };

  const handleEdit = async (file: AnalysisNodeFileItem) => {
    try {
      await invoke.editFilePage.openDrawerAsync(
        { file: toPickedFile(file) },
        { width: 480, title: `Edit File: ${fileLabel(file)}` }
      );
      refresh();
    } catch {
      // user cancelled
    }
  };

  const handleDelete = async (file: AnalysisNodeFileItem) => {
    try {
      await deleteFileApi({ id: file.id });
      message.success("File deleted successfully");
      refresh();
    } catch {
      message.error("Failed to delete file");
    }
  };

  const columns: ColumnsType<AnalysisNodeFileItem> = [
    {
      title: "File",
      dataIndex: "file_name",
      render: (_: string, record) => (
        <ItemRow
          icon={<FileOutlined className="project-report-item-icon" />}
          title={fileLabel(record)}
          meta={
            [record.format, record.file_key, formatBytes(record.size)].filter(Boolean).join(" · ") ||
            undefined
          }
          actions={
            <>
              <Tooltip title="Open Sheet">
                <Button
                  type="text"
                  size="small"
                  icon={<TableOutlined />}
                  onClick={() => handleOpenSheet(record)}
                />
              </Tooltip>
              <Tooltip title="Edit">
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
              </Tooltip>
              <Popconfirm
                title="Delete this file?"
                description="This will remove the file and its analysis node relation."
                onConfirm={() => handleDelete(record)}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          }
        />
      ),
    },
  ];

  return (
    <SiderPanelLayout
      className="dataset-project-panel"
      bodyClassName="dataset-project-panel-body"
      title={nodeLabel(node)}
      titleExtra={total > 0 ? <span className="sider-panel-count">{total}</span> : undefined}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      footer={footer}
      subHeader={
        <Breadcrumb
          className="dataset-project-breadcrumb"
          items={[
            { title: <Typography.Link onClick={onBack}>Analysis Nodes</Typography.Link> },
            { title: nodeLabel(node) },
          ]}
        />
      }
      actions={
        <>
          <Tooltip title="Back to analysis nodes">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              aria-label="Back to analysis nodes"
              onClick={onBack}
            />
          </Tooltip>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search files"
            className="project-report-panel-search"
          />
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={refresh}
            />
          </Tooltip>
        </>
      }
    >
      {files.length === 0 && !isFetching ? (
        <div className="dataset-project-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "Failed to load files" : "No files"} />
        </div>
      ) : (
        <Table<AnalysisNodeFileItem>
          rowKey="id"
          size="small"
          showHeader={false}
          tableLayout="fixed"
          columns={columns}
          dataSource={files}
          loading={isFetching}
          pagination={false}
          rowClassName={(record) => (selectedIds.includes(record.id) ? "project-report-row-selected" : "")}
          rowSelection={
            selectable
              ? {
                  type: multiple ? "checkbox" : "radio",
                  selectedRowKeys: selectedIds,
                  onChange: (keys, rows) => onSelectRows(keys.map(String), rows),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: (event) => {
              if ((event.target as HTMLElement | null)?.closest?.(".ant-table-selection-column")) {
                return;
              }
              // 选择器里点文件即勾选（多选为切换）；浏览态点文件直接打开表格。
              if (selectable) {
                if (multiple) {
                  onToggle(record);
                  return;
                }
                onSelectRows([record.id], [record]);
                return;
              }
              handleOpenSheet(record);
            },
          })}
        />
      )}

      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={files.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more files", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

// ---------------------------------------------------------------------------
// 页面：分析节点列表 <-> 节点内文件（面包屑返回）
// ---------------------------------------------------------------------------

/**
 * 分析节点产出文件面板（文件夹式两级浏览，不再使用单级的项目文件列表）。
 *
 * 结构与 `dataset-project-page` 完全一致：每个层级各自渲染 `SiderPanelLayout`，
 * 搜索框与动作按钮落在统一标题栏里；
 * - 第一级懒加载展示当前项目下的分析节点；
 * - 点击节点进入第二级，按 `analysis_node_id` 懒加载该节点产出的文件，
 *   顶部面包屑（subHeader）+ 返回按钮回到节点列表。
 *
 * 选择模式下 Confirm 回传选中的文件（单选为单个 `DatasetFileItem`，
 * `multiple` 为数组），视图键 `analysisNodeFilePage` 保持不变。
 */
const AnalysisNodeFilePage = ({
  page_size,
  title,
  multiple = false,
  onOk,
  onCancel,
  close,
  collapsed = false,
  onToggleCollapse,
}: AnalysisNodeFilePageProps) => {
  const selectable = Boolean(onOk || onCancel);
  const [activeNode, setActiveNode] = useState<AnalysisNodeItem>();
  const [pickedFiles, setPickedFiles] = useState<Record<string, AnalysisNodeFileItem>>({});

  const fileIds = Object.keys(pickedFiles);

  // 保留不在当前页的已选项（跨页勾选），因此用 id 合并而不是直接覆盖。
  const selectFiles = (ids: string[], rows: AnalysisNodeFileItem[]) => {
    setPickedFiles((prev) => {
      if (!multiple) {
        const first = rows[0] ?? (ids[0] ? prev[ids[0]] : undefined);
        return first ? { [first.id]: first } : {};
      }
      const next: Record<string, AnalysisNodeFileItem> = {};
      ids.forEach((id) => {
        const item = prev[id] ?? rows.find((row) => row.id === id);
        if (item) next[id] = item;
      });
      return next;
    });
  };

  const toggleFile = (file: AnalysisNodeFileItem) => {
    setPickedFiles((prev) => {
      const next = { ...prev };
      if (next[file.id]) {
        delete next[file.id];
      } else {
        next[file.id] = file;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (!onOk || fileIds.length === 0) {
      return;
    }
    const picked = Object.values(pickedFiles).map(toPickedFile);
    onOk(multiple ? picked : picked[0]);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  // 选择器模式下的底部操作区：两个层级共用，由面板透传给 SiderPanelLayout。
  const footer = selectable ? (
    <Flex align="center" justify="space-between" gap="small" style={{ width: "100%" }}>
      <span className="dataset-project-picked">{multiple ? `${fileIds.length} file(s)` : ""}</span>
      <Flex gap="small">
        <Button size="small" onClick={handleCancel}>
          Cancel
        </Button>
        <Button size="small" type="primary" disabled={fileIds.length === 0} onClick={handleConfirm}>
          {multiple && fileIds.length > 0 ? `Confirm (${fileIds.length})` : "Confirm"}
        </Button>
      </Flex>
    </Flex>
  ) : undefined;

  // 每个层级各自渲染 SiderPanelLayout：搜索框与动作按钮落在统一标题栏里，
  // 与数据集 / 脚本 / 流程等侧栏面板保持一致。
  return activeNode ? (
    <AnalysisNodeFilesPanel
      key={activeNode.id}
      node={activeNode}
      pageSize={normalizePageSize(page_size, 20)}
      selectable={selectable}
      multiple={multiple}
      selectedIds={fileIds}
      onSelectRows={selectFiles}
      onToggle={toggleFile}
      onBack={() => setActiveNode(undefined)}
      footer={footer}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  ) : (
    <AnalysisNodeListPanel
      pageSize={normalizePageSize(page_size, 10)}
      onOpen={setActiveNode}
      title={title || "Analysis Nodes"}
      footer={footer}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  );
};

export default AnalysisNodeFilePage;

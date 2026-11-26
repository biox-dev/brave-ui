import { deleteAnalysisNodeApi, pageAnalysisNodeByProjectApi, type AnalysisNodeItem, type AnalysisNodePageQuery } from "@/api/analysis";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import {
  ANALYSIS_NODE_TAB_KEY_PREFIX,
  useActiveWorkspaceResourceId,
  useWorkspaceOpener,
  type WorkspaceOpenTarget,
} from "@/layout/workspace-navigation";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, ExperimentOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import AskAgentButton from "../common/ask-agent-button";
import SiderPanelLayout from "../common/sider-panel-layout";

const statusColor = (status: string) => {
  switch (status) {
    case "succeeded":
    case "success":
    case "finished":
      return "success";
    case "failed":
    case "error":
      return "error";
    case "running":
    case "submitted":
      return "processing";
    case "ready":
    case "pending":
      return "default";
    default:
      return "default";
  }
};

/** 节点的人类可读名称：优先 node_name，其次 analysis_node_id，最后回退到 id。 */
const nodeDisplayName = (node: AnalysisNodeItem) =>
  node.node_name || node.analysis_node_id || `Node-${node.id}`;

/**
 * 分析节点报告页的「打开方式」统一描述：
 * - Agent 会话页：在右侧 MainTabs 用 analysisNodeDetails 视图打开标签；
 * - 其它页面：路由跳转到 /analsyis-node-report/:analysisNodeId。
 *
 * 标签 key 前缀与 `session-resource-workspace` 的 analysis_node 一致，
 * 左侧列表与会话结果分区点同一个节点时聚焦的是同一个标签。
 */
const buildAnalysisNodeTarget = (node: AnalysisNodeItem): WorkspaceOpenTarget => ({
  view: "analysisNodeDetails",
  title: nodeDisplayName(node),
  tabKeyPrefix: ANALYSIS_NODE_TAB_KEY_PREFIX,
  resourceId: String(node.id),
  // 与路由 /analsyis-node-report/:analysisNodeId 保持一致：都用 record.id。
  params: { analysis_node_id: String(node.id) },
  routePath: `/analsyis-node-report/${node.id}`,
});

const AnalysisNodeDetailCard = ({ item, locale }: { item: AnalysisNodeItem; locale: string }) => (
  <div style={{ width: 380 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "node_name", label: "Node Name", children: item.node_name || item.analysis_node_id || "-" },
        { key: "id", label: "ID", children: item.id || "-" },
        { key: "analysis_node_id", label: "Analysis Node ID", children: item.analysis_node_id || "-" },
        { key: "node_id", label: "Node ID", children: item.node_id || "-" },
        { key: "script_id", label: "Script ID", children: item.script_id || "-" },
        { key: "analysis_id", label: "Analysis ID", children: item.analysis_id || "-" },
        { key: "project_id", label: "Project ID", children: item.project_id || "-" },
        {
          key: "status",
          label: "Status",
          children: item.status ? <Tag color={statusColor(item.status)}>{item.status}</Tag> : "-",
        },
        // { key: "server_status", label: "Server Status", children: item.server_status || "-" },
        { key: "executor", label: "Executor", children: item.executor || "-" },
        // { key: "cache_hit", label: "Cache Hit", children: item.cache_hit ? "Yes" : "No" },
        {
          key: "retry",
          label: "Retry",
          children: `${item.retry ?? 0} / ${item.max_retry ?? 0}`,
        },
        // { key: "created_at", label: "Created At", children: formatRelativeTime(item.created_at, locale) },
        { key: "updated_at", label: "Updated At", children: formatRelativeTime(item.updated_at, locale) },
        // { key: "started_at", label: "Started At", children: formatRelativeTime(item.started_at, locale) },
        { key: "finished_at", label: "Finished At", children: formatRelativeTime(item.finished_at, locale) },
        {
          key: "output_dir",
          label: "Output Dir",
          children: item.output_dir ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.output_dir}</span>
          ) : (
            "-"
          ),
        },
        {
          key: "workspace_dir",
          label: "Workspace Dir",
          children: item.workspace_dir ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.workspace_dir}</span>
          ) : (
            "-"
          ),
        },
      ]}
    />
  </div>
);

export interface AnalysisResultListProps {
  title?: string;
  onOk?: (node: AnalysisNodeItem) => void;
  onCancel?: () => void;
  close?: () => void;
  // multiple 为 true 时支持一次选择多条，确认时 onOk 收到选中节点数组。
  multiple?: boolean;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const AnalysisResultList: FC<AnalysisResultListProps> = ({ title, onOk, onCancel, close, multiple = false, collapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { locale } = useI18n();

  // Derive the selected node id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    const match = location.pathname.match(/\/analsyis-node-report\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 后端按调用者的 active project 过滤数据，所以把 project_id 作为 scopeKey 传给
  // 分页 hook：只进 query key（切项目时自动重新请求并回到第 1 页），不发给后端。
  const { projectId } = useSelector((state: any) => state.user);

  // 当前是否在 Agent 会话页：是则行点击在右侧 MainTabs 打开标签，否则路由跳转。
  const openTarget = useWorkspaceOpener();
  // 会话页右侧正在显示的分析节点也算选中（行高亮与右侧标签保持一致）。
  const workspaceSelectedId = useActiveWorkspaceResourceId(ANALYSIS_NODE_TAB_KEY_PREFIX);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, AnalysisNodeItem>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string) => picked.has(String(id));
  // 选择器模式用本地选中态；普通模式优先看路由（报告页），会话页回退到右侧激活标签。
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId ?? workspaceSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: AnalysisNodeItem) => {
    setPicked((prev) => {
      if (!multiple) {
        return new Map([[String(record.id), record]]);
      }
      const next = new Map(prev);
      if (next.has(String(record.id))) {
        next.delete(String(record.id));
      } else {
        next.set(String(record.id), record);
      }
      return next;
    });
  };

  const {
    items: data,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    reload,
    sentinelRef,
  } = useLazyList<AnalysisNodeItem, AnalysisNodePageQuery>({
    fetcher: (payload) => pageAnalysisNodeByProjectApi(payload).then((response) => response.data),
    pageSize: 20,
    scopeKey: projectId,
    // 纵向堆叠折叠时只保留标题栏：停止列表请求，展开后自动恢复。
    enabled: !collapsed,
  });
  const refetch = reload;
  const isLoading = loading;
  const isFetching = loading || loadingMore;

  // 订阅 ws 分析事件：节点开始/结束后自动刷新列表。
  const { register, unregister } = useComponentStore();
  // 用 ref 读取最新折叠态：折叠切换时不必重建 handler（register 是多实例 Set，重建会反复增删）。
  const collapsedRef = useRef(collapsed);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const instanceNode = useMemo(
    () => ({
      // WS 事件驱动的刷新也要看折叠态：折叠时 refetch() 同样会发请求（enabled 不拦手动 refetch）。
      analysisStarted: () => {
        if (collapsedRef.current) return;
        refetch();
      },
      analysisDone: () => {
        if (collapsedRef.current) return;
        refetch();
      },
    }),
    [refetch]
  );
  useEffect(() => {
    register("analysis", "*", instanceNode);
    return () => {
      unregister("analysis", "*", instanceNode);
    };
  }, [register, unregister, instanceNode]);

  const handleDelete = async (node: AnalysisNodeItem) => {
    await deleteAnalysisNodeApi(node.id);
    message.success("Deleted successfully");
    refetch();
  };

  /**
   * 打开节点报告：
   * - Agent 会话页 → 右侧 MainTabs 打开 / 聚焦标签（不跳路由，聊天不丢）；
   * - 其它页面 → 路由跳转到 /analsyis-node-report/:analysisNodeId。
   */
  const openNodeReport = useCallback(
    (node: AnalysisNodeItem) => {
      openTarget(buildAnalysisNodeTarget(node));
    },
    [openTarget]
  );

  /** Actions 里的「眼睛」始终路由跳转（与行点击的区别：不依赖当前页面）。 */
  const openNodeReportRoute = useCallback(
    (node: AnalysisNodeItem) => {
      navigate(buildAnalysisNodeTarget(node).routePath);
    },
    [navigate]
  );

  /**
   * 手动创建命令型分析节点（无脚本，等价于 create_analysis_node_agent 的建节点部分）。
   * 弹窗内完成创建后返回新节点，这里只负责刷新列表。
   */
  const handleCreateCommandNode = async () => {
    try {
      await invoke.createCommandNode.openAsync(
        undefined,
        { title: "Create Command Analysis Node", width: 720, footer: null }
      );
      refetch();
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
    }
  };

  const handleConfirm = () => {
    if (!onOk || pickedItems.length === 0) {
      return;
    }
    // 多选时回传数组，单选时回传单个对象，保持既有调用方兼容。
    const payload = multiple ? pickedItems : pickedItems[0];
    (onOk as (value: AnalysisNodeItem | AnalysisNodeItem[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const columns = useMemo<ColumnsType<AnalysisNodeItem>>(
    () => [
      {
        title: "Node Name",
        dataIndex: "node_name",
        key: "node_name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = nodeDisplayName(record);
          const meta = [
            record.status,
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
            // script_name 来自后端按 script_id join 出来的脚本名称。
            record.script_name,
            // record.executor,

          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <ExperimentOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ExperimentOutlined />
                      {title}
                    </span>
                  }
                  content={<AnalysisNodeDetailCard item={record} locale={locale} />}
                >
                  <span className="project-report-item-title">{title}</span>
                </Popover>
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
      // {
      //   title: "Status",
      //   dataIndex: "status",
      //   key: "status",
      //   width: 96,
      //   render: (status: string) =>
      //     status ? <Tag color={statusColor(status)}>{status}</Tag> : "-",
      // },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        align: "right",
        render: (_, record) => (
          <span
            className="project-report-item-actions"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 把节点作为 @analysis_node:<id> 引用插进 Agent 输入框（Agent 侧用 get_analysis_node 解析）。 */}
            <AskAgentButton
              kind="analysis_node"
              id={record.id}
              label={nodeDisplayName(record)}
            />
            <Tooltip title="Report">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openNodeReportRoute(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Delete selected analysis node?"
              onConfirm={() => handleDelete(record)}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </span>
        ),
      },
    ],
    [locale, openNodeReportRoute]
  );

  const selectColumn: ColumnsType<AnalysisNodeItem>[number] = {
    title: "Select",
    key: "select",
    width: 96,
    align: "right",
    render: (_, record) => (
      <Button
        type={isPicked(record.id) ? "primary" : "default"}
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleSelect(record);
        }}
      >
        {isPicked(record.id) ? "Selected" : "Select"}
      </Button>
    ),
  };

  return (
    <SiderPanelLayout
      title={title || "Analysis Nodes"}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search nodes"
            className="project-report-panel-search"
          />
          <Tooltip title="Create command analysis node">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateCommandNode}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          />
        </>
      }
      footer={
        selectable ? (
          <>
            {multiple && pickedItems.length > 0 && (
              <span style={{ marginRight: "auto" }}>{pickedItems.length} selected</span>
            )}
            <Button onClick={handleCancel}>Cancel</Button>
            <Button
              type="primary"
              disabled={pickedItems.length === 0}
              onClick={handleConfirm}
            >
              Confirm
            </Button>
          </>
        ) : undefined
      }
    >
      {data.length === 0 && !isLoading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No analysis node"
        />
      ) : (
        <Table<AnalysisNodeItem>
          rowKey="id"
          size="small"
          columns={selectable ? [...columns, selectColumn] : columns}
          dataSource={data}
          loading={isLoading || isFetching}
          pagination={false}
          showHeader={false}
          rowClassName={(record) =>
            isPicked(record.id) || String(record.id) === String(selectedId)
              ? "project-report-row-selected"
              : ""
          }
          onRow={(record) => ({
            onClick: () =>
              selectable
                ? handleSelect(record)
                : openNodeReport(record),
          })}
        />
      )}
      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={data.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more nodes", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default AnalysisResultList;

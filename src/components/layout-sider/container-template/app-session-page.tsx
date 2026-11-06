import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Pagination,
  Popconfirm,
  Popover,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  DesktopOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useAppSessionPageQuery } from "@/hooks/usePaginationV2";
import {
  createAppSessionApi,
  createAppSessionByAnalysisNodeApi,
  deleteAppSessionApi,
  recreateAppSessionContainerApi,
  startAppSessionApi,
  stopAppSessionApi,
  type AppSessionItem,
  type ContainerTemplateItem,
} from "@/api/container";
import { createContainerTerminalSessionApi } from "@/api/container-template-terminal";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useI18n } from "@/hooks/useI18n";
import { openBottomTerminal, useBottomPanelStore } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";

export interface AppSessionPageProps {
  id?: string;
  project_id?: string;
  analysis_node_id?: string;
  analysis_node_name?: string;
  container_template_id?: string;
  name?: string;
  status?: string;
  workspace_path?: string;
  page_size?: number | string;
  /** @deprecated 视图已统一为紧凑列表面板，此参数保留仅为兼容旧调用方。 */
  view_mode?: "table" | "card" | string;
  title?: string;
  onOk?: (item: AppSessionItem) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
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

const buildAppUrl = (containerURL: string, appSession?: AppSessionItem) => {
  if (!appSession || !appSession.id) {
    return "";
  }
  //如果containerURL后有/ 去掉
  // const normalizedContainerURL = containerURL.endsWith("/") ? containerURL.slice(0, -1) : containerURL;
  // return `${normalizedContainerURL}${appSession.path_prefix}/`;
  return `${appSession.path_prefix}/`;
};

/** 底部终端标签的 key 前缀，与 `openBottomTerminal` 保持一致。 */
const TERMINAL_TAB_KEY_PREFIX = "terminal:";

/**
 * 从底部面板「激活标签 key」反解出应用会话 ID。
 *
 * 只有 `terminal:<sessionId>` 形式的标签代表一条终端会话；其它 kind 的标签
 * （日志等）返回 undefined。左栏据此高亮「激活标签对应的会话行」。
 */
const getTerminalSessionIdFromKey = (key?: string) => {
  const normalized = (key || "").trim();
  if (!normalized.startsWith(TERMINAL_TAB_KEY_PREFIX)) {
    return undefined;
  }
  const sessionId = normalized.slice(TERMINAL_TAB_KEY_PREFIX.length).trim();
  return sessionId || undefined;
};

/** 归一化后端状态字符串（大小写混用，如 RUNNING / create_pending）。 */
const normalizeStatus = (status?: string) => (status || "").trim().toLowerCase();

/**
 * 归一化会话种类：
 * - web      → 应用会话（容器跑模板命令，前端经网关访问）；
 * - terminal → 终端会话（容器常驻，交互式 shell 由运行时 exec 打开）。
 *
 * 后端历史行可能没有 session_kind，这里按 agent_session_id / persistent 兜底。
 */
const resolveSessionKind = (record: AppSessionItem): "web" | "terminal" => {
  const raw = (record.session_kind || "").trim().toLowerCase();
  if (raw === "web" || raw === "terminal") {
    return raw;
  }
  const agentSessionID = (record.agent_session_id || "").trim();
  return (agentSessionID && agentSessionID !== "0") || record.persistent
    ? "terminal"
    : "web";
};

const SESSION_KIND_META: Record<
  "web" | "terminal",
  { label: string; color: string; tip: string }
> = {
  web: {
    label: "Web",
    color: "blue",
    tip: "Web app session: the container runs the template command and is opened through the gateway.",
  },
  terminal: {
    label: "Terminal",
    color: "geekblue",
    tip: "Terminal session: keep-alive container with an interactive shell.",
  },
};

/** 运行态：可以 Open / Stop。 */
const RUNNING_STATUSES = new Set(["running", "started", "active"]);

/** 终态：可以 Start。 */
const STOPPED_STATUSES = new Set(["stopped", "exited", "failed", "terminated", "created", "closed"]);

/**
 * 会话动作阶段。
 *
 * 后端 `AppSession.Status` 除了 RUNNING / STOPPED / FAILED 之外，还会有
 * create_pending、creating、start_pending、starting、stop_pending、stopping、
 * recreate_pending、recreating 等过渡态；这些状态下 Start 与 Stop 都必须禁用，
 * 否则会重复提交同一个操作（旧逻辑只匹配 running / stopped，过渡态两个按钮都可点）。
 */
type SessionActionPhase = "running" | "starting" | "stopping" | "stopped";

const getSessionActionPhase = (status?: string): SessionActionPhase => {
  const normalized = normalizeStatus(status);
  if (RUNNING_STATUSES.has(normalized)) {
    return "running";
  }
  if (STOPPED_STATUSES.has(normalized)) {
    return "stopped";
  }
  if (/^(stop|delete)/.test(normalized)) {
    return "stopping";
  }
  if (normalized) {
    // create_pending / creating / start_pending / starting / recreate_pending ...
    return "starting";
  }
  // 状态缺失：按未运行处理，只提供 Start。
  return "stopped";
};

const isRunningStatus = (status?: string) => getSessionActionPhase(status) === "running";

const isStoppedStatus = (status?: string) => getSessionActionPhase(status) === "stopped";

/**
 * Start / Stop 的展示与可用性：同一时刻只展示可执行的那个动作。
 *
 * - running  → 展示 Stop（可点）；
 * - stopping → 展示 Stop（禁用 + loading，表示停止中）；
 * - starting → 展示 Start（禁用 + loading，表示启动 / 重建中）；
 * - stopped  → 展示 Start（可点）。
 */
const getSessionActionState = (status?: string) => {
  const phase = getSessionActionPhase(status);
  return {
    phase,
    /** 过渡态（启动 / 停止中），两个动作都不可点击。 */
    transitioning: phase === "starting" || phase === "stopping",
    /** 是否展示 Stop 按钮；否则展示 Start。 */
    showStop: phase === "running" || phase === "stopping",
    canStart: phase === "stopped",
    canStop: phase === "running",
  };
};

const getStatusColor = (status?: string) => {
  if (isRunningStatus(status)) {
    return "success";
  }
  if (isStoppedStatus(status)) {
    return "default";
  }
  return "processing";
};

/** 悬停会话名时展示的会话详情卡片。 */
const AppSessionDetailCard = ({
  item,
  locale,
}: {
  item: AppSessionItem;
  locale: string;
}) => {
  const kind = SESSION_KIND_META[resolveSessionKind(item)];
  const text = (value?: string) => value?.trim() || "-";

  return (
    <div style={{ width: 380 }}>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: "name", label: "Name", children: item.name || "-" },
          { key: "id", label: "ID", children: item.id || "-" },
          {
            key: "session_kind",
            label: "Kind",
            children: <Tag color={kind.color}>{kind.label}</Tag>,
          },
          {
            key: "status",
            label: "Status",
            children: item.status ? (
              <Tag color={getStatusColor(item.status)}>{item.status}</Tag>
            ) : (
              "-"
            ),
          },
          { key: "project_id", label: "Project ID", children: text(item.project_id) },
          {
            key: "analysis_node_id",
            label: "Analysis Node ID",
            children: text(item.analysis_node_id),
          },
          { key: "node_name", label: "Node Name", children: text(item.node_name) },
          {
            key: "container_template_id",
            label: "Template ID",
            children: text(item.container_template_id),
          },
          {
            key: "container_instance_name",
            label: "Container Instance",
            children: text(item.container_instance_name),
          },
          {
            key: "container_instance_id",
            label: "Container Instance ID",
            children: text(item.container_instance_id),
          },
          { key: "path_prefix", label: "Path Prefix", children: text(item.path_prefix) },
          {
            key: "workspace_path",
            label: "Workspace",
            children: item.workspace_path ? (
              <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                {item.workspace_path}
              </span>
            ) : (
              "-"
            ),
          },
          {
            key: "started_at",
            label: "Started At",
            children: formatRelativeTime(item.started_at, locale),
          },
          {
            key: "stopped_at",
            label: "Stopped At",
            children: formatRelativeTime(item.stopped_at, locale),
          },
          {
            key: "last_access_at",
            label: "Last Access",
            children: formatRelativeTime(item.last_access_at, locale),
          },
          {
            key: "created_at",
            label: "Created At",
            children: formatRelativeTime(item.created_at, locale),
          },
          {
            key: "updated_at",
            label: "Updated At",
            children: formatRelativeTime(item.updated_at, locale),
          },
        ]}
      />
    </div>
  );
};

const getDefaultAppSessionName = (item: ContainerTemplateItem) => {
  const base = (item.name || "app-session").trim().replace(/\s+/g, "-").toLowerCase();
  return `${base}-${Date.now()}`;
};

/** 模板的人类可读名称：优先 display_name，其次 name，最后回退到 id。 */
const getTemplateDisplayName = (item: ContainerTemplateItem) =>
  item.display_name || item.name || String(item.id);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
    if (msg) {
      return msg;
    }
  }
  return fallback;
};

const AppSessionPage = ({
  id,
  analysis_node_id,
  analysis_node_name,
  container_template_id,
  name,
  status,
  workspace_path,
  page_size,
  title,
  onOk,
  onCancel,
  close,
  collapsed = false,
  onToggleCollapse,
}: AppSessionPageProps) => {
  const { register, unregister } = useComponentStore();
  const { locale } = useI18n();
  const [selectedId, setSelectedID] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>("");
  const [creatingFromAnalysisNode, setCreatingFromAnalysisNode] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const selectable = Boolean(onOk || onCancel);
  const { containerURL } = useSelector((state: any) => state.user);

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
  } = useAppSessionPageQuery(
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
      id: normalizeText(id),
      analysis_node_id: normalizeText(analysis_node_id),
      container_template_id: normalizeText(container_template_id),
      name: normalizeText(name),
      status: normalizeText(status),
      workspace_path: normalizeText(workspace_path),
    });
  }, [
    id,
    analysis_node_id,
    container_template_id,
    name,
    status,
    workspace_path,
    setQuery,
  ]);

  // 底部面板当前激活的标签决定左栏的高亮项：激活 `terminal:<sessionId>` 标签时，
  // 列表里对应的会话行即为选中态。底部面板状态由 `/auth/me` 回填（后端持久化），
  // 所以刷新页面后选中项会随激活标签一起恢复。
  const activeBottomTabKey = useBottomPanelStore((state) => state.active);
  const activeSessionId = useMemo(
    () => getTerminalSessionIdFromKey(activeBottomTabKey),
    [activeBottomTabKey]
  );

  // 是否还有终端标签。全部标签都关闭后底部面板已无对应会话，
  // 左栏必须同步取消选中，否则会残留一条「幽灵高亮」。
  const hasTerminalTab = useBottomPanelStore((state) =>
    state.tabs.some((tab) => tab.kind === "terminal")
  );

  // 激活标签变化（点击行 / 在标签栏切换 / 刷新回填）时同步选中行：
  // - 有激活的终端标签 → 选中对应会话行；
  // - 已无任何终端标签（标签全部关闭） → 清空选中；
  // - 只是切到非终端标签（日志等）→ 保留上一次选中，避免高亮闪烁丢失。
  useEffect(() => {
    if (activeSessionId) {
      setSelectedID(activeSessionId);
      return;
    }
    if (!hasTerminalTab) {
      setSelectedID(undefined);
    }
  }, [activeSessionId, hasTerminalTab]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  // 会话状态事件（sessionRunning / sessionIdle / sessionAttached / sessionDetached）
  // 可能很密集（每个 terminal_exec 都会触发），统一做去抖，避免连续 refetch。
  const refetchTimer = useRef<number | undefined>(undefined);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) {
      window.clearTimeout(refetchTimer.current);
    }
    refetchTimer.current = window.setTimeout(() => {
      refetchTimer.current = undefined;
      void refetch();
    }, 300);
  }, [refetch]);

  useEffect(() => {
    return () => {
      if (refetchTimer.current) {
        window.clearTimeout(refetchTimer.current);
      }
    };
  }, []);

  /**
   * 后端 `manager.AppSessionEventHandler` 是「应用会话」实时事件的唯一出口：
   *
   * - 容器生命周期（analysisSubmitted / analysisStarted / analysisDone）；
   * - 会话层（sessionCreated / sessionDeleted / sessionRunning / sessionIdle /
   *   sessionAttached / sessionDetached），终端会话就是应用会话。
   *
   * 两类事件都只需重拉列表（refetch 幂等），因此统一注册成同一个 handler。
   */
  const realtimeInstance = useMemo(
    () => ({
      analysisSubmitted: (_args?: any) => {
        void refetch();
      },
      analysisStarted: (_args?: any) => {
        void refetch();
      },
      analysisDone: (_args?: any) => {
        void refetch();
      },
      // 会话增删：列表成员变化，立即刷新。
      sessionCreated: (_args?: any) => {
        void refetch();
      },
      sessionDeleted: (_args?: any) => {
        void refetch();
      },
      // 会话运行态 / 订阅者变化：去抖刷新，避免命令执行期间频繁请求。
      sessionRunning: (_args?: any) => {
        scheduleRefetch();
      },
      sessionIdle: (_args?: any) => {
        scheduleRefetch();
      },
      sessionAttached: (_args?: any) => {
        scheduleRefetch();
      },
      sessionDetached: (_args?: any) => {
        scheduleRefetch();
      },
    }),
    [refetch, scheduleRefetch]
  );

  useEffect(() => {
    register("app-session", "*", realtimeInstance);
    return () => {
      unregister("app-session", "*", realtimeInstance);
    };
  }, [register, unregister, realtimeInstance]);

  const runAction = useCallback(
    async (action: "start" | "stop" | "recreate" | "delete", item: AppSessionItem) => {
      const actionKey = `${action}-${item.id}`;
      setPendingAction(actionKey);
      try {
        if (action === "start") {
          await startAppSessionApi({ id: String(item.id) });
          messageApi.success("App session started");
        } else if (action === "stop") {
          await stopAppSessionApi({ id: String(item.id) });
          messageApi.success("App session stopped");
        } else if (action === "recreate") {
          await recreateAppSessionContainerApi({ id: String(item.id) });
          messageApi.success("App session container recreate request submitted");
        } else {
          await deleteAppSessionApi({ id: String(item.id) });
          messageApi.success("App session deleted");
        }
        await refetch();
      } catch (_error) {
        // Error message is handled by the global HTTP interceptor.
      } finally {
        setPendingAction("");
      }
    },
    [messageApi, refetch]
  );

  const handleDescribe = useCallback(
    async (record: AppSessionItem) => {
      const instanceId = normalizeText(record.container_instance_id);
      if (!instanceId) {
        messageApi.warning("No container instance");
        return;
      }
      try {
        await invoke.containerInstanceDescribeDialog.openAsync(
          { instanceId },
          {
            title: `Describe: ${record.container_instance_name || record.name || instanceId}`,
            width: 720,
            footer: false,
          }
        );
      } catch {
        // User cancelled
      }
    },
    [messageApi]
  );

  /**
   * 按「应用会话 ID」在底部面板打开（或聚焦）终端标签。
   *
   * 终端会话即应用会话（AppSession），后端终端 WS 路由
   * `/container/terminal/session/{id}/terminal` 的 `{id}` 就是 `AppSession.ID`：
   * 会话不在内存时后端会按记录认领原容器 / 重建 shell，因此这里只传会话 ID。
   * 同一会话重复点击只会聚焦已有标签，不会重复连接。
   */
  const openTerminalTab = (record: AppSessionItem) => {
    const sessionId = normalizeText(record.id);
    if (!sessionId) {
      return;
    }
    openBottomTerminal(sessionId, record.name);
  };

  /**
   * 点击左栏列表行：打开（或聚焦）该会话的底部终端标签，并立即标记为选中。
   *
   * 选中态最终由「激活的终端标签」驱动（见 activeSessionId），这里的 setSelectedID
   * 只是即时反馈，避免等待 store 回填前出现一帧无高亮。
   */
  const handleActivateSession = (record: AppSessionItem) => {
    const sessionId = normalizeText(record.id);
    if (sessionId) {
      setSelectedID(sessionId);
    }
    openTerminalTab(record);
  };

  /**
   * 打开「Run in terminal」弹窗（invoke 方式）。
   *
   * 弹窗实现见 `container-terminal-run-dialog`：命令通过
   * `POST /container/terminal/session/{id}/terminal/exec` 投递到该会话（容器已启动），
   * 提交成功后弹窗内部会打开底部终端标签，这里只需在 resolve 后刷新列表。
   */
  const handleOpenRun = useCallback(
    async (record: AppSessionItem) => {
      const sessionId = normalizeText(record.id);
      if (!sessionId) {
        return;
      }
      try {
        await invoke.containerTerminalRunDialog.openAsync(
          { sessionId, name: record.name },
          {
            title: `Run in terminal - ${record.name || sessionId}`,
            width: 640,
            footer: false,
          }
        );
        await refetch();
      } catch {
        // User cancelled
      }
    },
    [refetch]
  );

  /**
   * 紧凑列：与容器模板列表 / 终端会话列表同一视觉语言 ——
   * 标题 + 次要信息一行，右侧悬停出现操作按钮，不显示宽表格的字段列。
   */
  const columns = useMemo<ColumnsType<AppSessionItem>>(
    () => [
      {
        title: "Session",
        dataIndex: "name",
        key: "name",
        ellipsis: { showTitle: false },
        render: (_: unknown, record) => {
          const displayName = record.name || record.id || "-";
          const kind = SESSION_KIND_META[resolveSessionKind(record)];
          const meta = [
            record.status,
            kind.label,
            record.node_name?.trim(),
            record.started_at ? formatRelativeTime(record.started_at, locale) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <DesktopOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <DesktopOutlined />
                      {displayName}
                    </span>
                  }
                  content={<AppSessionDetailCard item={record} locale={locale} />}
                >
                  <span className="project-report-item-title">{displayName}</span>
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
      {
        title: "Actions",
        key: "actions",
        width: 214,
        align: "right",
        render: (_: unknown, record) => {
          const appUrl = buildAppUrl(containerURL, record);
          const actionState = getSessionActionState(record.status);
          // 终端会话没有对外 HTTP 服务（后端不注册路由），隐藏 Open 动作。
          const isTerminalSession = resolveSessionKind(record) === "terminal";
          const { transitioning, showStop, canStart, canStop, phase } = actionState;
          const startLoading = pendingAction === `start-${record.id}` || phase === "starting";
          const stopLoading = pendingAction === `stop-${record.id}` || phase === "stopping";
          return (
            <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
              <Tooltip title="Run in terminal">
                <Button
                  type="text"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => handleOpenRun(record)}
                />
              </Tooltip>
              {!isTerminalSession && (
                <Tooltip title="Open">
                  <Button
                    type="text"
                    size="small"
                    icon={<LinkOutlined />}
                    disabled={phase !== "running" || !appUrl}
                    onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
                  />
                </Tooltip>
              )}
              <Tooltip title="Describe">
                <Button
                  type="text"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  disabled={!record.container_instance_id}
                  onClick={() => handleDescribe(record)}
                />
              </Tooltip>
              {showStop ? (
                <Tooltip title={transitioning ? "Stopping..." : "Stop"}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PauseCircleOutlined />}
                    disabled={!canStop}
                    loading={stopLoading}
                    onClick={() => runAction("stop", record)}
                  />
                </Tooltip>
              ) : (
                <Tooltip title={transitioning ? "Starting..." : "Start"}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    disabled={!canStart}
                    loading={startLoading}
                    onClick={() => runAction("start", record)}
                  />
                </Tooltip>
              )}
              <Popconfirm
                title="Recreate this app session container?"
                description="This will delete and create a new container for this app session."
                onConfirm={() => runAction("recreate", record)}
                okButtonProps={{ loading: pendingAction === `recreate-${record.id}` }}
              >
                <Tooltip title="Recreate">
                  <Button
                    type="text"
                    size="small"
                    icon={<RedoOutlined />}
                    loading={pendingAction === `recreate-${record.id}`}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title="Delete this app session?"
                onConfirm={() => runAction("delete", record)}
                okButtonProps={{ loading: pendingAction === `delete-${record.id}` }}
              >
                <Tooltip title="Delete">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </span>
          );
        },
      },
    ],
    [containerURL, locale, pendingAction, runAction, handleDescribe, handleOpenRun]
  );

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

  const handleCreateByAnalysisNode = async () => {
    const normalizedAnalysisNodeId = normalizeText(analysis_node_id);
    if (!normalizedAnalysisNodeId) {
      return;
    }

    setCreatingFromAnalysisNode(true);
    try {
      const normalizedNodeName = normalizeText(analysis_node_name) || normalizedAnalysisNodeId;
      await createAppSessionByAnalysisNodeApi({
        analysis_node_id: normalizedAnalysisNodeId,
        name: `app-${normalizedNodeName}`,
      });
      messageApi.success("App session created");
      await refetch();
    } catch (_error) {
      // Error message is handled by the global HTTP interceptor.
    } finally {
      setCreatingFromAnalysisNode(false);
    }
  };

  const handleCreateAppSession = async (item: ContainerTemplateItem) => {
    // const normalizedProjectID = normalizeText(resolvedProjectID);
    // if (!normalizedProjectID) {
    //   messageApi.warning("No active project selected");
    //   return;
    // }

    try {
      await createAppSessionApi({
        container_template_id: String(item.id),
        // project_id: normalizedProjectID,
        name: getDefaultAppSessionName(item),
      });
      messageApi.success("App session created");
      await refetch();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to create app session"));
    }
  };

  /**
   * 按模板新建一条「终端会话」并打开底部终端标签。
   *
   * 终端会话 = 应用会话（AppSession），后端接口是
   * `POST /container/terminal/session/create`（handler `ContainerTerminalSessionCreate`）：
   * 创建时即拉起容器与 shell，返回的 session_id 就是应用会话 ID，因此创建完直接
   * `openBottomTerminal` 即可（不需要再按模板建立 WebSocket 连接）。
   */
  const handleCreateTerminalSession = async (item: ContainerTemplateItem) => {
    try {
      const created = (await createContainerTerminalSessionApi({
        container_template_id: item.id,
      })).data;
      openBottomTerminal(
        created.session_id,
        created.name || getTemplateDisplayName(item),
      );
      messageApi.success("Terminal session created");
      await refetch();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to create terminal session"));
    }
  };

  /**
   * 打开容器模板选择器；选择后的底部确认变成两个按钮：
   * - Create App Session：`handleCreateAppSession`（普通应用会话）；
   * - Create Terminal Session：`createContainerTerminalSessionApi`
   *   （终端会话，创建即启动容器并打开底部终端）。
   *
   * 两个按钮通过选择器的 `okActions` 注入，动作完成后选择器按 onOk 回传模板
   * 并关闭弹窗，所以这里拿到的返回值只用于结束 openAsync 的 Promise。
   */
  const handleOpenTemplatePage = async () => {
    try {
      await invoke.containerTemplatePage.openAsync(
        {
          okActions: [
            {
              key: "app-session",
              label: "Create App Session",
              primary: true,
              onClick: (selected: ContainerTemplateItem) =>
                handleCreateAppSession(selected),
            },
            {
              key: "terminal-session",
              label: "Create Terminal Session",
              onClick: (selected: ContainerTemplateItem) =>
                handleCreateTerminalSession(selected),
            },
          ],
        },
        {
          title: "Container Template List",
          width: 1200,
          footer: false,
        }
      );
    } catch {
      // User cancelled
    }
  };

  /**
   * 标题栏动作：与容器模板列表 / 终端会话列表一致，只保留图标按钮，
   * 避免在窄侧边栏里撑破标题栏。
   */
  const headerActions = (
    <>
      <Tooltip title="Create app session">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleOpenTemplatePage}
        />
      </Tooltip>
      {normalizeText(analysis_node_id) && (
        <Tooltip title="Create from analysis node">
          <Button
            type="text"
            size="small"
            icon={<NodeIndexOutlined />}
            loading={creatingFromAnalysisNode}
            onClick={handleCreateByAnalysisNode}
          />
        </Tooltip>
      )}
      <Tooltip title={`Total: ${total}`}>
        <span
          style={{
            fontSize: 11,
            color: "var(--sharp-text-soft)",
            padding: "0 4px",
            userSelect: "none",
          }}
        >
          {total}
        </span>
      </Tooltip>
      <Tooltip title="Refresh">
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          loading={isFetching}
          onClick={() => refetch()}
        />
      </Tooltip>
    </>
  );

  /** 选择模式下追加的「Select」列（与容器模板列表 / 分析节点列表一致）。 */
  const selectColumn: ColumnsType<AppSessionItem>[number] = {
    title: "Select",
    key: "select",
    width: 96,
    align: "right",
    render: (_, record) => (
      <Button
        type={String(record.id) === String(selectedId) ? "primary" : "default"}
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedID(record.id);
        }}
      >
        {String(record.id) === String(selectedId) ? "Selected" : "Select"}
      </Button>
    ),
  };

  // 单一面板骨架：左侧栏堆叠形态、独立路由页、invoke 选择弹窗共用同一套结构
  // （与容器模板列表 / 分析节点列表一致，不再区分 Card 形态）。
  return (
    <div className={`project-report-panel${collapsed ? " is-collapsed" : ""}`}>
      <div className="project-report-panel-header">
        {onToggleCollapse ? (
          <button
            type="button"
            className="project-report-panel-title project-report-panel-title-button"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <CaretRightOutlined className="project-report-panel-chevron" />
            ) : (
              <CaretDownOutlined className="project-report-panel-chevron" />
            )}
            <span>{title || "App Sessions"}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title || "App Sessions"}</span>
        )}
        <div className="project-report-panel-actions">{headerActions}</div>
      </div>

      <div
        className="project-report-panel-body"
        style={collapsed ? { display: "none" } : undefined}
      >
        {contextHolder}
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "Failed to load app sessions" : "No app session"}
          />
        ) : (
          <Table<AppSessionItem>
            rowKey="id"
            size="small"
            columns={selectable ? [...columns, selectColumn] : columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            rowClassName={(record) =>
              String(record.id) === String(selectedId) ? "project-report-row-selected" : ""
            }
            // 选择模式下点击行即选中；否则打开（或聚焦）该会话的终端标签，
            // 激活标签再反过来决定选中行。
            onRow={(record) => ({
              onClick: () =>
                selectable ? setSelectedID(record.id) : handleActivateSession(record),
            })}
          />
        )}
      </div>

      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--sharp-divider)",
          ...(collapsed ? { display: "none" } : null),
        }}
      >
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
          showTotal={(value) => `${value} sessions`}
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>

      {selectable && (
        <div
          style={{
            display: collapsed ? "none" : "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid var(--sharp-divider)",
          }}
        >
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
};

export default AppSessionPage;

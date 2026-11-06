import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Flex,
  Pagination,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AppstoreOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  CodeOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
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
import { openBottomTerminal } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";

const { Text } = Typography;

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

const normalizeViewMode = (value?: string) => {
  return value?.toLowerCase() === "card" ? "card" : "table";
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

const isRunningStatus = (status?: string) => /running|started|active/i.test(status || "");

const isStoppedStatus = (status?: string) => /stopped|exited|failed|terminated|created/i.test(status || "");

const getStatusColor = (status?: string) => {
  if (isRunningStatus(status)) {
    return "success";
  }
  if (isStoppedStatus(status)) {
    return "default";
  }
  return "processing";
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
  project_id: projectIdProp,
  analysis_node_id,
  analysis_node_name,
  container_template_id,
  name,
  status,
  workspace_path,
  page_size,
  view_mode,
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
  const [onlyCurrentProject, setOnlyCurrentProject] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const selectable = Boolean(onOk || onCancel);
  const activeViewMode = normalizeViewMode(view_mode);
  const isCardMode = activeViewMode === "card";
  const { containerURL } = useSelector((state: any) => state.user);
  // const resolvedProjectID = normalizeText(projectIdProp) || normalizeText(currentProjectID);

  // 左侧栏纵向堆叠形态（由 container-template-stack 注入）：没有卡片外壳，
  // 只渲染列表主体，标题栏 / 折叠由堆叠布局负责。
  const isStackPanel = Boolean(onToggleCollapse);

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
      // project_id: onlyCurrentProject ? resolvedProjectID : undefined,
      analysis_node_id: normalizeText(analysis_node_id),
      container_template_id: normalizeText(container_template_id),
      name: normalizeText(name),
      status: normalizeText(status),
      workspace_path: normalizeText(workspace_path),
    });
  }, [
    id,
    onlyCurrentProject,
    // resolvedProjectID,
    analysis_node_id,
    container_template_id,
    name,
    status,
    workspace_path,
    setQuery,
  ]);

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

  const runAction = async (action: "start" | "stop" | "recreate" | "delete", item: AppSessionItem) => {
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
  };

  const handleDescribe = async (record: AppSessionItem) => {
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
  };

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

  const renderOperationButtons = (record: AppSessionItem, compact = false) => {
    const itemStatus = record.status || "";
    const startKey = `start-${record.id}`;
    const stopKey = `stop-${record.id}`;
    const recreateKey = `recreate-${record.id}`;
    const deleteKey = `delete-${record.id}`;
    const appUrl = buildAppUrl(containerURL, record);

    return (
      <Space size={compact ? 2 : 4} wrap>
        <Tooltip title={`${appUrl}`}>
          <Button
            size="small"
            type="link"
            disabled={!isRunningStatus(itemStatus) || !appUrl}
            onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
          >
            Open
          </Button>
        </Tooltip>

        <Tooltip title="Open an interactive terminal for this app session">
          <Button size="small" type="link" onClick={() => openTerminalTab(record)}>
            Terminal
          </Button>
        </Tooltip>

        <Button
          size="small"
          type="link"
          disabled={!record.container_instance_id}
          onClick={() => handleDescribe(record)}
        >
          Describe
        </Button>

        <Button
          size="small"
          type="link"
          disabled={isRunningStatus(itemStatus)}
          loading={pendingAction === startKey}
          onClick={() => runAction("start", record)}
        >
          Start
        </Button>
        <Button
          size="small"
          type="link"
          disabled={isStoppedStatus(itemStatus)}
          loading={pendingAction === stopKey}
          onClick={() => runAction("stop", record)}
        >
          Stop
        </Button>
        <Popconfirm
          title="Recreate this app session container?"
          description="This will delete and create a new container for this app session."
          onConfirm={() => runAction("recreate", record)}
          okButtonProps={{ loading: pendingAction === recreateKey }}
        >
          <Button size="small" type="link" loading={pendingAction === recreateKey}>
            Recreate
          </Button>
        </Popconfirm>
        <Popconfirm
          title="Delete this app session?"
          onConfirm={() => runAction("delete", record)}
          okButtonProps={{ loading: pendingAction === deleteKey }}
        >
          <Button size="small" type="link" danger loading={pendingAction === deleteKey}>
            Delete
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  const columns = useMemo<ColumnsType<AppSessionItem>>(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        width: 220,
        ellipsis: true,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (value: string) => value || "-",
      },
      {
        title: "Project ID",
        dataIndex: "project_id",
        key: "project_id",
        width: 160,
        render: (value: string) => value || "-",
      },
      {
        title: "Node Name",
        dataIndex: "node_name",
        key: "node_name",
        width: 180,
        ellipsis: true,
        render: (value?: string) => value?.trim() || "-",
      },
      {
        title: "Template ID",
        dataIndex: "container_template_id",
        key: "container_template_id",
        width: 180,
        render: (value: string) => value || "-",
      },
      {
        title: "Workspace",
        dataIndex: "workspace_path",
        key: "workspace_path",
        ellipsis: true,
        render: (value: string) => value || "-",
      },
      {
        title: "Started At",
        dataIndex: "started_at",
        key: "started_at",
        width: 200,
        render: (value: string) => formatRelativeTime(value, locale),
      },
      {
        title: "Stopped At",
        dataIndex: "stopped_at",
        key: "stopped_at",
        width: 200,
        render: (value: string) => formatRelativeTime(value, locale),
      },
      {
        title: "Created At",
        dataIndex: "created_at",
        key: "created_at",
        width: 210,
        render: (value: string) => formatRelativeTime(value, locale),
      },
    ],
    [locale]
  );

  const selectColumns = useMemo<ColumnsType<AppSessionItem>>(() => {
    const actionColumns: ColumnsType<AppSessionItem> = [
      {
        title: "Operation",
        key: "operation",
        width: 400,
        fixed: "right",
        render: (_: unknown, record) => renderOperationButtons(record),
      },
    ];

    if (!selectable) {
      return [...columns, ...actionColumns];
    }

    return [
      ...columns,
      ...actionColumns,
      {
        title: "Select",
        key: "select_action",
        width: 120,
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
    ];
  }, [selectable, selectedId, renderOperationButtons, columns]);

  /**
   * 左侧栏（堆叠形态）的紧凑列：与容器模板列表 / 终端会话列表同一视觉语言 ——
   * 标题 + 次要信息一行，右侧悬停出现操作按钮，不显示宽表格的字段列。
   */
  const sidebarColumns = useMemo<ColumnsType<AppSessionItem>>(
    () => [
      {
        title: "Session",
        dataIndex: "name",
        key: "name",
        ellipsis: { showTitle: false },
        render: (_: unknown, record) => {
          const displayName = record.name || record.id || "-";
          const meta = [
            record.status,
            record.node_name?.trim(),
            record.started_at ? formatRelativeTime(record.started_at, locale) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <AppstoreOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip title={record.id || "-"} placement="left">
                  <span className="project-report-item-title">{displayName}</span>
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
        title: "Status",
        key: "status",
        width: 92,
        align: "center",
        render: (_: unknown, record) => (
          <Tag color={getStatusColor(record.status)} style={{ marginInlineEnd: 0 }}>
            {record.status || "unknown"}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 214,
        align: "right",
        render: (_: unknown, record) => {
          const appUrl = buildAppUrl(containerURL, record);
          const running = isRunningStatus(record.status);
          const stopped = isStoppedStatus(record.status);
          return (
            <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
              <Tooltip title="Terminal">
                <Button
                  type="text"
                  size="small"
                  icon={<CodeOutlined />}
                  onClick={() => openTerminalTab(record)}
                />
              </Tooltip>
              <Tooltip title="Open">
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  disabled={!running || !appUrl}
                  onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
                />
              </Tooltip>
              <Tooltip title="Describe">
                <Button
                  type="text"
                  size="small"
                  icon={<InfoCircleOutlined />}
                  disabled={!record.container_instance_id}
                  onClick={() => handleDescribe(record)}
                />
              </Tooltip>
              <Tooltip title="Start">
                <Button
                  type="text"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  disabled={running}
                  loading={pendingAction === `start-${record.id}`}
                  onClick={() => runAction("start", record)}
                />
              </Tooltip>
              <Tooltip title="Stop">
                <Button
                  type="text"
                  size="small"
                  icon={<PauseCircleOutlined />}
                  disabled={stopped}
                  loading={pendingAction === `stop-${record.id}`}
                  onClick={() => runAction("stop", record)}
                />
              </Tooltip>
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
    [containerURL, locale, pendingAction, runAction, handleDescribe, openTerminalTab]
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
   * 左侧栏（堆叠形态）的标题栏动作：与容器模板列表 / 终端会话列表一致，
   * 只保留图标按钮，避免在窄侧边栏里撑破标题栏。
   */
  const sidebarActions = (
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
      <Tooltip title="Refresh">
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          loading={isFetching}
          onClick={() => refetch()}
        />
      </Tooltip>
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
    </>
  );

  /** 标题栏右上角动作按钮（卡片形态与堆叠形态共用）。 */
  const headerActions = (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenTemplatePage}>
        Create
      </Button>
      {normalizeText(analysis_node_id) && (
        <Button
          type="default"
          onClick={handleCreateByAnalysisNode}
          loading={creatingFromAnalysisNode}
        >
          Create from Analysis Node
        </Button>
      )}
      {/* <Space size={6}>
        <Text type="secondary">Only current project</Text>
        <Switch
          size="small"
          checked={onlyCurrentProject}
          onChange={(checked) => {
            setOnlyCurrentProject(checked);
            setPage(1);
          }}
          disabled={!resolvedProjectID}
        />
      </Space> */}
      <Text type="secondary">Total: {total}</Text>
      <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
        Refresh
      </Button>
    </Space>
  );

  /** 列表主体：卡片形态与堆叠形态共用。 */
  const listBody = (
    <>
      {contextHolder}
      {isCardMode ? (
        <>
        
          {data.length > 0 ? (
            <Flex vertical gap={8}>
              {data.map((record) => (
                <Card
                  key={record.id}
                  size="small"
                  style={{
                    borderColor: record.id === selectedId ? "#1677ff" : undefined,
                    background: record.id === selectedId ? "#f0f7ff" : undefined,
                  }}
                  bodyStyle={{ padding: 10 }}
                >
                  <Flex vertical gap={6}>
                    <Flex justify="space-between" align="flex-start" gap={8}>
                      {/* <Space size={2} style={{ minWidth: 0, flex: 1 }}> */}
                      <Text strong ellipsis={{ tooltip: record.id || "-" }}>
                        {record.name || "-"}
                      </Text>

                      <Tag color={getStatusColor(record.status)} style={{ marginInlineEnd: 0 }}>
                        {record.status || "unknown"}
                      </Tag>
                      {/* </Space> */}

                      {/* {selectable && (
                        <Button
                          type={record.id === selectedId ? "primary" : "default"}
                          size="small"
                          onClick={() => setSelectedID(record.id)}
                        >
                          {record.id === selectedId ? "Selected" : "Select"}
                        </Button>
                      )} */}
                    </Flex>

                    <Space direction="vertical" size={1} style={{ width: "100%" }}>
                      {/* <Text type="secondary" ellipsis={{ tooltip: record.project_id || "-" }}>
                        Project: {record.project_id || "-"}
                      </Text> */}
                      {normalizeText(record.node_name) && (
                        <Text type="secondary" ellipsis={{ tooltip: record.node_name || "-" }}>
                          Node: {record.node_name}
                        </Text>
                      )}
                      <Tooltip title={record.container_instance_id || "-"}>
                        <Text type="secondary" ellipsis={{ tooltip: record.container_instance_name || "-" }}>
                          Container Instance: {record.container_instance_name || "-"}
                        </Text>
                      </Tooltip>
                      {/* <Text type="secondary" ellipsis={{ tooltip: record.workspace_path || "-" }}>
                        Workspace: {record.workspace_path || "-"}
                      </Text> */}
                      <Text type="secondary">
                        Started: {formatRelativeTime(record.started_at, locale)}
                      </Text>
                      <Text type="secondary">
                        Created: {formatRelativeTime(record.created_at, locale)}
                      </Text>
                    </Space>

                    <Flex align="center" justify="space-between" wrap gap={4}>
                      {renderOperationButtons(record, true)}
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>
          ) : (
            <Empty description={error ? "Failed to load app sessions" : "No app sessions"} />
          )}

          <Flex justify="end" style={{ marginTop: 12 }}>
            <Pagination
              size="small"
              responsive
              showLessItems
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
              onChange={(nextPage, nextPageSize) => {
                if (nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                }
                setPage(nextPage);
              }}
              showTotal={(value) => `Total ${value} items`}
            />
          </Flex>
        </>
      ) : (
        <Table<AppSessionItem>
          rowKey="id"
          columns={selectColumns}
          dataSource={data}
          loading={isLoading || isFetching}
          size="small"
          scroll={{ x: 1500 }}
          locale={{ emptyText: error ? "Failed to load app sessions" : "No app sessions" }}
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
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200, 500, 1000],
            onChange: (nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
              }
              setPage(nextPage);
            },
            showTotal: (value) => `Total ${value} items`,
          }}
        />
      )}

      {selectable && (
        <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
            Confirm
          </Button>
        </Flex>
      )}
    </>
  );

  // 堆叠形态（左侧栏）：与容器模板列表 / 终端会话列表保持同一套面板骨架 +
  // 同样的紧凑行样式（不渲染 Card，也不渲染宽表格）。
  if (isStackPanel) {
    return (
      <div className={`project-report-panel${collapsed ? " is-collapsed" : ""}`}>
        <div className="project-report-panel-header">
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
          <div className="project-report-panel-actions">{sidebarActions}</div>
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
              columns={sidebarColumns}
              dataSource={data}
              loading={isLoading || isFetching}
              pagination={false}
              showHeader={false}
              rowClassName={(record) =>
                String(record.id) === String(selectedId) ? "project-report-row-selected" : ""
              }
              onRow={
                selectable
                  ? (record) => ({ onClick: () => setSelectedID(record.id) })
                  : undefined
              }
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
  }

  return (
    <Card size="small" title={title || "App Session List"} extra={headerActions}>
      {listBody}
    </Card>
  );
};

export default AppSessionPage;

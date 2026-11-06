import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Switch,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CodeOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  closeContainerTerminalSessionApi,
  createContainerTerminalSessionApi,
  execContainerTerminalSessionApi,
} from "@/api/container-template-terminal";
import type { ContainerTemplateItem } from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useContainerTerminalSessionListQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { closeBottomTab, openBottomTerminal } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";
import type { ContainerTerminalSessionItem } from "@/api/container-template-terminal";

export interface ContainerTerminalSessionListProps {
  title?: string;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

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

/** 会话状态标签：busy > 有订阅者 > 存活。 */
const statusTag = (item: ContainerTerminalSessionItem) => {
  if (item.busy) {
    return <Tag color="processing">Running</Tag>;
  }
  if (item.subscribers > 0) {
    return <Tag color="success">Attached</Tag>;
  }
  return <Tag color="default">Idle</Tag>;
};

/** 悬停标题时展示的会话详情卡片。 */
const SessionDetailCard = ({ item }: { item: ContainerTerminalSessionItem }) => (
  <div style={{ width: 360 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "session_id", label: "Session ID", children: item.session_id || "-" },
        { key: "template_id", label: "Template ID", children: item.template_id || "-" },
        { key: "image_name", label: "Image", children: item.image_name || "-" },
        { key: "app_type", label: "App Type", children: item.app_type || "-" },
        { key: "runtime", label: "Runtime", children: item.runtime_name || "-" },
        {
          key: "runtime_id",
          label: "Runtime ID",
          children: item.runtime_id ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.runtime_id}</span>
          ) : (
            "-"
          ),
        },
        { key: "subscribers", label: "Subscribers", children: item.subscribers },
        { key: "seq", label: "Output Seq", children: item.seq },
        { key: "persistent", label: "Persistent", children: item.persistent ? "yes" : "no" },
        {
          key: "last_active",
          label: "Last Active",
          children: item.last_active ? new Date(item.last_active).toLocaleString() : "-",
        },
      ]}
    />
  </div>
);

/** 「运行命令」弹窗的目标：终端会话列表里的一行（命令只能投递到已存在的会话）。 */
type RunTarget = {
  sessionId: string;
  name: string;
  command?: string;
};

/**
 * 「终端会话」列表（左侧栏面板形态）。
 *
 * 数据来自 `GET /container/terminal/session/list`：后端把进程内会话注册表里的会话
 * 与容器模板绑定行 join 起来（`DisplayName` / `ImageName`），并附带
 * `TerminalSessionStatus`（存活 / 订阅者 / running / 序号）。
 *
 * - 标题栏「+」按钮：通过 invoke 打开容器模板列表选择模板 → 创建（或复用）该模板的
 *   终端会话 → 在底部面板打开对应标签；
 * - 点击行：在底部面板打开（或聚焦）同名终端标签，与容器模板列表的点击行为一致；
 * - 右侧 Terminal 按钮：同上（显式图标入口）；
 * - 右侧 Run 按钮：以 invoke 方式打开「Run in terminal」弹窗，把命令投递到该会话；
 * - 右侧 Delete 按钮：删除会话（后端关闭 shell 并删除容器）并关闭对应的底部标签。
 */
const ContainerTerminalSessionList = ({
  title,
  collapsed = false,
  onToggleCollapse,
}: ContainerTerminalSessionListProps) => {
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const { register, unregister } = useComponentStore();
  const [deletingId, setDeletingId] = useState<string>();
  const [creating, setCreating] = useState(false);
  // 「运行命令」弹窗：命令写入该模板的持久终端（同一模板复用同一个容器），
  // 提交后自动打开底部终端标签，输出通过该终端的 WebSocket 实时显示。
  const [runTarget, setRunTarget] = useState<RunTarget | null>(null);
  const [runCommand, setRunCommand] = useState("");
  const [runSubmitting, setRunSubmitting] = useState(false);
  // 默认只显示当前激活项目下的会话（后端用 GetActiveProjectByUserID 过滤）。
  const [onlyCurrentProject, setOnlyCurrentProject] = useState(true);
  // 不轮询：会话增删由后端 component.invoke 实时事件驱动（含 shell 退出 / TTL 回收）。
  const { data = [], isLoading, isFetching, refetch } = useContainerTerminalSessionListQuery({
    allProjects: !onlyCurrentProject,
    staleTime: 5_000,
  });

  // 切换过滤条件后重新拉取，避免短时间内看到上一份缓存。
  useEffect(() => {
    refetch();
  }, [onlyCurrentProject, refetch]);

  // 会话增删 / 状态变化都由后端实时通道推送（含 shell 退出、TTL 回收、手动删除），
  // 面板据此刷新，不再轮询。
  //
  // - sessionCreated / sessionDeleted：会话增删；
  // - sessionRunning / sessionIdle：命令开始 / 结束（busy）；
  // - sessionAttached / sessionDetached：WebSocket 接入 / 断开（subscribers）。
  //
  // 一次 terminal_exec 往往会连续推 attached + running（结束时再推 idle + detached），
  // 所以状态事件用短防抖合并成一次 refetch，避免多个请求打满后端。
  const refetchTimer = useRef<number | undefined>(undefined);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) {
      window.clearTimeout(refetchTimer.current);
    }
    refetchTimer.current = window.setTimeout(() => {
      refetchTimer.current = undefined;
      refetch();
    }, 300);
  }, [refetch]);

  useEffect(
    () => () => {
      if (refetchTimer.current) {
        window.clearTimeout(refetchTimer.current);
      }
    },
    []
  );

  const realtimeInstance = useMemo(
    () => ({
      sessionCreated: (_args?: any) => {
        refetch();
      },
      sessionDeleted: (_args?: any) => {
        refetch();
      },
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
    // 终端会话就是应用会话：后端已把所有会话事件统一经
    // manager.AppSessionEventHandler 以 category=app-session 推下来。
    register("app-session", "*", realtimeInstance);
    return () => {
      unregister("app-session", "*", realtimeInstance);
    };
  }, [register, unregister, realtimeInstance]);

  /**
   * 按「终端会话 ID」打开底部终端标签。
   *
   * 终端会话由后端 create 接口创建（容器已启动），key 为 `terminal:<sessionId>`，
   * 重复点击同一会话只聚焦已有标签，不会重复连接。同一模板可以有多条会话，
   * 因此这里必须用会话 ID 而不是模板 ID。
   */
  const openSessionTerminal = useCallback(
    (sessionId: string, displayName?: string) => {
      if (!sessionId) {
        return;
      }
      openBottomTerminal(sessionId, displayName);
    },
    []
  );

  /** 打开会话行对应的底部终端标签。 */
  const openTerminalTab = useCallback(
    (record: ContainerTerminalSessionItem) => {
      if (!record.session_id) {
        return;
      }
      openSessionTerminal(record.session_id, record.name);
    },
    [openSessionTerminal]
  );

  /** 删除会话：先调后端（关 shell + 删容器），再关掉前端标签。 */
  const handleDelete = useCallback(
    async (record: ContainerTerminalSessionItem) => {
      if (!record.session_id) {
        return;
      }
      setDeletingId(record.session_id);
      try {
        // 这里是「显式释放」的唯一入口：关闭 shell 并删除容器。
        // closeBottomTab 只关闭前端标签，不会调用删除接口。
        await closeContainerTerminalSessionApi(record.session_id);
        closeBottomTab(`terminal:${record.session_id}`);
        message.success("Terminal session closed");
        // 后端会在 CloseSession 时推送 sessionDeleted；这里再拉一次做即时反馈。
        refetch();
      } catch (error) {
        message.error(getErrorMessage(error, "Failed to close terminal session"));
      } finally {
        setDeletingId(undefined);
      }
    },
    [message, refetch]
  );

  /**
   * 标题栏「+」：invoke 打开容器模板列表选模板，先在后端新建终端会话（创建即启动容器），
   * 再用返回的会话 ID 打开底部终端标签。
   *
   * 与旧实现的区别：会话创建与 WebSocket 连接分开——先 create 拿到 session_id，
   * 因此每一步都在「终端会话列表」里可见、可关闭；一个模板可以建多条会话。
   */
  const handleCreateSession = useCallback(async () => {
    let selected: ContainerTemplateItem | undefined;
    try {
      selected = (await invoke.containerTemplatePage.openAsync(
        {},
        { title: "Select Container Template", width: 1200, footer: false }
      )) as ContainerTemplateItem | undefined;
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
      return;
    }
    if (!selected?.id) {
      return;
    }

    setCreating(true);
    try {
      const created = (await createContainerTerminalSessionApi({
        container_template_id: selected.id,
      })).data;
      openSessionTerminal(
        created.session_id,
        created.name || selected.display_name || selected.name || String(selected.id),
      );
      message.success("Terminal session created");
      refetch();
    } catch (error) {
      message.error(getErrorMessage(error, "Failed to create terminal session"));
    } finally {
      setCreating(false);
    }
  }, [message, openSessionTerminal, refetch]);

  /** 打开「Run in terminal」弹窗（命令写入该会话的持久终端）。 */
  const handleOpenRun = useCallback((target: RunTarget) => {
    setRunTarget(target);
    setRunCommand(target.command?.trim() || "pwd");
  }, []);

  const handleSubmitRun = useCallback(async () => {
    if (!runTarget) {
      return;
    }
    const command = runCommand.trim();
    if (!command) {
      message.warning("Please input a command");
      return;
    }
    setRunSubmitting(true);
    try {
      // 命令只投递到「已存在的终端会话」：会话由列表里的「新建」创建（容器已启动）。
      await execContainerTerminalSessionApi(runTarget.sessionId, {
        command,
        wait_seconds: 0,
      });
      openSessionTerminal(runTarget.sessionId, runTarget.name);
      message.success("Command submitted to terminal");
      setRunTarget(null);
      refetch();
    } catch (error) {
      message.error(getErrorMessage(error, "Failed to run command"));
    } finally {
      setRunSubmitting(false);
    }
  }, [message, openSessionTerminal, refetch, runCommand, runTarget]);

  const columns = useMemo<ColumnsType<ContainerTerminalSessionItem>>(
    () => [
      {
        title: "Session",
        dataIndex: "display_name",
        key: "display_name",
        ellipsis: { showTitle: false },
        render: (_: unknown, record) => {
          const displayName = record.display_name || record.session_id;
          const meta = [
            record.image_name,
            record.app_type,
            record.last_active ? formatRelativeTime(record.last_active, locale) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <CodeOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在悬停标题时出现，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CodeOutlined />
                      {displayName}
                    </span>
                  }
                  content={<SessionDetailCard item={record} />}
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
        title: "Status",
        key: "status",
        width: 92,
        align: "center",
        render: (_: unknown, record) => statusTag(record),
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        align: "right",
        render: (_: unknown, record) => (
          <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Terminal">
              <Button
                type="text"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => openTerminalTab(record)}
              />
            </Tooltip>
            <Tooltip title="Run in terminal">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() =>
                  handleOpenRun({
                    sessionId: record.session_id,
                    name:
                      record.display_name || record.template_name || record.session_id,
                  })
                }
              />
            </Tooltip>
            <Popconfirm
              title="Close this terminal?"
              description="The container will be deleted."
              onConfirm={() => handleDelete(record)}
              okButtonProps={{ loading: deletingId === record.session_id }}
            >
              <Tooltip title="Close session & delete container">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </span>
        ),
      },
    ],
    [locale, deletingId, openTerminalTab, handleDelete, handleOpenRun]
  );

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
            <span>{title || "Terminal Sessions"}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title || "Terminal Sessions"}</span>
        )}
        <div className="project-report-panel-actions">
          <Tooltip title="New terminal session">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              loading={creating}
              onClick={handleCreateSession}
            />
          </Tooltip>
          <Tooltip
            title={
              onlyCurrentProject
                ? "Showing sessions of the current project only"
                : "Showing sessions of all projects"
            }
          >
            <Switch
              size="small"
              checked={onlyCurrentProject}
              onChange={setOnlyCurrentProject}
              checkedChildren="Current"
              unCheckedChildren="All"
            />
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
        </div>
      </div>

      <div className="project-report-panel-body" style={collapsed ? { display: "none" } : undefined}>
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              onlyCurrentProject ? "No terminal session in current project" : "No terminal session"
            }
          />
        ) : (
          <Table<ContainerTerminalSessionItem>
            rowKey="session_id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            onRow={(record) => ({
              onClick: () => openTerminalTab(record),
            })}
          />
        )}
      </div>

      <Modal
        open={Boolean(runTarget)}
        title={`Run in terminal - ${runTarget?.name ?? ""}`}
        okText="Run"
        confirmLoading={runSubmitting}
        onOk={handleSubmitRun}
        onCancel={() => setRunTarget(null)}
        destroyOnClose
      >
        <Input.TextArea
          autoSize={{ minRows: 4, maxRows: 12 }}
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="例如：R --version"
          style={{ fontFamily: '"Menlo", "Consolas", monospace', fontSize: 13 }}
          onPressEnter={(e) => {
            // Enter 直接提交；Shift+Enter 换行。
            if (!e.shiftKey) {
              e.preventDefault();
              void handleSubmitRun();
            }
          }}
        />
        <div style={{ marginTop: 8, color: "var(--ant-color-text-secondary)", fontSize: 12 }}>
          命令会写入所选终端会话（会话在「新建」时已创建容器），提交后自动打开底部终端面板。
        </div>
      </Modal>
    </div>
  );
};

export default ContainerTerminalSessionList;

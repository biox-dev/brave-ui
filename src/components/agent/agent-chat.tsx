import { FC, useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Flex, Input, Popconfirm, Select, Space, Spin, Tag, Tooltip, Typography } from "antd";
import {
  CheckOutlined,
  ClearOutlined,
  CloseOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import {
  AgentPermissionStatus,
  AgentTaskStatus,
  approveAgentPermissionApi,
  cancelAgentTaskApi,
  chatAgentApi,
  denyAgentPermissionApi,
  describeAgentEnvApi,
  getAgentPendingPermissionsApi,
  getAgentTaskApi,
  getAgentTaskEventsApi,
  getConversationApi,
  listAgentProfileApi,
  pageConversationApi,
  type AgentConversationItem,
  type AgentEnvInfo,
  type AgentEventItem,
  type AgentPermissionItem,
  type AgentProfileItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";
import { useDispatch, useSelector } from "react-redux";
import { Popover } from "antd/lib";
import { updateUserProfileApi } from "@/api/auth";
import { setUserItem } from "@/store/userSlice";

const { Text } = Typography;

/**
 * 后端 WS 推送的 agent 事件信封（对应 handler.agentWSEvent）。
 */
interface AgentWSMessage {
  type?: string;
  task_id?: string;
  event?: AgentEventItem;
}

/**
 * Agent 流式事件 payload（对应 agent.StreamEvent），仅在 type === "stream" 时出现。
 */
interface StreamEventPayload {
  type?: string;
  content?: string;
  [key: string]: unknown;
}

// 任务终态事件类型。
const TERMINAL_EVENT_TYPES = new Set(["task.completed", "task.failed", "task.canceled"]);

// 本地聊天消息（user / assistant 气泡）。
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

// 生成会话在切换下拉中的显示标签：优先取首条用户消息，过长则截断。
function conversationLabel(c: AgentConversationItem): string {
  const first = c.messages?.find((m) => m.role === "user");
  const title = first?.content?.trim();
  if (title) {
    return title.length > 30 ? `${title.slice(0, 30)}…` : title;
  }
  return c.id;
}

// 活跃轮次（running / waiting_permission）的中间态，按 taskID 索引，
// 跨会话切换与浏览器刷新保留，以便恢复实时流。
interface ActiveTurn {
  taskId: string;
  convId: string;
  streaming: string; // 累积的 assistant 文本增量
  waiting: boolean; // 是否处于等待权限状态
  sending: boolean; // 是否有一轮进行中
}

interface AgentChatProps {
  /** 初始会话 ID；传入则续接已有历史。 */
  conversationId?: string;
  /** 由 invoke 系统注入：关闭承载该视图的 Modal / Drawer。 */
  onCancel?: () => void;
}

/**
 * Agent 多轮对话 UI。
 *
 * 职责：
 *   - 发送消息：调用 POST /agent/chat，拿到 task_id + conversation_id；
 *   - 通过全局 WS（HybridRealtimeClient）订阅当前 task 的 agent.event，
 *     把 stream 事件里的 text 增量聚合成 assistant 回复；
 *   - 任务到达终态（completed / failed / canceled）时，把回复固化到消息列表，
 *     以便发起下一轮。
 *
 * 历史恢复：发送后先按 task_id 增量拉取事件（GetTaskEvents），
 * 避免错过 WS 推送早于 HTTP 响应的早期文本；实时与历史按 id + sequence 去重。
 */
const AgentChat: FC<AgentChatProps> = ({ conversationId: initialConversationId, onCancel }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  // 业务上下文：由页面通过 setLLMEnv(id, type) 设置，发送时一并传给后端解析系统提示词与工作目录。
  const llmEnv = useSelector((state: any) => state.user.llmEnv);
  // 当前登录用户：Agent Profile 只能来自 userInfo（切换时同步更新 UserState）。
  const userInfo = useSelector((state: any) => state.user.userInfo);
  const dispatch = useDispatch();
  // 解析后的人类可读上下文（类型 + 名称 + 工作目录），用于顶部展示当前对话环境。
  const [envInfo, setEnvInfo] = useState<AgentEnvInfo | null>(null);
  // 可选 AgentProfile 列表（为空表示使用默认 Profile）。
  const [profiles, setProfiles] = useState<AgentProfileItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // 当前选中会话是否有一轮进行中（running / waiting_permission）。
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // 当前选中会话正在流式输出的 assistant 文本（未固化到 messages）。
  const [streaming, setStreaming] = useState("");
  // 当前用户的会话列表（用于切换）。
  const [conversations, setConversations] = useState<AgentConversationItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // 当前选中会话活跃任务的待确认权限（可同时存在多个）。
  const [pendingPermissions, setPendingPermissions] = useState<AgentPermissionItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string>();
  // 当前进行中的任务 ID（用于 Cancel 按钮）。
  const [currentTaskId, setCurrentTaskId] = useState<string>();
  const [canceling, setCanceling] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  // 当前选中的会话 ID（ref 镜像，供 WS 回调读取最新值）。
  const selectedConvIdRef = useRef<string | undefined>(initialConversationId);
  // 活跃轮次表：taskID → 该轮次中间态，跨会话切换与浏览器刷新保留。
  const activeTurnsRef = useRef<Map<string, ActiveTurn>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  // 自动滚动到底部。
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, waiting]);

  // 当前业务上下文变化时，向后端解析人类可读的名称（如节点名/报告标题）用于展示。
  useEffect(() => {
    let cancelled = false;
    describeAgentEnvApi(llmEnv ?? null)
      .then((res) => {
        if (!cancelled) setEnvInfo(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setEnvInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [llmEnv]);

  // 加载会话列表（挂载时 + 轮次结束时刷新）。
  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const res = await pageConversationApi({ page: 1, page_size: 100 });
      setConversations(res.data?.data ?? []);
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setLoadingConversations(false);
    }
  };

  // 把后端消息映射为本地气泡。
  const mapMessages = (conv: AgentConversationItem): ChatMessage[] =>
    conv.messages.map((m, i) => ({
      id: `${conv.id}-${i}`,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

  // 拉取任务待确认的权限请求（仅保留 pending 状态）。
  const loadPermissions = async (taskId: string) => {
    if (!taskId) return;
    try {
      const res = await getAgentPendingPermissionsApi(taskId);
      const items = res.data ?? [];
      setPendingPermissions(items.filter((p) => p.status === AgentPermissionStatus.Pending));
    } catch {
      // API errors are shown globally by the http interceptor.
    }
  };

  const handleApprove = async (perm: AgentPermissionItem) => {
    setResolvingId(perm.id);
    try {
      await approveAgentPermissionApi(perm.id);
      getGlobalMessage()?.success("Permission approved");
      await loadPermissions(perm.task_id);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  const handleDeny = async (perm: AgentPermissionItem) => {
    setResolvingId(perm.id);
    try {
      await denyAgentPermissionApi(perm.id);
      getGlobalMessage()?.success("Permission denied");
      await loadPermissions(perm.task_id);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  // 取消当前进行中的任务（终态事件会通过 WS 触发 finalizeTurn 清理状态）。
  const handleCancelTask = async () => {
    if (!currentTaskId) return;
    setCanceling(true);
    try {
      await cancelAgentTaskApi(currentTaskId);
      getGlobalMessage()?.success("Task canceled");
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setCanceling(false);
    }
  };

  const renderOperation = (op: AgentPermissionItem["operation"]) => {
    if (!op) return "-";
    return op.path || op.command || op.content || "-";
  };

  // 切换会话：加载对应消息；若存在活跃轮次则恢复实时流。
  const handleSwitchConversation = async (id: string) => {
    if (!id || id === conversationId) return;
    try {
      const res = await getConversationApi(id);
      const conv = res.data;

      selectedConvIdRef.current = conv.id;
      setConversationId(conv.id);
      setMessages(mapMessages(conv));

      const taskId = conv.current_task_id;
      if (!taskId) {
        setCurrentTaskId(undefined);
        setStreaming("");
        setSending(false);
        setWaiting(false);
        setPendingPermissions([]);
        return;
      }

      // 已有活跃轮次：复用或新建。
      let turn = activeTurnsRef.current.get(taskId);
      if (!turn) {
        turn = { taskId, convId: conv.id, streaming: "", waiting: false, sending: true };
        activeTurnsRef.current.set(taskId, turn);
        try {
          const t = await getAgentTaskApi(taskId);
          const st = t.data.status;
          if (
            st === AgentTaskStatus.Completed ||
            st === AgentTaskStatus.Failed ||
            st === AgentTaskStatus.Canceled
          ) {
            // 任务已终态：清掉活跃轮次，不再恢复。
            activeTurnsRef.current.delete(taskId);
            setCurrentTaskId(undefined);
            setStreaming("");
            setSending(false);
            setWaiting(false);
            setPendingPermissions([]);
            return;
          }
          turn.waiting = st === AgentTaskStatus.WaitingPermission;
        } catch {
          // 查询任务失败时按 running 处理，避免丢失实时流。
        }
      }

      setCurrentTaskId(taskId);
      setStreaming(turn.streaming);
      setSending(turn.sending);
      setWaiting(turn.waiting);

      // 恢复该任务待确认的权限，保证刷新后切换到会话时按钮仍在。
      loadPermissions(taskId);
    } catch {
      // 错误由全局拦截器提示。
    }
  };

  useEffect(() => {
    loadConversations();
    // 加载可选 AgentProfile（供下拉选择，为空表示使用默认）。
    listAgentProfileApi()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => setProfiles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 轮次结束：把 assistant 回复固化到消息列表（若为选中会话），并清理活跃轮次。
  const finalizeTurn = (turn: ActiveTurn, type: string) => {
    const selected = turn.convId === selectedConvIdRef.current;
    if (selected) {
      const content = turn.streaming;
      if (content.trim() || type === "task.failed") {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${turn.taskId}`,
            role: "assistant",
            content: type === "task.failed" ? content || "(agent error)" : content,
            error: type === "task.failed",
          },
        ]);
      }
      setCurrentTaskId(undefined);
      setStreaming("");
      setSending(false);
      setWaiting(false);
      setPendingPermissions([]);
    }
    activeTurnsRef.current.delete(turn.taskId);
    // 本轮结束后刷新会话列表（标题 / 顺序 / 消息数可能变化）。
    loadConversations();
  };

  // 统一处理一个任务事件（实时 WS 推送与历史恢复共用）。
  const applyEvent = (ev: AgentEventItem) => {
    const turn = activeTurnsRef.current.get(ev.task_id);
    if (!turn) return;

    const key = `${ev.id ?? ""}:${ev.sequence ?? ""}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const selected = turn.convId === selectedConvIdRef.current;

    if (ev.type === "stream") {
      const payload = (ev.payload ?? {}) as StreamEventPayload;
      if (payload.type === "text" && payload.content) {
        turn.streaming += payload.content;
        if (selected) setStreaming(turn.streaming);
      }
      return;
    }
    if (ev.type === "task.waiting") {
      turn.waiting = true;
      if (selected) setWaiting(true);
      return;
    }
    if (ev.type === "permission.created" || ev.type === "permission.resolved") {
      // 权限创建 / 解决后刷新待确认权限，保证按钮实时出现 / 消失。
      if (selected) loadPermissions(ev.task_id);
      return;
    }
    if (ev.type && TERMINAL_EVENT_TYPES.has(ev.type)) {
      finalizeTurn(turn, ev.type);
    }
  };

  // 全局订阅 WS：把 agent.event 路由到对应活跃轮次。
  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event" || !msg.event) return;
      applyEvent(msg.event);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换 Profile：先持久化到后端当前用户，再同步更新 Redux 中的 userInfo。
  const handleProfileChange = async (value?: string) => {
    const next = value ?? "";
    try {
      await updateUserProfileApi(next);
    } catch {
      return; // 错误由全局拦截器提示，不更新本地状态。
    }
    if (userInfo) {
      dispatch(setUserItem({ userInfo: { ...userInfo, profile: next } }));
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: text }]);
    setSending(true);
    setWaiting(false);
    setStreaming("");

    try {
      const res = await chatAgentApi({
        conversation_id: conversationId,
        message: text,
        env: llmEnv ?? undefined,
      });
      const { task_id, conversation_id } = res.data;

      selectedConvIdRef.current = conversation_id;
      setConversationId(conversation_id);

      // 登记本轮活跃状态，供切换 / 刷新后恢复。
      const turn: ActiveTurn = {
        taskId: task_id,
        convId: conversation_id,
        streaming: "",
        waiting: false,
        sending: true,
      };
      activeTurnsRef.current.set(task_id, turn);
      seenRef.current.clear();
      setCurrentTaskId(task_id);

      // 本轮任务可能很快进入等待权限，提前拉取待确认权限。
      loadPermissions(task_id);

      // 恢复可能在 HTTP 响应前就已推送的早期事件（与实时推送按 id+sequence 去重）。
      try {
        const evRes = await getAgentTaskEventsApi(task_id, 0);
        (evRes.data ?? []).forEach(applyEvent);
      } catch {
        // 拉取历史失败不影响实时流；错误由全局拦截器提示。
      }
    } catch {
      // API 错误由全局拦截器提示。
      setStreaming("");
      setSending(false);
      setWaiting(false);
    }
  };

  const handleClear = () => {
    selectedConvIdRef.current = undefined;
    seenRef.current.clear();
    setConversationId(undefined);
    setCurrentTaskId(undefined);
    setMessages([]);
    setStreaming("");
    setSending(false);
    setWaiting(false);
    setPendingPermissions([]);
    setInput("");
  };

  return (
    <Flex vertical style={{ height: "100%", minHeight: 480 }}>
      {/* 头部 */}
      <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          {/* <Text type="secondary" style={{ fontSize: 12 }}>
            {conversationId ? `Conversation: ${conversationId}` : "New conversation"}
          </Text> */}
          {envInfo?.label && (
            <Popover placement="left" title={<div style={{ fontSize: 12 ,width: 300}}>
            <div>{`Working dir: ${envInfo.working_dir || "(none)"}`}</div>
            {envInfo.type && <div>{`Type: ${envInfo.type}`}</div>}
            {conversationId && <div>{`Conversation ID: ${conversationId}`}</div>}
            {currentTaskId && <div>{`Current task ID: ${currentTaskId}`}</div>}
            <hr />
            {envInfo.system_prompt && <div style={{  wordBreak: "break-word" }}>{`System prompt: ${envInfo.system_prompt}`}</div>}

 
            </div>}>
              <Tag color="processing" style={{ marginInlineEnd: 0, cursor: "pointer" }}>
                {envInfo.label}
              </Tag>
              {/* {envInfo.type} */}
            </Popover>
          )}
        </Flex>
        <Flex gap="small">
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
            New Chat
          </Button>
          {onCancel && (
            <Button size="small" onClick={onCancel}>
              Close
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Profile 选择：为空表示使用默认 Profile */}
      <Select
        value={userInfo?.profile}
        placeholder="Select agent profile (default)"
        onChange={handleProfileChange}
        allowClear
        showSearch
        optionFilterProp="label"
        style={{ width: "100%", marginBottom: 8 }}
        options={profiles.map((p) => ({
          value: p.name,
          label: `${p.display_name || p.name}${p.is_default ? " (default)" : ""}`,
        }))}
      />

      {/* 会话切换下拉 */}
      <Select
        value={conversationId}
        placeholder="Select a conversation"
        onChange={(id) => {
          if (!id) {
            handleClear();
            return;
          }
          handleSwitchConversation(id);
        }}
        loading={loadingConversations}
        allowClear
        showSearch
        optionFilterProp="label"
        style={{ width: "100%", marginBottom: 8 }}
        options={conversations.map((c) => ({
          value: c.id,
          label: (
            <Flex align="center" gap={6} style={{ width: "100%" }}>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conversationLabel(c)}
              </span>
              {c.current_task_id && <Badge status="processing" />}
            </Flex>
          ),
        }))}
      />

      {/* 运行中 / 等待权限状态提示 */}
      {sending && (
        <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
          <Spin size="small" indicator={<LoadingOutlined spin />} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {waiting ? "Waiting for permission…" : "Agent is running…"}
          </Text>
          {currentTaskId && (
            <Popconfirm title="Cancel this task?" onConfirm={handleCancelTask}>
              <Button danger size="small" loading={canceling}>
                Cancel
              </Button>
            </Popconfirm>
          )}
        </Flex>
      )}

      {/* 待确认权限：实时流中直接展示 Approve / Deny，可能同时有多个。 */}
      {pendingPermissions.length > 0 && (
        <Flex vertical gap="small" style={{ marginBottom: 8 }}>
          <Text type="warning" style={{ fontSize: 12 }}>
            Pending permissions ({pendingPermissions.length})
          </Text>
          {pendingPermissions.map((perm) => {
            const pendingLoading = resolvingId === perm.id;
            return (
              <Flex
                key={perm.id}
                align="center"
                justify="space-between"
                gap="small"
                style={{
                  border: "1px solid #ffe58f",
                  background: "#fffbe6",
                  borderRadius: 6,
                  padding: "8px 12px",
                }}
              >
                <Flex vertical gap={2} style={{ minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    {perm.operation?.type || "Permission"}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, wordBreak: "break-all" }}
                  >
                    {renderOperation(perm.operation)}
                  </Text>
                </Flex>
                <Space size="small">
                  <Popconfirm
                    title="Approve this permission?"
                    onConfirm={() => handleApprove(perm)}
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={pendingLoading}
                    >
                      Approve
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Deny this permission?"
                    onConfirm={() => handleDeny(perm)}
                  >
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      loading={pendingLoading}
                    >
                      Deny
                    </Button>
                  </Popconfirm>
                </Space>
              </Flex>
            );
          })}
        </Flex>
      )}

      {/* 消息列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && !streaming ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Start a conversation with the agent"
            style={{ marginTop: 48 }}
          />
        ) : (
          <Flex vertical gap="small">
            {messages.map((m) => (
              <Flex
                key={m.id}
                justify={m.role === "user" ? "flex-end" : "flex-start"}
                align="flex-start"
                gap={8}
              >
                {m.role === "assistant" && (
                  <RobotOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                )}
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: m.role === "user" ? "#1677ff" : "#ffffff",
                    color: m.role === "user" ? "#fff" : m.error ? "#ff4d4f" : "inherit",
                    border: m.role === "user" ? "none" : "1px solid #f0f0f0",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.role === "assistant" && !m.error ? (
                    <XMarkdown>{m.content}</XMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && <UserOutlined style={{ color: "#1677ff", marginTop: 4 }} />}
              </Flex>
            ))}

            {/* 流式输出中的 assistant 气泡 */}
            {(sending || streaming) && (
              <Flex align="flex-start" gap={8}>
                <RobotOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "1px solid #f0f0f0",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {streaming ? (
                    <Text style={{ fontSize: 13 }}>{streaming}</Text>
                  ) : waiting ? (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Waiting for permission…
                    </Text>
                  ) : (
                    <Spin size="small" indicator={<LoadingOutlined spin />} />
                  )}
                </div>
              </Flex>
            )}
          </Flex>
        )}
      </div>

      {/* 输入区 */}
      <Flex gap="small" style={{ marginTop: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          autoSize={{ minRows: 1, maxRows: 5 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={sending}
          disabled={!input.trim()}
        >
          Send
        </Button>
      </Flex>
    </Flex>
  );
};

export default AgentChat;

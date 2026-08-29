import { FC, useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Flex, Input, Select, Spin, Typography } from "antd";
import {
  ClearOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import {
  AgentTaskStatus,
  chatAgentApi,
  getAgentTaskApi,
  getAgentTaskEventsApi,
  getConversationApi,
  pageConversationApi,
  type AgentConversationItem,
  type AgentEventItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";

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
        setStreaming("");
        setSending(false);
        setWaiting(false);
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
            setStreaming("");
            setSending(false);
            setWaiting(false);
            return;
          }
          turn.waiting = st === AgentTaskStatus.WaitingPermission;
        } catch {
          // 查询任务失败时按 running 处理，避免丢失实时流。
        }
      }

      setStreaming(turn.streaming);
      setSending(turn.sending);
      setWaiting(turn.waiting);
    } catch {
      // 错误由全局拦截器提示。
    }
  };

  useEffect(() => {
    loadConversations();
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
      setStreaming("");
      setSending(false);
      setWaiting(false);
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
    setMessages([]);
    setStreaming("");
    setSending(false);
    setWaiting(false);
    setInput("");
  };

  return (
    <Flex vertical style={{ height: "100%", minHeight: 480 }}>
      {/* 头部 */}
      <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {conversationId ? `Conversation: ${conversationId}` : "New conversation"}
        </Text>
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

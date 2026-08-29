import { FC, useEffect, useRef, useState } from "react";
import { Button, Empty, Flex, Input, Spin, Typography } from "antd";
import {
  ClearOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import {
  chatAgentApi,
  getAgentTaskEventsApi,
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
  const [sending, setSending] = useState(false);
  // 当前正在流式输出的 assistant 文本（未固化到 messages）。
  const [streaming, setStreaming] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const streamingRef = useRef("");
  const seenRef = useRef<Set<string>>(new Set());

  // 自动滚动到底部。
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const finalizeTurn = (type: string) => {
    const taskId = currentTaskIdRef.current;
    if (!taskId) return;
    currentTaskIdRef.current = null;

    const content = streamingRef.current;
    streamingRef.current = "";
    setStreaming("");

    if (content.trim() || type === "task.failed") {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${taskId}`,
          role: "assistant",
          content: type === "task.failed" ? content || "(agent error)" : content,
          error: type === "task.failed",
        },
      ]);
    }
    setSending(false);
  };

  const applyEvent = (ev: AgentEventItem) => {
    const key = `${ev.id ?? ""}:${ev.sequence ?? ""}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    if (ev.type === "stream") {
      const payload = (ev.payload ?? {}) as StreamEventPayload;
      if (payload.type === "text" && payload.content) {
        streamingRef.current += payload.content;
        setStreaming(streamingRef.current);
      }
      return;
    }
    if (ev.type && TERMINAL_EVENT_TYPES.has(ev.type)) {
      finalizeTurn(ev.type);
    }
  };

  // 全局订阅 WS：按当前 task 过滤 agent.event。
  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event" || !msg.event) return;
      if (!currentTaskIdRef.current || msg.task_id !== currentTaskIdRef.current) return;
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
    setStreaming("");
    streamingRef.current = "";

    try {
      const res = await chatAgentApi({
        conversation_id: conversationId,
        message: text,
      });
      const { task_id, conversation_id } = res.data;

      setConversationId(conversation_id);
      currentTaskIdRef.current = task_id;
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
      currentTaskIdRef.current = null;
      streamingRef.current = "";
      setStreaming("");
      setSending(false);
    }
  };

  const handleClear = () => {
    if (sending) return;
    currentTaskIdRef.current = null;
    streamingRef.current = "";
    seenRef.current.clear();
    setConversationId(undefined);
    setMessages([]);
    setStreaming("");
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
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear} disabled={sending}>
            New Chat
          </Button>
          {onCancel && (
            <Button size="small" onClick={onCancel}>
              Close
            </Button>
          )}
        </Flex>
      </Flex>

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

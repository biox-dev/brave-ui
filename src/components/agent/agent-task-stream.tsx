import { FC, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button, Empty, Flex, Popconfirm, Space, Spin, Tag, Typography } from "antd";
import {
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import {
  AgentPermissionStatus,
  approveAgentPermissionApi,
  denyAgentPermissionApi,
  getAgentPendingPermissionsApi,
  getAgentTaskEventsApi,
  type AgentEventItem,
  type AgentOperation,
  type AgentPermissionItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";
import { renderAssistantMessage } from "./agent-message-render";

const { Text } = Typography;

interface AgentWSMessage {
  type?: string;
  task_id?: string;
  event?: AgentEventItem;
}

interface StreamEventPayload {
  type?: string;
  content?: string;
  data?: unknown;
  [key: string]: unknown;
}

const STATUS_META: Record<string, { color: string; text: string }> = {
  created: { color: "default", text: "Created" },
  running: { color: "processing", text: "Running" },
  waiting: { color: "warning", text: "Waiting Permission" },
  "task.completed": { color: "success", text: "Completed" },
  "task.failed": { color: "error", text: "Failed" },
  "task.canceled": { color: "default", text: "Canceled" },
};

interface StreamMessage {
  key: string;
  kind: string;
  content: string;
  data?: unknown;
  streaming?: boolean;
  error?: boolean;
}

interface AgentTaskStreamProps {
  taskId: string;
  /** 嵌入到父级滚动容器（如 AgentChat 的消息列表）时传入，避免出现嵌套滚动条；自动滚动委托给父容器。 */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

const renderOperation = (op?: AgentOperation | null) => {
  if (!op) return "";
  return op.path || op.command || op.content || op.type || "";
};

const AgentTaskStream: FC<AgentTaskStreamProps> = ({ taskId, scrollContainerRef }) => {
  const embedded = !!scrollContainerRef;
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<string>("created");

  // const [pendingPermissions, setPendingPermissions] = useState<AgentPermissionItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string>();

  const msgsRef = useRef<StreamMessage[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const keySeqRef = useRef(0);
  const hydratedRef = useRef(false);
  const liveBufferRef = useRef<AgentEventItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const nextKey = () => `m-${++keySeqRef.current}`;

  const pushMessage = (msg: Omit<StreamMessage, "key">) => {
    msgsRef.current.push({ key: nextKey(), ...msg });
  };

  const closeOpen = (kind: string) => {
    for (let i = msgsRef.current.length - 1; i >= 0; i--) {
      const m = msgsRef.current[i];
      if (m.kind !== kind) continue;
      if (m.streaming) {
        m.streaming = false;
      }
      return;
    }
  };

  const upsertStreaming = (kind: string, delta: string) => {
    if (!delta) return;
    for (let i = msgsRef.current.length - 1; i >= 0; i--) {
      const m = msgsRef.current[i];
      if (m.kind !== kind || !m.streaming) continue;
      m.content += delta;
      return;
    }
    pushMessage({ kind, content: delta, streaming: true });
  };

  const finalizeFromBlock = (kind: string, content: string, data?: unknown) => {
    for (let i = msgsRef.current.length - 1; i >= 0; i--) {
      const m = msgsRef.current[i];
      if (m.kind !== kind || !m.streaming) continue;
      m.streaming = false;
      if (content) m.content = content;
      if (data !== undefined) m.data = data;
      return;
    }
    if (content || data !== undefined) {
      pushMessage({ kind, content: content || "", data, streaming: false });
    }
  };

  const flush = () => {
    setMessages([...msgsRef.current]);
  };

  // const loadPermissions = async () => {
  //   if (!taskId) return;
  //   try {
  //     const res = await getAgentPendingPermissionsApi(taskId);
  //     const items = res.data ?? [];
  //     setPendingPermissions(items.filter((p) => p.status === AgentPermissionStatus.Pending));
  //   } catch {
  //     // API errors are shown globally by the http interceptor.
  //   }
  // };

  // const handleApprove = async (id: string) => {
  //   setResolvingId(id);
  //   try {
  //     await approveAgentPermissionApi(id);
  //     getGlobalMessage()?.success("Permission approved");
  //     await loadPermissions();
  //   } catch {
  //     // API errors are shown globally by the http interceptor.
  //   } finally {
  //     setResolvingId(undefined);
  //   }
  // };

  // const handleDeny = async (id: string) => {
  //   setResolvingId(id);
  //   try {
  //     await denyAgentPermissionApi(id);
  //     getGlobalMessage()?.success("Permission denied");
  //     await loadPermissions();
  //   } catch {
  //     // API errors are shown globally by the http interceptor.
  //   } finally {
  //     setResolvingId(undefined);
  //   }
  // };

  const applyEvent = useCallback((ev: AgentEventItem) => {
    const dedupeKey = `${ev.id ?? ""}:${ev.sequence ?? ""}`;
    if (seenRef.current.has(dedupeKey)) return;
    seenRef.current.add(dedupeKey);

    if (ev.type === "task.started") {
      setStatus("running");
      return;
    }
    if (ev.type === "task.waiting") {
      setStatus("waiting");
      return;
    }
    if (ev.type === "task.completed" || ev.type === "task.failed" || ev.type === "task.canceled") {
      setStatus(ev.type);
      closeOpen("assistant_final");
      closeOpen("reasoning");
      flush();
      return;
    }

    if (ev.type === "permission.created" || ev.type === "permission.resolved") {
      // void loadPermissions();
      return;
    }

    if (ev.type !== "stream") return;

    const payload = (ev.payload ?? {}) as StreamEventPayload;
    const pType = payload.type;

    switch (pType) {
      case "text":
        upsertStreaming("assistant_final", payload.content ?? "");
        flush();
        return;
      case "reasoning_delta":
        upsertStreaming("reasoning", payload.content ?? "");
        flush();
        return;
      case "message": {
        const data = (payload.data ?? {}) as Record<string, unknown>;
        const content = typeof data.content === "string" ? data.content : "";
        const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : [];

        for (const tc of toolCalls) {
          const call = tc as Record<string, unknown>;
          pushMessage({
            kind: "tool_call",
            content: "",
            data: call,
            streaming: false,
            error: false,
          });
        }

        if (content) {
          finalizeFromBlock("assistant_final", content, payload.data);
        }
        flush();
        return;
      }
      case "reasoning": {
        const data = (payload.data ?? {}) as Record<string, unknown>;
        const content = typeof data.content === "string" ? data.content : "";
        finalizeFromBlock("reasoning", content, payload.data);
        flush();
        return;
      }
      case "tool_call":
      case "tool_result":
      case "skill_call":
      case "skill_result": {
        const data = (payload.data ?? {}) as Record<string, unknown>;
        const content = typeof data.content === "string" ? data.content : "";
        pushMessage({ kind: pType, content, data: payload.data, streaming: false, error: !!data.is_error });
        flush();
        return;
      }
      case "error":
        pushMessage({ kind: "assistant_final", content: payload.content ?? "Stream error", error: true });
        flush();
        return;
      case "done":
        closeOpen("assistant_final");
        closeOpen("reasoning");
        flush();
        return;
      default:
        return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setStatus("created");

    hydratedRef.current = false;
    liveBufferRef.current = [];
    msgsRef.current = [];
    seenRef.current.clear();
    keySeqRef.current = 0;
    setMessages([]);

    getAgentTaskEventsApi(taskId, 0)
      .then((res) => {
        if (cancelled) return;
        const history = res.data ?? [];
        const buffered = liveBufferRef.current;
        liveBufferRef.current = [];

        const merged: AgentEventItem[] = [];
        const dedupe = new Map<string, AgentEventItem>();
        const put = (e: AgentEventItem) => {
          const k = `${e.id ?? ""}:${e.sequence ?? ""}`;
          if (dedupe.has(k)) return;
          dedupe.set(k, e);
          merged.push(e);
        };
        [...history, ...buffered].forEach(put);
        merged.sort((a, b) => {
          const ta = new Date(a.created_at ?? "").getTime() || 0;
          const tb = new Date(b.created_at ?? "").getTime() || 0;
          if (ta !== tb) return ta - tb;
          return (a.sequence ?? 0) - (b.sequence ?? 0);
        });

        seenRef.current.clear();
        msgsRef.current = [];
        for (const ev of merged) {
          applyEvent(ev);
        }
        hydratedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // void loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [taskId, applyEvent]);

  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event") return;
      if (!msg.event || msg.task_id !== taskId) return;

      if (hydratedRef.current) {
        applyEvent(msg.event);
      } else {
        liveBufferRef.current.push(msg.event);
      }
    });
    return () => unsubscribe();
  }, [taskId, applyEvent]);

  const statusMeta = useMemo(() => STATUS_META[status] ?? { color: "default", text: status }, [status]);
  const running = status === "created" || status === "running" || status === "waiting";

  // 自动滚动到底部：嵌入模式下滚动父容器，否则滚动自身容器。
  useEffect(() => {
    if (!autoScrollRef.current) return;
    const target = scrollContainerRef?.current ?? containerRef.current;
    if (target) {
      target.scrollTop = target.scrollHeight;
    }
  }, [messages, scrollContainerRef]);

  // 监听滚动：用户向上翻阅时暂停自动滚动（嵌入模式下监听父容器）。
  useEffect(() => {
    const target = scrollContainerRef?.current ?? containerRef.current;
    if (!target) return;
    const handler = () => {
      autoScrollRef.current =
        target.scrollHeight - target.scrollTop - target.clientHeight < 40;
    };
    target.addEventListener("scroll", handler);
    return () => target.removeEventListener("scroll", handler);
  }, [scrollContainerRef, loading, loadError]);

  return (
    <Flex vertical gap="small" style={{ padding: "8px 0" }}>
      <Flex align="center" gap="small" wrap>
        {running ? (
          <Spin size="small" indicator={<LoadingOutlined spin />} />
        ) : status === "task.failed" ? (
          <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
        ) : status === "task.canceled" ? (
          <MinusCircleOutlined style={{ color: "#8c8c8c" }} />
        ) : (
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
        )}
        <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {messages.length > 0 ? `${messages.length} items` : "No output yet"}
        </Text>
      </Flex>

      {/* {pendingPermissions.length > 0 && (
        <Flex vertical gap="small">
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
                  <Text type="secondary" style={{ fontSize: 12, wordBreak: "break-all" }}>
                    {renderOperation(perm.operation)}
                  </Text>
                </Flex>
                <Space size="small">
                  <Popconfirm title="Approve this permission?" onConfirm={() => handleApprove(perm.id)}>
                    <Button type="primary" size="small" icon={<CheckOutlined />} loading={pendingLoading}>
                      Approve
                    </Button>
                  </Popconfirm>
                  <Popconfirm title="Deny this permission?" onConfirm={() => handleDeny(perm.id)}>
                    <Button danger size="small" icon={<CloseOutlined />} loading={pendingLoading}>
                      Deny
                    </Button>
                  </Popconfirm>
                </Space>
              </Flex>
            );
          })}
        </Flex>
      )} */}

      {loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin size="small" />
        </Flex>
      ) : loadError ? (
        <Empty description="Failed to load task events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div
          ref={containerRef}
          style={
            embedded
              ? { background: "#ffffff", border: "1px solid #f0f0f0", borderRadius: 8, padding: "8px 12px" }
              : { maxHeight: 480, overflow: "auto", paddingRight: 4 }
          }
        >
          {messages.length === 0 ? (
            !running ? (
              <Empty description="No output" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "4px 0" }} />
            ) : (
              <Flex justify="center" style={{ padding: 24 }}>
                <Spin size="small" indicator={<LoadingOutlined spin />} />
              </Flex>
            )
          ) : (
            <Flex vertical gap={8}>
              {messages.map((m) => (
                <Flex key={m.key} align="flex-start" gap={8}>
                  <RobotOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                  {renderAssistantMessage({
                    kind: m.kind,
                    content: m.content,
                    data: m.data,
                    error: m.error,
                    streaming: m.streaming,
                  })}
                </Flex>
              ))}
            </Flex>
          )}
        </div>
      )}
    </Flex>
  );
};

export default AgentTaskStream;

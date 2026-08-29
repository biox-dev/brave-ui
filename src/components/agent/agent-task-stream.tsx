import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Collapse, Empty, Flex, Spin, Tag, Timeline, Typography } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import { getAgentTaskEventsApi, type AgentEventItem } from "@/api/agent";
import { sseClient } from "@/sse";

const { Text } = Typography;

/**
 * 后端 WS 推送的 agent 事件信封（对应 handler.agentWSEvent）：
 *   { type: "agent.event", task_id, event: AgentEvent }
 */
interface AgentWSMessage {
  type?: string;
  task_id?: string;
  event?: AgentEventItem;
}

/**
 * Agent 流式事件（对应 agent.StreamEvent）的 payload 结构。
 * 仅在 AgentEvent.type === "stream" 时出现。
 */
interface StreamEventPayload {
  type?: string;
  content?: string;
  [key: string]: unknown;
}

// 任务终态事件类型。
const TERMINAL_EVENT_TYPES = new Set(["task.completed", "task.failed", "task.canceled"]);

// 状态展示辅助。
const STATUS_META: Record<string, { color: string; text: string }> = {
  "task.created": { color: "default", text: "Created" },
  "task.started": { color: "processing", text: "Started" },
  "task.waiting": { color: "warning", text: "Waiting Permission" },
  "task.completed": { color: "success", text: "Completed" },
  "task.failed": { color: "error", text: "Failed" },
  "task.canceled": { color: "default", text: "Canceled" },
};

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const formatPayload = (payload?: unknown) => {
  if (payload === undefined || payload === null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

interface AgentTaskStreamProps {
  taskId: string;
}

/**
 * Agent 任务实时数据展示组件。
 *
 * 职责：
 *   - 订阅全局 WS（HybridRealtimeClient），过滤出当前 taskId 的 agent.event；
 *   - 打开时先通过 GetTaskEvents 增量拉取历史事件，避免错过展开前的输出；
 *   - 把 stream 事件里的 text / reasoning 增量聚合成正文与思维链；
 *   - 把生命周期、权限、工具调用等事件渲染成时间线。
 *
 * 同时兼容流式（stream=true，逐块输出）与非流式（stream=false，仅生命周期事件）任务。
 */
const AgentTaskStream: FC<AgentTaskStreamProps> = ({ taskId }) => {
  const [events, setEvents] = useState<AgentEventItem[]>([]);
  const [streamText, setStreamText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 用于去重：历史拉取与实时推送可能重叠，按事件 id + sequence 去重。
  const seenRef = useRef<Set<string>>(new Set());

  const applyEvent = (ev: AgentEventItem) => {
    const key = `${ev.id ?? ""}:${ev.sequence ?? ""}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    // 流式内容：聚合 text / reasoning 增量，其余 stream 子类型落入时间线。
    if (ev.type === "stream") {
      const payload = (ev.payload ?? {}) as StreamEventPayload;
      if (payload.type === "text" && payload.content) {
        setStreamText((prev) => prev + payload.content);
        return;
      }
      if (payload.type === "reasoning" && payload.content) {
        setReasoningText((prev) => prev + payload.content);
        return;
      }
      if (payload.type === "done") {
        // done 无内容，仅用于标记结束，不单独展示时间线。
        return;
      }
    }

    setEvents((prev) => [...prev, ev]);
  };

  // 1) 挂载时拉取历史事件。
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    getAgentTaskEventsApi(taskId, 0)
      .then((res) => {
        if (cancelled) return;
        const items = res.data ?? [];
        seenRef.current.clear();
        setEvents([]);
        setStreamText("");
        setReasoningText("");
        items.forEach(applyEvent);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 2) 订阅实时 WS 事件。
  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event") return;
      if (!msg.event || msg.task_id !== taskId) return;
      applyEvent(msg.event);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 3) 根据事件推导当前运行状态。
  const status = useMemo(() => {
    const last = events[events.length - 1];
    if (last && TERMINAL_EVENT_TYPES.has(last.type)) {
      return last.type;
    }
    if (events.some((e) => e.type === "task.started")) {
      return "running";
    }
    return "created";
  }, [events]);

  const statusMeta = STATUS_META[status] ?? { color: "default", text: status };
  const running = status === "running" || status === "created";

  // 需要展示在时间线上的事件（排除 stream text/reasoning 已聚合、以及无信息的 done）。
  const timelineEvents = useMemo(
    () =>
      events.filter((e) => {
        if (e.type === "stream") {
          const payload = (e.payload ?? {}) as StreamEventPayload;
          return payload.type !== "text" && payload.type !== "reasoning" && payload.type !== "done";
        }
        return true;
      }),
    [events]
  );

  const renderTimelineLabel = (ev: AgentEventItem) => {
    if (ev.type === "stream") {
      const payload = (ev.payload ?? {}) as StreamEventPayload;
      const labelMap: Record<string, string> = {
        tool_call: "Tool Call",
        tool_result: "Tool Result",
        permission: "Permission Requested",
        permission_result: "Permission Result",
        error: "Stream Error",
      };
      return (
        <Text type={payload.type === "error" ? "danger" : "secondary"}>
          {labelMap[payload.type ?? ""] ?? payload.type ?? "stream"}
        </Text>
      );
    }

    if (ev.type === "permission.created") return <Text type="warning">Permission Requested</Text>;
    if (ev.type === "permission.resolved") return <Text type="secondary">Permission Resolved</Text>;

    const meta = STATUS_META[ev.type];
    return <Tag color={meta?.color ?? "default"}>{meta?.text ?? ev.type}</Tag>;
  };

  return (
    <Flex vertical gap="small" style={{ padding: "8px 4px" }}>
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
          {events.length > 0 ? `${events.length} events` : "No events yet"}
        </Text>
      </Flex>

      {loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin size="small" />
        </Flex>
      ) : loadError ? (
        <Empty description="Failed to load task events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          {/* 思维链（如有） */}
          {reasoningText && (
            <Collapse
              size="small"
              ghost
              items={[
                {
                  key: "reasoning",
                  label: (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <RobotOutlined /> Reasoning
                    </Text>
                  ),
                  children: (
                    <Text type="secondary" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                      {reasoningText}
                    </Text>
                  ),
                },
              ]}
            />
          )}

          {/* 正文输出 */}
          {streamText ? (
            <div
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 6,
                padding: "8px 12px",
                background: "#fafafa",
                maxHeight: 320,
                overflow: "auto",
              }}
            >
              <XMarkdown>{streamText}</XMarkdown>
            </div>
          ) : (
            !running && (
              <Empty
                description="No output"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: "4px 0" }}
              />
            )
          )}

          {/* 事件时间线 */}
          {timelineEvents.length > 0 && (
            <Timeline
              style={{ marginTop: 4 }}
              items={timelineEvents.map((ev) => ({
                key: `${ev.id}:${ev.sequence}`,
                dot:
                  ev.type === "task.failed" ? (
                    <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                  ) : ev.type === "task.completed" ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : undefined,
                children: (
                  <Flex vertical gap={2}>
                    <Flex align="center" gap="small">
                      {renderTimelineLabel(ev)}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        seq {ev.sequence} · {formatTime(ev.created_at)}
                      </Text>
                    </Flex>
                    {ev.payload !== undefined && ev.payload !== null && (
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                      >
                        {formatPayload(ev.payload)}
                      </Text>
                    )}
                  </Flex>
                ),
              }))}
            />
          )}
        </>
      )}
    </Flex>
  );
};

export default AgentTaskStream;

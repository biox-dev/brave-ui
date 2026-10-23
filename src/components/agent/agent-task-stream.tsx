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
  AgentTaskStatus,
  approveAgentPermissionApi,
  denyAgentPermissionApi,
  getAgentPendingPermissionsApi,
  getAgentTaskApi,
  getAgentTaskTimelineApi,
  type AgentEventItem,
  type AgentOperation,
  type AgentPermissionItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";
import { renderAssistantMessage } from "./agent-message-render";

const { Text } = Typography;

// 由 UI 卡片承载的工具调用：时间线不展示其原始 JSON（提问卡片单独渲染），
// 也不展示其"调用参数"，避免用户直接看到大段原始入参。

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

// 本组件负责消费的事件类型（与 AgentChat 的 CHAT_OWNED_EVENT_TYPES 互补）。
//
// 两侧共享同一张去重表，因此每个组件都必须先判断「这个事件归不归我」，
// 再写去重键；否则先跑的一侧会把事件登记成已见，另一侧永久收不到。
//   - 本组件：stream 增量、task.started / task.waiting、终态（同时决定头部状态）；
//   - AgentChat：权限 / 提问事件（驱动卡片与按钮）。
const STREAM_OWNED_EVENT_TYPES = new Set([
  "stream",
  "task.started",
  "task.waiting",
  "task.completed",
  "task.failed",
  "task.canceled",
]);

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
  /**
   * 外部共享的事件去重表（如 AgentChat 的 seenRef）。
   *
   * AgentChat 与 AgentTaskStream 会同时订阅同一条 `agent.event`（前者管生命周期 /
   * 权限 /
   * 提问，后者管时间线），各自维护 seen 表会导致「同一事件被两个组件各自处理一次」。
   * 传入共享表后，两层对同一 `event.id` 只处理一次，语义明确不依赖事件类型分流。
   */
  seenRef?: RefObject<Set<string>>;
  /**
   * 回填时跳过的前 N 条。
   *
   * 嵌入 AgentChat 时，本轮已落库的部分条目会先由外层「会话历史气泡」渲染，
   * 时间线再从头回填就会重复。传入外层已覆盖的条数，回填时跳过���们。
   */
  skipCount?: number;
  /** 时间线回填完成（或失败）后回调，父组件据此驱动滚动 / 状态。 */
  onLoaded?: () => void;
}

const renderOperation = (op?: AgentOperation | null) => {
  if (!op) return "";
  return op.path || op.command || op.content || op.type || "";
};

// 把后端任务状态映射为时间线头部展示的状态（复用 STATUS_META 的键）。
// 中间态事件（task.started / task.waiting / 终态）不落库，刷新后只能靠任务表补回来。
const statusFromTask = (status?: string): string => {
  switch (status) {
    case AgentTaskStatus.WaitingPermission:
      return "waiting";
    case AgentTaskStatus.Completed:
      return "task.completed";
    case AgentTaskStatus.Failed:
      return "task.failed";
    case AgentTaskStatus.Canceled:
      return "task.canceled";
    case AgentTaskStatus.Running:
    case AgentTaskStatus.Created:
      return "running";
    default:
      return "created";
  }
};

// 状态优先级：数字越大越「新」。用于避免回填期间到达的实时终态被旧的 HTTP 快照回退。
const STATUS_RANK: Record<string, number> = {
  created: 0,
  running: 1,
  waiting: 2,
  "task.completed": 3,
  "task.failed": 3,
  "task.canceled": 3,
};

const AgentTaskStream: FC<AgentTaskStreamProps> = ({
  taskId,
  scrollContainerRef,
  seenRef: externalSeenRef,
  skipCount = 0,
  onLoaded,
}) => {
  const embedded = !!scrollContainerRef;
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("created");

  // const [pendingPermissions, setPendingPermissions] = useState<AgentPermissionItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string>();

  const msgsRef = useRef<StreamMessage[]>([]);
  // 未传入共享表时退化为组件内私有表（保持独立使用时的行为）。
  const localSeenRef = useRef<Set<string>>(new Set());
  const seenRef = externalSeenRef ?? localSeenRef;
  const keySeqRef = useRef(0);
  // 当前已回填的任务 ID（区分「换任务全量重置」与「skipCount 变化只重排前缀」）。
  const currentTaskRef = useRef<string>("");
  // 上一次回填插入的历史条数（实时追加部分从这个下标之后开始）。
  const backfilledCountRef = useRef(0);

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
    // 所有权判定：权限 / 提问事件归 AgentChat，本组件不处理也不占用去重键。
    if (!STREAM_OWNED_EVENT_TYPES.has(ev.type ?? "")) return;

    const dedupeKey = ev.id ?? "";
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
        {
          // 后端把可序列化的错误文本放在 content（Err 不参与 JSON）；
          // 兼容旧事件时再回退到 data.error 与通用文案。
          const data = (payload.data ?? {}) as Record<string, unknown>;
          const content =
            payload.content ||
            (typeof data.error === "string" ? data.error : "") ||
            "Stream error";
          pushMessage({ kind: "assistant_final", content, error: true });
          flush();
        }
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

  // 挂载 / 切换任务时回填「已落库的事实流」，并用任务状态补中间态。
  //
  // 为什么需要回填：增量事件（text / reasoning_delta）只走 WS 广播不落库，刷新页面或
  // 切换会话后它们已经丢失；如果只等新事件，进行中的任务在这里会是一片空白。
  // 后端 GET /agent/task/timeline 会按 task_id 返回该轮已落库的完整块
  // （reasoning / assistant / tool_call / tool_result / error），正好还原执行过程。
  //
  // 回填的消息用的是 agent_messages 的 ID，与 WS 事件的雪花 ID 不是同一空间，
  // 因此不写进共享 WS 去重表（避免误杀同值的实时事件）；回填是幂等的历史快照，
  // 之后由 WS 追加的事件本身就是新内容。
  // 同一轮里「回填行 + 新来的完整块事件」可能各出现一次，这不是 bug：轮次结束
  // （finalizeTurn）时 AgentChat 会以 conversation/get 的投影结果整体覆盖，
  // 实时区仅用于进行中的临时展示。
  useEffect(() => {
    let cancelled = false;

    // taskId 变化时才做全量重置；skipCount 变化只需重排历史前缀（见下方）。
    // 否则每次外层历史增长都会清空实时区，已到达的增量就丢了。
    const isNewTask = currentTaskRef.current !== taskId;
    if (isNewTask) {
      currentTaskRef.current = taskId;
      setStatus("created");
      msgsRef.current = [];
      keySeqRef.current = 0;
      setMessages([]);
      setLoading(true);
    }

    const backfill = async () => {
      try {
        // 1) 已落库的时间线（按 seq 升序，与实时事件的产生顺序一致）。
        const timeline = await getAgentTaskTimelineApi(taskId);
        if (cancelled) return;

        // 前 skipCount 条已由外层 AgentChat 的历史气泡渲染，这里跳过避免重复。
        const history = (timeline.data ?? [])
          .slice(Math.max(0, skipCount))
          .map<StreamMessage>((m) => ({
            key: nextKey(),
            kind: m.kind ?? "assistant",
            content: m.content,
            data: m.data,
            streaming: false,
            error: m.kind === "error",
          }));

        if (isNewTask) {
          // 历史在前、实时在后：请求期间到达的 WS 事件已经写入 msgsRef，
          // 直接前置历史而不是清空重写，否则会把这期间的增量 / 完整块丢掉。
          msgsRef.current = [...history, ...msgsRef.current];
        } else {
          // 只是 skipCount 变了：把上一次回填的历史前缀整段替换掉，实时追加部分原样保留。
          const live = msgsRef.current.slice(backfilledCountRef.current);
          msgsRef.current = [...history, ...live];
        }
        backfilledCountRef.current = history.length;
        flush();

        // 2) 任务当前状态：补回 task.started / task.waiting / 终态等不落库的中间态。
        // 若请求期间已经收到更高优先级的实时状态事件（如终态），不要用旧快照回退。
        const task = await getAgentTaskApi(taskId);
        if (cancelled) return;
        const fromTask = statusFromTask(task.data?.status);
        setStatus((prev) => (STATUS_RANK[prev] > STATUS_RANK[fromTask] ? prev : fromTask));
      } catch {
        // 回填失败不阻塞实时订阅：WS 事件仍会继续追加。
      } finally {
        if (!cancelled) {
          setLoading(false);
          onLoaded?.();
        }
      }
    };

    void backfill();

    return () => {
      cancelled = true;
    };
    // skipCount 参与依赖：外层历史晚于本组件回填到达时（刷新后会话请求更慢），
    // 需要重新回填并跳过更多条目，否则同一条事实会出现两份。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, skipCount]);

  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event") return;
      if (!msg.event || msg.task_id !== taskId) return;

      applyEvent(msg.event);
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
  }, [scrollContainerRef, loading]);

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

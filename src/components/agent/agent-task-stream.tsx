import { FC, memo, useMemo } from "react";
import { Flex, Spin, Typography } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { ToolCallRow, asRecord, StreamedText, renderAssistantMessage } from "./agent-message-render";
import type { StreamBlock } from "./agent-live-stream";

const { Text } = Typography;

interface AgentTaskStreamProps {
  /** 本次实时流内的块（已由调用方按历史去重裁剪）。 */
  blocks: StreamBlock[];
  /** 流状态：running / waiting / task.completed / task.failed / task.canceled。 */
  status: string;
  /** 当前会话 ID：Tool Call 行点击后在右侧工作区为该会话打开详情标签。 */
  sessionId?: string;
  /** 嵌入父级滚动容器时传入：不再渲染自己的边框（滚动交给父容器）。 */
  embedded?: boolean;
}

/** 状态文案。 */
const STATUS_TEXT: Record<string, string> = {
  created: "Starting",
  running: "Running",
  waiting: "Waiting permission",
  "task.completed": "Completed",
  "task.failed": "Failed",
  "task.canceled": "Canceled",
};

/** 把工具入参（对象或 JSON 字符串）统一成对象，用于读取 purpose。 */
const asArgs = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/**
 * 单条流式块。
 *
 * memo 的意义：token 级追加只会改动「最后一条正在追加的块」，其余块的对象引用不变，
 * 因此这里能把它挡在重渲染之外。否则每来一个 token 都要把整个消息列表
 * （含历史气泡 / 工具行 / Markdown）重新渲染一遍，长任务下会明显掉帧。
 */
const StreamBlockRow = memo(function StreamBlockRow({
  block,
  sessionId,
}: {
  block: StreamBlock;
  sessionId?: string;
}) {
  const data = asRecord(block.data);

  if (block.kind === "tool_call" || block.kind === "skill_call") {
    const inlineResult = asRecord(data?.result) ? data?.result : undefined;
    const resultData = asRecord(inlineResult);
    const args = asArgs(data?.arguments);
    return (
      <ToolCallRow
        label={block.kind === "skill_call" ? "Skill Call" : "Tool Call"}
        conversationId={sessionId}
        view={{
          name: typeof data?.name === "string" ? data.name : block.kind,
          callId: typeof data?.id === "string" ? data.id : undefined,
          arguments: data?.arguments,
          purpose: typeof args?.purpose === "string" ? args.purpose : undefined,
          output: typeof resultData?.content === "string" ? resultData.content : undefined,
          isError: !!resultData?.is_error,
          metadata: resultData?.metadata,
          hasResult: !!inlineResult,
        }}
      />
    );
  }

  // 助手正文 / 推理：token 级增量，交给 StreamedText 只重渲染这一段。
  if (block.kind === "assistant" || block.kind === "reasoning") {
    return (
      <StreamedText
        kind={block.kind}
        content={block.content}
        error={!!block.error}
        streaming={!!block.streaming}
      />
    );
  }

  return renderAssistantMessage(
    {
      kind: block.kind,
      content: block.content,
      data: block.data,
      error: !!block.error,
      streaming: !!block.streaming,
    },
    { conversationId: sessionId },
  );
});

/**
 * 交互式任务实时流（纯展示组件）。
 *
 * 设计原则：
 *   - **不发任何请求**：不调用 `/agent/task/timeline` 回填，也不轮询任务状态。
 *     数据只有两部分：数据库历史（由外层 AgentChat 渲染）+ 内存增量（本组件渲染）。
 *   - **增量不重渲染整个列表**：每个块单独 memo，追加 token 时只有末尾一块更新。
 *   - **不强制贴底**：长任务里用户经常回看之前的输出，滚动由外层按「用户是否在底部」决定。
 */
const AgentTaskStream: FC<AgentTaskStreamProps> = ({ blocks, status, sessionId, embedded }) => {
  const running = status === "created" || status === "running" || status === "waiting";
  const statusText = STATUS_TEXT[status] ?? status;

  const body = useMemo(() => {
    if (blocks.length === 0) {
      if (!running) {
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No output
          </Text>
        );
      }
      // 等待权限时不是「等输出」：Agent 已经停下来等人批准，
      // 此时说 Waiting for output 会让人误以为卡住了。
      const waiting = status === "waiting";
      return (
        <Flex align="center" gap={6}>
          <Spin size="small" indicator={<LoadingOutlined spin />} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {waiting ? "Waiting for your approval…" : "Waiting for output…"}
          </Text>
        </Flex>
      );
    }

    return (
      <Flex vertical gap={8}>
        {blocks.map((block) => (
          <Flex key={block.key} align="flex-start" gap={8}>
            <StreamBlockRow block={block} sessionId={sessionId} />
          </Flex>
        ))}
      </Flex>
    );
  }, [blocks, running, sessionId, status]);

  return (
    <div
      style={
        embedded
          ? undefined
          : {
              background: "#ffffff",
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: "8px 12px",
            }
      }
    >
      <Flex align="center" gap={6} style={{ marginBottom: 6 }}>
        {running && <Spin size="small" indicator={<LoadingOutlined spin />} />}
        <Text type="secondary" style={{ fontSize: 11 }}>
          {statusText}
        </Text>
      </Flex>
      {body}
    </div>
  );
};

export default AgentTaskStream;

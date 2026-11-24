import { CSSProperties, FC, Fragment, ReactNode, useEffect } from "react";
import { Tag, Typography } from "antd";
import { LoadingOutlined, RightOutlined } from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";
import {
  openAgentWorkspaceTab,
  sessionWorkspaceKey,
  setActiveAgentWorkspaceTab,
  updateAgentWorkspaceTab,
  useAgentWorkspaceStore,
} from "@/layout/agent-workspace-store";

const { Text } = Typography;

export interface AgentRenderableMessage {
  content: string;
  kind?: string;
  data?: unknown;
  error?: boolean;
  streaming?: boolean;
}

/** 各类型消息的气泡配色。 */
const TONES = {
  default: { background: "#ffffff", border: "#f0f0f0" },
  reasoning: { background: "#f6ffed", border: "#b7eb8f" },
  call: { background: "#fafafa", border: "#d9d9d9" },
  result: { background: "#fafafa", border: "#d9d9d9" },
  error: { background: "#fff1f0", border: "#ffa39e" },
} as const;

type Tone = keyof typeof TONES;

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/**
 * 把「对象或 JSON 字符串」统一转成对象。
 *
 * 工具调用的 arguments 可能是已解析的对象，也可能是后端直接透传的 JSON 字符串
 * （native 路径的 Arguments 就是模型的原始参数串）。
 */
function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

/**
 * opencode 的 edit / write 工具会把 diff 放进工具结果的 metadata 里
/** 统一的气泡容器，避免各分支重复内联样式。 */
function Bubble({
  tone = "default",
  style,
  children,
}: {
  tone?: Tone;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { background, border } = TONES[tone];
  return (
    <div
      style={{
        maxWidth: "78%",
        padding: "8px 12px",
        borderRadius: 8,
        background,
        border: `1px solid ${border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 折叠面板的头部样式（工具调用行复用）。 */
const PANEL_HEADER_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: 0,
  border: "none",
  background: "transparent",
  textAlign: "left",
};

/**
 * 工具调用行渲染时需要的上下文（由聊天组件透传）。
 *
 * 聊天里只显示「Tool Call + 工具名 + 目的」，详情（入参 / 输出）放进右侧工作区标签页，
 * 因此这里需要 `conversationId` 作为该标签所属的会话（标签按会话隔离）。
 */
export interface AgentToolRenderContext {
  /** 当前会话 ID；缺失时点击只展开内联详情，不打开标签页（如 New Chat）。 */
  conversationId?: string;
  /**
   * 已经配对的工具结果（历史里 tool_result 与 tool_call 是两条消息，由调用方合并）。
   * 提供时 Tool Call 行据此显示「已完成 + 输出」，否则视为仍在执行。
   */
  result?: {
    content?: string;
    is_error?: boolean;
    metadata?: unknown;
  };
}

export type CallView = {
  /** 工具名。 */
  name: string;
  /** 调用 id（后端 toolCallId）：多个调用同名时用它区分标签页。 */
  callId?: string;
  /** 模型给的入参（对象或 JSON 字符串，原样透传）。 */
  arguments: unknown;
  /** 入参里的 purpose（后端按 schema 约定注入），仅用于展示。 */
  purpose?: string;
  /** 工具输出正文（`tool_result` 的 content）。 */
  output?: string;
  /** 结果是否错误。 */
  isError?: boolean;
  /** 结果 metadata（edit / write 的 diff 在这里）。 */
  metadata?: unknown;
  /** 是否有结果（已经执行完）；false 表示仍在执行。 */
  hasResult: boolean;
};

/** 每个调用一个标签页：key 用 tool_call_id（缺省退化为工具名）。 */
const toolCallTabKey = (view: CallView) => `tool-call:${view.callId || view.name}`;

/**
 * 标签显示名：优先用 purpose，没有时回退到工具名。
 *
 * purpose 是模型按 schema 约定的「这次调用要做什么」，比工具名更有区分度；
 * 同一工具多次调用时，多行标签靠 key（call id）区分而不是标题。
 */
const toolCallTabTitle = (view: CallView) => view.purpose?.trim() || view.name;

/** 打开 / 更新详情标签：同一调用始终复用同一个标签 key。
 *
 * `focus` 区分两种调用来源：
 *  - 用户点击调用行（`true`）：必须切到该标签，即使用户当前在看别的标签；
 *  - effect 里回填结果（`false`）：只同步内容，不抢焦点，也不重复写 store。
 */
const openToolCallTab = (
  conversationId: string | undefined,
  view: CallView,
  focus = false,
) => {
  if (!conversationId) return;
  const key = toolCallTabKey(view);
  const title = toolCallTabTitle(view);
  const params = {
    name: view.name,
    input: view.arguments,
    output: view.output,
    isError: view.isError,
    metadata: view.metadata,
    executing: !view.hasResult,
    purpose: view.purpose,
  };

  const session = useAgentWorkspaceStore.getState().bySession[sessionWorkspaceKey(conversationId)];
  const existing = session?.tabs.find((tab) => tab.key === key);

  if (existing) {
    // 内容是否与标签里的一致。
    //
    // 最关键的是 executing / output / isError：调用行在每次消息列表渲染时都会同步，
    // 若内容相同仍然写 store，就会「写 store → 重渲染 → 再同步」无限循环
    // （Maximum update depth exceeded）。input 按引用比较（message.data 引用稳定）。
    const prev = existing.params ?? {};
    const unchanged =
      existing.title === title &&
      prev.input === params.input &&
      prev.output === params.output &&
      prev.isError === params.isError &&
      prev.executing === params.executing &&
      prev.metadata === params.metadata &&
      prev.purpose === params.purpose;

    if (unchanged) {
      // 内容没变：点击时只切过去；后台同步时什么也不做（避免多余的写 store）。
      if (focus && session?.active !== key) {
        setActiveAgentWorkspaceTab(conversationId, key);
      }
      return;
    }

    if (focus) {
      // 点击：更新内容并激活（openAgentWorkspaceTab 已存在时会原地更新 + 聚焦）。
      openAgentWorkspaceTab(conversationId, { key, title, view: "agentToolCallDetail", params });
      return;
    }

    // 内容有变化：原地更新标签内容，但不抢焦点（用户可能正在看别的标签）。
    updateAgentWorkspaceTab(conversationId, { key, title, view: "agentToolCallDetail", params });
    return;
  }

  openAgentWorkspaceTab(conversationId, {
    key,
    title,
    view: "agentToolCallDetail",
    params,
  });
};

/**
 * Tool Call 行：只显示「工具名 + 目的」，不显示结果正文。
 *
 * - 点击：在右侧工作区（MainTabs）打开该调用的详情（上 Input / 下 Output）；
 * - 执行中：名称右侧显示 Executing...，结果到达后只会更新标签内容；
 * - 历史里没有结果（例如权限被拒绝 / 任务失败）时，详情里 Output 显示 No output。
 */
export function ToolCallRow({
  view,
  conversationId,
  label,
}: {
  view: CallView;
  conversationId?: string;
  label: string;
}) {
  const { name, callId, purpose, hasResult, isError } = view;
  const accent = !hasResult ? "#1677ff" : isError ? "#ff4d4f" : "#8c8c8c";
  const canOpen = !!conversationId;

  // 「先点击、后出结果」：标签打开时还是 Executing...，结果到达后调用行会重渲染，
  // 这里把最新结果回填到已打开的标签，避免用户停留在过期的 Executing... 状态。
  //
  // 只有标签已经打开时才同步（避免用户没点也弹标签）；openToolCallTab 本身幂等，
  // 内容没变不会写 store，因此不会出现「setState → 重渲染 → effect」的无限循环。
  // 依赖只用原始值：view 每次渲染都是新对象，放进依赖会反复触发。
  useEffect(() => {
    if (!conversationId) return;
    const isOpen = useAgentWorkspaceStore
      .getState()
      .bySession[sessionWorkspaceKey(conversationId)]
      ?.tabs.some((tab) => tab.key === toolCallTabKey(view));
    if (!isOpen) return;
    openToolCallTab(conversationId, view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, callId, name, hasResult, view.output, view.isError, view.metadata, purpose]);

  return (
    <Bubble
      tone={hasResult && isError ? "error" : "call"}
      style={{ width: "78%", minWidth: 0, boxSizing: "border-box" }}
    >
      <button
        type="button"
        title={canOpen ? "Open tool call details" : undefined}
        // 没有会话 ID（如 New Chat）时无法为该会话开标签，行不可点击。
        // 点击一律聚焦该调用对应的标签（即使之前已经打开过）。
        onClick={() => canOpen && openToolCallTab(conversationId, view, true)}
        style={{
          ...PANEL_HEADER_STYLE,
          cursor: canOpen ? "pointer" : "default",
          padding: "2px 0",
        }}
      >
        <Text strong style={{ fontSize: 12, color: isError ? "#ff4d4f" : "inherit" }}>
          {label}
        </Text>
        <Tag color="geekblue" style={{ marginInlineEnd: 0, lineHeight: "18px" }}>
          {name}
        </Tag>
        {purpose && (
          <Text type="secondary" style={{ flex: 1, minWidth: 0, fontSize: 12 }} ellipsis>
            {purpose}
          </Text>
        )}
        {!hasResult ? (
          <Text type="secondary" style={{ fontSize: 11, color: accent }}>
            <LoadingOutlined style={{ marginRight: 4 }} />
            Executing...
          </Text>
        ) : (
          canOpen && <RightOutlined style={{ fontSize: 10, color: accent }} />
        )}
      </button>
    </Bubble>
  );
}

/** 被折叠的 Tool Result：内容已经在对应 Tool Call 的详情标签里展示。 */
function ToolResultRow({ name }: { name: string }) {
  return (
    <Bubble tone="result" style={{ width: "78%", minWidth: 0, boxSizing: "border-box" }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Tool Result
      </Text>
      <Tag style={{ marginInlineStart: 6, marginInlineEnd: 0, lineHeight: "18px" }}>{name}</Tag>
    </Bubble>
  );
}

/**
 * 流式文本（助手正文 / 推理）。
 *
 * 只负责「把一段不断增长的文本渲染成 Markdown」，不参与消息列表结构：
 * 外层消息列表在追加 token 时不会重渲染（见 agent-chat.tsx 的 MessageRow memo）。
 *
 * 为什么要单独成组件：如果正文和整个消息列表放在一起，每来一个 token 都会重算
 * 整列表的 Markdown / 配对逻辑，长任务下会持续掉帧。这里重渲染成本只有一段文本。
 */
export const StreamedText: FC<{
  kind?: string;
  content: string;
  error?: boolean;
  streaming?: boolean;
}> = ({ kind, content, error, streaming }) => {
  const reasoning = kind === "reasoning";

  if (error) {
    return (
      <Bubble tone="error">
        <div style={{ color: "#ff4d4f", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</div>
      </Bubble>
    );
  }

  return (
    <Bubble tone={reasoning ? "reasoning" : "default"} style={{ flex: 1, minWidth: 0, maxWidth: "78%" }}>
      {reasoning && (
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Reasoning
          </Text>
          {streaming && (
            <Tag color="processing" style={{ marginLeft: 6, lineHeight: "16px", fontSize: 11 }}>
              streaming
            </Tag>
          )}
        </div>
      )}
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {reasoning ? <Text style={{ fontSize: 13 }}>{content}</Text> : <XMarkdown>{content}</XMarkdown>}
        {streaming && (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
            ...
          </Text>
        )}
      </div>
    </Bubble>
  );
};

export function renderAssistantMessage(
  message: AgentRenderableMessage,
  context?: AgentToolRenderContext,
): ReactNode {
  const kind = message.kind ?? "assistant";

  // 正文 / 推理走 token 级增量组件：内容变化时只重渲染这一段文本，
  // 不再重算整条消息（Markdown 解析 + 气泡），这是长任务流畅度的关键。
  if ((kind === "assistant" || kind === "reasoning") && !message.error) {
    return (
      <StreamedText
        kind={kind}
        content={message.content}
        streaming={!!message.streaming}
      />
    );
  }

  if (kind === "tool_call" || kind === "skill_call") {
    const data = asRecord(message.data);
    // purpose 由模型按 schema 约定附在工具入参中（见后端 withPurposeProperty），
    // 仅用于展示：这里直接从 arguments 取，缺失时不渲染。
    const args = asJsonRecord(data?.arguments);
    const result = context?.result;
    return (
      <ToolCallRow
        label={kind === "tool_call" ? "Tool Call" : "Skill Call"}
        conversationId={context?.conversationId}
        view={{
          name: typeof data?.name === "string" ? data.name : kind,
          callId: typeof data?.id === "string" ? data.id : undefined,
          arguments: data?.arguments,
          purpose: typeof args?.purpose === "string" ? args.purpose : undefined,
          output: result?.content,
          isError: !!result?.is_error,
          metadata: result?.metadata,
          hasResult: !!result,
        }}
      />
    );
  }

  if (kind === "tool_result" || kind === "skill_result") {
    // 结果正文只在对应的 Tool Call 详情标签里展示，这里保留一行摘要（含 diff 统计），
    // 不再把 output 正文铺到对话流里。
    const data = asRecord(message.data);
    const name = typeof data?.name === "string" ? data.name : kind;
    return <ToolResultRow name={name} />;
  }

  return (
    <StreamedText
      content={message.content}
      error={!!message.error}
      streaming={!!message.streaming}
    />
  );
}

export interface RenderAssistantMessagesOptions {
  /** 该列表所属的会话 ID：Tool Call 行点击后在右侧工作区为它打开详情标签。 */
  conversationId?: string;
  /** 列表中每条消息的稳定 key（长度与 messages 一致）；缺省用下标。 */
  keys?: readonly string[];
}

const isToolCallKind = (kind?: string) => kind === "tool_call" || kind === "skill_call";
const isToolResultKind = (kind?: string) => kind === "tool_result" || kind === "skill_result";

/**
 * 工具结果携带的调用 id（与 tool_call.data.id 对应）。
 *
 * 后端两条执行路径（runtime 的 ToolResultEvent 与 native Agent 的 emitToolResult）
 * 都统一使用 `tool_call_id`，因此这里只认这一个字段。
 */
const toolResultCallId = (message: AgentRenderableMessage): string => {
  const data = asRecord(message.data);
  const id = data?.tool_call_id;
  return typeof id === "string" ? id : "";
};

const toolCallId = (message: AgentRenderableMessage): string => {
  const id = asRecord(message.data)?.id;
  return typeof id === "string" ? id : "";
};

/**
 * 渲染一条消息列表，并把 tool_call 与它的 tool_result 配对。
 *
 * 为什么需要配对：聊天里只显示「Tool Call + 工具名 + 目的」，结果正文只在点击打开的
 * 详情标签里出现。调用行需要知道结果的到达情况（Executing... / 已完成），才能在点击
 * 时把输出一起带进标签页，因此先在列表范围内完成配对，再交给单条渲染。
 *
 * 配对规则（同一次工具调用共用同一个 call id）：
 *  - 优先用结果的 `data.call_id` 精确匹配调用的 `data.id`；
 *  - 历史里部分 provider 不回填 call id：退化为「同名、按出现顺序」对应。
 *
 * 已被配对的结果不再单独成行（它的正文只在详情标签里）；孤立的结果仍保留一行摘要。
 */
export function renderAssistantMessages(
  messages: AgentRenderableMessage[],
  options: RenderAssistantMessagesOptions = {},
): ReactNode[] {
  const context: AgentToolRenderContext = { conversationId: options.conversationId };

  const resultsByCallId = new Map<string, AgentRenderableMessage>();
  const resultsByName = new Map<string, AgentRenderableMessage[]>();
  const consumedResults = new Set<AgentRenderableMessage>();

  messages.forEach((message) => {
    if (!isToolResultKind(message.kind)) return;
    const callId = toolResultCallId(message);
    if (callId) {
      if (!resultsByCallId.has(callId)) resultsByCallId.set(callId, message);
      return;
    }
    const data = asRecord(message.data);
    const name = typeof data?.name === "string" ? data.name : "";
    const queue = resultsByName.get(name) ?? [];
    queue.push(message);
    resultsByName.set(name, queue);
  });

  const takeResult = (call: AgentRenderableMessage): AgentRenderableMessage | undefined => {
    const callId = toolCallId(call);
    const exact = callId ? resultsByCallId.get(callId) : undefined;
    if (exact && !consumedResults.has(exact)) {
      consumedResults.add(exact);
      return exact;
    }
    const name = asRecord(call.data)?.name;
    const queue = typeof name === "string" ? resultsByName.get(name) : undefined;
    const next = queue?.find((candidate) => !consumedResults.has(candidate));
    if (next) {
      consumedResults.add(next);
      return next;
    }
    return undefined;
  };

  return messages.map((message, index) => {
    const key = options.keys?.[index] ?? String(index);

    if (isToolResultKind(message.kind)) {
      const data = asRecord(message.data);
      const name = typeof data?.name === "string" ? data.name : "tool_result";
      return <ToolResultRow key={key} name={name} />;
    }

    if (!isToolCallKind(message.kind)) {
      return <Fragment key={key}>{renderAssistantMessage(message, context)}</Fragment>;
    }

    const callData = asRecord(message.data);
    const args = asJsonRecord(callData?.arguments);
    // 实时流可能已经就地把结果并入调用（tool_call.data.result），
    // 此时列表里没有独立的 tool_result 行，直接用它作为该调用的结果。
    const inlineResult = asRecord(callData?.result) ? callData?.result : undefined;
    const result = takeResult(message) ?? (inlineResult ? { kind: "tool_result", content: "", data: inlineResult } : undefined);
    const resultData = asRecord(result?.data);
    return (
      <ToolCallRow
        key={key}
        label={message.kind === "skill_call" ? "Skill Call" : "Tool Call"}
        conversationId={options.conversationId}
        view={{
          name: typeof callData?.name === "string" ? callData.name : message.kind ?? "tool_call",
          callId: typeof callData?.id === "string" ? callData.id : undefined,
          arguments: callData?.arguments,
          purpose: typeof args?.purpose === "string" ? args.purpose : undefined,
          output: result
            ? typeof resultData?.content === "string"
              ? resultData.content
              : result.content
            : undefined,
          isError: !!result?.error || !!resultData?.is_error,
          metadata: resultData?.metadata,
          hasResult: !!result,
        }}
      />
    );
  });
}

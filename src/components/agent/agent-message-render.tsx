import { CSSProperties, ReactNode, useState } from "react";
import { Tag, Typography } from "antd";
import { CaretRightOutlined } from "@ant-design/icons";
import XMarkdown from "@ant-design/x-markdown";

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

const PRE_STYLE: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pretty(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

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

/** 折叠面板的头部/正文样式，供工具调用与工具结果复用。 */
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

const PANEL_BODY_STYLE: CSSProperties = {
  ...PRE_STYLE,
  padding: "6px 8px",
  maxHeight: 320,
  overflow: "auto",
  background: "#ffffff",
  border: "1px solid #f0f0f0",
  borderRadius: 6,
  fontFamily: "monospace",
};

/** 工具/技能调用与结果：默认折叠为单行摘要，点击标题展开全文。 */
function CollapsibleBubble({
  label,
  name,
  content,
  tone,
  isError = false,
}: {
  label: string;
  name: string;
  content: string;
  tone: Tone;
  isError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const collapsible = content.length > 0;
  const accent = isError ? "#ff4d4f" : "#8c8c8c";

  return (
    <Bubble
      tone={tone}
      // 固定宽度：折叠/展开保持一致；minWidth 0 防止 nowrap 预览把 flex 项撑大。
      style={{ width: "78%", minWidth: 0, boxSizing: "border-box" }}
    >
      <button
        type="button"
        onClick={() => collapsible && setOpen((v) => !v)}
        style={{ ...PANEL_HEADER_STYLE, cursor: collapsible ? "pointer" : "default" }}
      >
        {collapsible && (
          <CaretRightOutlined rotate={open ? 90 : 0} style={{ fontSize: 10, color: accent }} />
        )}
        <Text strong style={{ fontSize: 12, color: isError ? "#ff4d4f" : "inherit" }}>
          {label}
        </Text>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 13 }} ellipsis>
          {name}
        </Text>
        {collapsible && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {open ? "收起" : "展开"}
          </Text>
        )}
      </button>

      {collapsible &&
        (open ? (
          <div style={{ ...PANEL_BODY_STYLE, color: isError ? "#ff4d4f" : "#595959" }}>{content}</div>
        ) : (
          <Text type="secondary" ellipsis style={{ display: "block", marginTop: 4, fontSize: 12 }}>
            {content}
          </Text>
        ))}
    </Bubble>
  );
}

export function renderAssistantMessage(message: AgentRenderableMessage): ReactNode {
  const kind = message.kind ?? "assistant";

  if (kind === "reasoning") {
    return (
      <Bubble tone="reasoning">
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Reasoning
          </Text>
          {message.streaming && (
            <Tag color="processing" style={{ marginLeft: 6, lineHeight: "16px", fontSize: 11 }}>
              streaming
            </Tag>
          )}
        </div>
        <Text style={{ fontSize: 13 }}>{message.content}</Text>
      </Bubble>
    );
  }

  if (kind === "tool_call" || kind === "skill_call") {
    const data = asRecord(message.data);
    return (
      <CollapsibleBubble
        label={kind === "tool_call" ? "Tool Call" : "Skill Call"}
        name={typeof data?.name === "string" ? data.name : kind}
        content={pretty(data?.arguments)}
        tone="call"
      />
    );
  }

  if (kind === "tool_result" || kind === "skill_result") {
    const data = asRecord(message.data);
    const isError = !!data?.is_error;
    return (
      <CollapsibleBubble
        label={kind === "tool_result" ? "Tool Result" : "Skill Result"}
        name={typeof data?.name === "string" ? data.name : kind}
        content={typeof data?.content === "string" ? data.content : message.content}
        tone={isError ? "error" : "result"}
        isError={isError}
      />
    );
  }

  return (
    <Bubble tone={message.error ? "error" : "default"}>
      <div
        style={{
          color: message.error ? "#ff4d4f" : "inherit",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.error ? message.content : <XMarkdown>{message.content}</XMarkdown>}
        {message.streaming && (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
            ...
          </Text>
        )}
      </div>
    </Bubble>
  );
}

import { ReactNode } from "react";
import { Tag, Typography } from "antd";
import XMarkdown from "@ant-design/x-markdown";

const { Text } = Typography;

export interface AgentRenderableMessage {
  content: string;
  kind?: string;
  data?: unknown;
  error?: boolean;
  streaming?: boolean;
}

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

export function renderAssistantMessage(message: AgentRenderableMessage): ReactNode {
  const kind = message.kind ?? "assistant";

  if (kind === "reasoning") {
    return (
      <div
        style={{
          maxWidth: "78%",
          padding: "8px 12px",
          borderRadius: 8,
          background: "#f6ffed",
          border: "1px solid #b7eb8f",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
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
      </div>
    );
  }

  if (kind === "tool_call" || kind === "skill_call") {
    const data = asRecord(message.data);
    const name = typeof data?.name === "string" ? data.name : kind;
    const args = data?.arguments;
    return (
      <div
        style={{
          maxWidth: "78%",
          padding: "8px 12px",
          borderRadius: 8,
          background: "#fafafa",
          border: "1px solid #d9d9d9",
        }}
      >
        <Text strong style={{ fontSize: 12 }}>{kind === "tool_call" ? "Tool Call" : "Skill Call"}</Text>
        <div style={{ fontSize: 13, marginTop: 4 }}>{name}</div>
        {args !== undefined && (
          <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {pretty(args)}
          </pre>
        )}
      </div>
    );
  }

  if (kind === "tool_result" || kind === "skill_result") {
    const data = asRecord(message.data);
    const name = typeof data?.name === "string" ? data.name : kind;
    const isError = !!data?.is_error;
    const content = typeof data?.content === "string" ? data.content : message.content;
    return (
      <div
        style={{
          maxWidth: "78%",
          padding: "8px 12px",
          borderRadius: 8,
          background: isError ? "#fff1f0" : "#fafafa",
          border: `1px solid ${isError ? "#ffa39e" : "#d9d9d9"}`,
        }}
      >
        <Text strong style={{ fontSize: 12, color: isError ? "#ff4d4f" : "inherit" }}>
          {kind === "tool_result" ? "Tool Result" : "Skill Result"}
        </Text>
        <div style={{ fontSize: 13, marginTop: 4 }}>{name}</div>
        {content && (
          <Text
            type={isError ? "danger" : "secondary"}
            style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", display: "block", marginTop: 4 }}
          >
            {content}
          </Text>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "78%",
        padding: "8px 12px",
        borderRadius: 8,
        background: "#ffffff",
        color: message.error ? "#ff4d4f" : "inherit",
        border: "1px solid #f0f0f0",
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
  );
}

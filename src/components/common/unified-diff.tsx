import { CSSProperties } from "react";

const MONOSPACE = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** 单行着色：与 git unified diff 记号保持一致（与 git-diff-view 同款配色）。 */
function diffLineStyle(line: string): CSSProperties {
  if (line.startsWith("@@")) return { background: "#f9f0ff", color: "#531dab" };
  if (line.startsWith("+++") || line.startsWith("---"))
    return { background: "transparent", color: "#8c8c8c" };
  if (line.startsWith("+")) return { background: "#f6ffed", color: "#135200" };
  if (line.startsWith("-")) return { background: "#fff1f0", color: "#820014" };
  return { background: "transparent", color: "inherit" };
}

export interface UnifiedDiffProps {
  /** unified diff 文本（逐行着色）。 */
  diff: string;
  /** 最大高度，超出内部滚动；默认 320。 */
  maxHeight?: number | string;
  /** 是否显示外框；默认 true。外层已带边框时传 false 以避免双层边框。 */
  bordered?: boolean;
}

/**
 * unified diff 文本的只读着色渲染。
 *
 * 供「工具结果」「权限确认」等多处复用；diff 行没有稳定 key，用行号即可
 * （内容只读、不重排）。
 */
export default function UnifiedDiff({ diff, maxHeight = 320, bordered = true }: UnifiedDiffProps) {
  return (
    <div
      style={{
        maxHeight,
        overflow: "auto",
        background: "#ffffff",
        ...(bordered ? { border: "1px solid #f0f0f0", borderRadius: 6 } : {}),
      }}
    >
      <pre style={{ margin: 0, fontFamily: MONOSPACE, fontSize: 12, lineHeight: "18px" }}>
        {diff.split("\n").map((line, index) => (
          <div
            key={index}
            style={{
              ...diffLineStyle(line),
              padding: "0 8px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {line === "" ? " " : line}
          </div>
        ))}
      </pre>
    </div>
  );
}

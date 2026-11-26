import { RobotOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { MouseEvent } from "react";
import type { AgentRefKind } from "@/components/agent/agent-sender.store";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { useInsertAgentRef } from "@/hooks/useInsertAgentRef";

export interface AskAgentButtonProps {
  /** 引用类型：决定提交时拼进消息文本的前缀 `@<kind>:<id>`。 */
  kind: AgentRefKind;
  /** 引用目标 id（为空时按钮禁用）。 */
  id?: string | number | null;
  /** chip 上展示的名字（缺省用 `kind-id`）。 */
  label?: string;
}

/**
 * 侧栏列表行内的「Ask Agent」图标按钮。
 *
 * 点击后把当前行资源作为 `@<kind>:<id>` 引用插进 Agent 输入框（面板未打开时
 * 自动切到「助手」面板），Agent 侧按 kind 用对应工具解析该资源。
 * 只渲染图标，避免在窄侧栏里挤压标题列。
 */
const AskAgentButton = ({ kind, id, label }: AskAgentButtonProps) => {
  const insertAgentRef = useInsertAgentRef();
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const zh = locale !== "en_US";
  const value = String(id ?? "").trim();

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    // 行点击通常用于打开详情，这里只负责插入引用。
    event.stopPropagation();
    if (!value) {
      return;
    }
    const ok = insertAgentRef(kind, value, { label: label || `${kind}-${value}` });
    if (ok) {
      message?.success(zh ? "已插入 Agent 引用" : "Reference added to Agent input");
    }
  };

  return (
    <Tooltip
      title={
        value
          ? (zh ? "询问 Agent" : "Ask Agent")
          : (zh ? "资源未就绪" : "Resource not ready")
      }
    >
      <Button
        type="text"
        size="small"
        icon={<RobotOutlined />}
        disabled={!value}
        aria-label="Ask Agent"
        onClick={handleClick}
      />
    </Tooltip>
  );
};

export default AskAgentButton;

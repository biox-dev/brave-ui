import { FC } from "react";
import { Button, Empty, Flex, Tag, Typography } from "antd";
import Markdown from "@/components/markdown";
import type { AgentEnvInfo } from "@/api/agent";

const { Text } = Typography;

export interface AgentSystemPromptModalProps {
  /** 已解析的业务上下文（含渲染后的 system_prompt、vars、Profile 等元信息）。 */
  envInfo?: AgentEnvInfo | null;
  /** 关闭回调（由 invoke.openAsync / open 注入；未注入时回退到 UIContainer 的 close）。 */
  onCancel?: () => void;
  /** UIContainer 注入的关闭函数。 */
  close?: () => void;
}

/**
 * AgentSystemPromptModal 用 Markdown 展示当前对话上下文渲染后的 system_prompt。
 *
 * 通过 invoke.agentSystemPromptModal.open({ envInfo }, { title, width, footer: null }) 弹出，
 * 供 AgentChat 顶部的上下文按钮查看（弹窗内只读渲染，不做编辑）。
 */
const AgentSystemPromptModal: FC<AgentSystemPromptModalProps> = ({ envInfo, onCancel, close }) => {
  // 兼容两种打开方式：openAsync（注入 onCancel）与 UIContainer（注入 close）。
  const handleClose = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const prompt = envInfo?.system_prompt?.trim();

  return (
    <Flex vertical gap={12}>
      {/* 上下文元信息：类型 / Profile / 标签。 */}
      {(envInfo?.type || envInfo?.profile_name || envInfo?.label) && (
        <Flex align="center" gap={8} wrap>
          {envInfo?.type && <Tag color="processing">Type: {envInfo.type}</Tag>}
          {envInfo?.profile_name && <Tag color="blue">Profile: {envInfo.profile_name}</Tag>}
          {envInfo?.label && <Tag>{envInfo.label}</Tag>}
        </Flex>
      )}

      {prompt ? (
        <div
          style={{
            maxHeight: "60vh",
            overflow: "auto",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 12,
            background: "#fafafa",
          }}
        >
          <Markdown data={prompt} />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">No system prompt for this context</Text>}
        />
      )}

      <Flex justify="end">
        <Button onClick={handleClose}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default AgentSystemPromptModal;

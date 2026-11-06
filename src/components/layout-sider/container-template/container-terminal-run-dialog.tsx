import { useCallback, useState } from "react";
import { Button, Flex, Input, Space, Tag, Typography } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { execContainerTerminalSessionApi } from "@/api/container-template-terminal";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { openBottomTerminal } from "@/layout/bottom-panel-store";

export interface ContainerTerminalRunDialogProps {
  /** 目标终端会话 ID（终端会话 = 应用会话，即 AppSession.ID）。 */
  sessionId: string;
  /** 会话展示名：用于弹窗标题与底部终端标签标题。 */
  name?: string;
  /** 初始命令（默认 `pwd`）。 */
  command?: string;
  /** 提交成功（由 invoke.openAsync 注入：resolve 并关闭弹窗）。 */
  onOk?: (sessionId: string) => void;
  /** 取消（由 invoke.openAsync 注入：reject 并关闭弹窗）。 */
  onCancel?: () => void;
  /** 关闭自身（由 UIContainer 注入，`invoke.open` 时使用）。 */
  close?: () => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
    if (msg) {
      return msg;
    }
  }
  return fallback;
};

/**
 * 「Run in terminal」弹窗（通过 invoke 打开，如
 * `invoke.containerTerminalRunDialog.openAsync({ sessionId, name })`）。
 *
 * 命令只投递给「已存在的终端会话」：会话由容器模板 / 应用会话创建，容器已启动；
 * 这里 `POST /container/terminal/session/{id}/terminal/exec` 只投递命令
 * （`wait_seconds: 0` 立即返回），输出通过该会话的 WebSocket 实时回传。
 * 提交成功后自动打开（或聚焦）底部终端标签。
 */
const ContainerTerminalRunDialog = ({
  sessionId,
  name,
  command,
  onOk,
  onCancel,
  close,
}: ContainerTerminalRunDialogProps) => {
  const [commandText, setCommandText] = useState(() => command?.trim() || "pwd");
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  }, [onCancel, close]);

  const handleSubmit = useCallback(async () => {
    const trimmed = commandText.trim();
    if (!trimmed) {
      getGlobalMessage()?.warning("Please input a command");
      return;
    }

    setSubmitting(true);
    try {
      await execContainerTerminalSessionApi(sessionId, {
        command: trimmed,
        wait_seconds: 0,
      });
      // 命令输出走该会话的 WebSocket，这里只需打开（或聚焦）底部终端标签。
      openBottomTerminal(sessionId, name);
      getGlobalMessage()?.success("Command submitted to terminal");
      if (onOk) {
        onOk(sessionId);
        return;
      }
      close?.();
    } catch (error) {
      getGlobalMessage()?.error(getErrorMessage(error, "Failed to run command"));
    } finally {
      setSubmitting(false);
    }
  }, [commandText, sessionId, name, onOk, close]);

  return (
    <div>
      <Space size={6} wrap style={{ marginBottom: 8 }}>
        <Tag color="blue" icon={<CodeOutlined />} style={{ marginInlineEnd: 0 }}>
          {name || sessionId}
        </Tag>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {sessionId}
        </Typography.Text>
      </Space>

      <Input.TextArea
        autoSize={{ minRows: 4, maxRows: 12 }}
        value={commandText}
        onChange={(e) => setCommandText(e.target.value)}
        placeholder="例如：R --version"
        style={{ fontFamily: '"Menlo", "Consolas", monospace', fontSize: 13 }}
        autoFocus
        onPressEnter={(e) => {
          // Enter 直接提交；Shift+Enter 换行。
          if (!e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
      />

      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}
      >
        命令会写入该终端会话（容器已启动），提交后自动打开底部终端面板。
      </Typography.Paragraph>

      <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>
          Run
        </Button>
      </Flex>
    </div>
  );
};

export default ContainerTerminalRunDialog;

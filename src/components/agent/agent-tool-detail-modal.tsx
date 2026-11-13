import { FC, useEffect, useState } from "react";
import { Alert, Button, Descriptions, Flex, Spin, Typography } from "antd";
import { getAgentToolApi, type AgentToolItem } from "@/api/agent";

const { Text } = Typography;

export interface AgentToolDetailModalProps {
  /** 工具名（后端工具注册表中的 name），由调用方传入。 */
  name?: string;
  /** 关闭回调（openAsync 注入）。 */
  onCancel?: () => void;
  /** UIContainer 注入的关闭函数。 */
  close?: () => void;
}

/**
 * AgentToolDetailModal 以只读方式展示单个工具的详情。
 *
 * 数据来自 GET /agent/tool/get（与 Provider 注入给模型的工具定义同源）：
 * 工具名、描述与入参 JSON Schema。工具不存在（404）时在弹窗内提示。
 *
 * 通过 invoke.agentToolDetailModal.open({ name }, { title, width, footer: null }) 打开。
 */
const AgentToolDetailModal: FC<AgentToolDetailModalProps> = ({ name, onCancel, close }) => {
  // 兼容两种打开方式：openAsync（注入 onCancel）与 UIContainer（注入 close）。
  const handleClose = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AgentToolItem | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const toolName = name?.trim();
    if (!toolName) {
      return;
    }
    // 防止快速切换工具时旧请求覆盖新结果。
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setDetail(null);
    // skipGlobalError：工具不存在属于弹窗自己的空态，不需要全局报错提示。
    getAgentToolApi(toolName, { skipGlobalError: true })
      .then((res) => {
        if (!cancelled) {
          setDetail(res.data ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load tool");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <Flex vertical gap={12}>
      {loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      ) : loadError ? (
        <Alert type="error" showIcon message="Failed to load tool" description={loadError} />
      ) : !detail ? (
        <Alert
          type="warning"
          showIcon
          message={name}
          description="Tool is not registered in the current tool registry (ignored at runtime)."
        />
      ) : (
        <>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Name">{detail.name}</Descriptions.Item>
            <Descriptions.Item label="Description">
              {detail.description || "-"}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Input Schema
            </Text>
            <pre
              style={{
                margin: "6px 0 0",
                maxHeight: "55vh",
                overflow: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
                background: "#fafafa",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                lineHeight: 1.6,
                color: "#595959",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            >
              {JSON.stringify(detail.input_schema ?? {}, null, 2)}
            </pre>
          </div>
        </>
      )}

      <Flex justify="end">
        <Button onClick={handleClose}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default AgentToolDetailModal;

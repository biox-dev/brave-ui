import { Button, Descriptions, Flex, Space, Spin, Typography } from "antd";
import { FC, useEffect, useState, type CSSProperties } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { getAgentTaskRequestApi, type AgentTaskLLMRequest } from "@/api/agent";

const { Text } = Typography;

const preStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  background: "#f5f5f5",
  borderRadius: 4,
  maxHeight: 320,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
};

interface TaskLLMRequestModalProps {
  taskId?: string;
  onCancel?: () => void;
}

const TaskLLMRequestModal: FC<TaskLLMRequestModalProps> = ({ taskId, onCancel }) => {
  const [req, setReq] = useState<AgentTaskLLMRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await getAgentTaskRequestApi(taskId);
      setReq(res.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return (
    <Flex vertical gap="small">
      <Space>
        <Text type="secondary">Task: {taskId}</Text>
        <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Spin spinning={loading}>
        {error ? (
          <Text type="danger">Failed to load LLM request</Text>
        ) : req ? (
          <Flex vertical gap="small">
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Provider">{req.provider || "-"}</Descriptions.Item>
              <Descriptions.Item label="Model">{req.model || "-"}</Descriptions.Item>
              <Descriptions.Item label="Profile">{req.profile || "-"}</Descriptions.Item>
              <Descriptions.Item label="Stream">{req.stream ? "true" : "false"}</Descriptions.Item>
              <Descriptions.Item label="Working Dir" span={2}>
                {req.working_dir || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Skills" span={2}>
                {req.skills?.length ? req.skills.join(", ") : "-"}
              </Descriptions.Item>
            </Descriptions>

            <Text strong>System Prompt</Text>
            <pre style={preStyle}>{req.system_prompt || "(empty)"}</pre>

            <Text strong>Messages ({req.messages?.length ?? 0})</Text>
            {req.messages?.length ? (
              <Flex vertical gap="small">
                {req.messages.map((m, i) => (
                  <Flex key={i} vertical gap={2}>
                    <Text type="secondary">{m.role}</Text>
                    <pre style={preStyle}>{m.content}</pre>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Text type="secondary">(no messages)</Text>
            )}

            <Text strong>Raw JSON</Text>
            <pre style={preStyle}>{JSON.stringify(req, null, 2)}</pre>
          </Flex>
        ) : (
          <Text type="secondary">No data</Text>
        )}
      </Spin>

      <Flex justify="end">
        <Button onClick={() => onCancel && onCancel()}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default TaskLLMRequestModal;

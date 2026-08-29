import { Button, Flex, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useState } from "react";
import { ReloadOutlined } from "@ant-design/icons";
import { getAgentTaskEventsApi, type AgentEventItem } from "@/api/agent";

const { Text } = Typography;

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const formatPayload = (payload?: unknown) => {
  if (payload === undefined || payload === null) return "-";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

const columns: ColumnsType<AgentEventItem> = [
  {
    title: "Seq",
    dataIndex: "sequence",
    key: "sequence",
    width: 80,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
  {
    title: "Type",
    dataIndex: "type",
    key: "type",
    width: 180,
    render: (value: string) => value || "-",
  },
  {
    title: "Payload",
    dataIndex: "payload",
    key: "payload",
    ellipsis: true,
    render: (value: unknown) => formatPayload(value),
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
];

interface TaskEventsModalProps {
  taskId?: string;
  onCancel?: () => void;
}

const TaskEventsModal: FC<TaskEventsModalProps> = ({ taskId, onCancel }) => {
  const [events, setEvents] = useState<AgentEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await getAgentTaskEventsApi(taskId, 0);
      setEvents(res.data ?? []);
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

      <Table<AgentEventItem>
        rowKey="id"
        columns={columns}
        dataSource={events}
        loading={loading}
        size="small"
        scroll={{ x: 800, y: 360 }}
        locale={{ emptyText: error ? "Failed to load events" : "No events" }}
        pagination={false}
      />

      <Flex justify="end">
        <Button onClick={() => onCancel && onCancel()}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default TaskEventsModal;

import { ReloadOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Flex,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import {
  getAgentTaskApi,
  getAgentTaskEventsApi,
  type AgentEventItem,
  type AgentTaskItem,
} from "@/api/agent";

export interface AISummaryTaskModalProps {
  taskId?: string | number;
  close?: () => void;
}

const TASK_STATUS_COLOR: Record<string, string> = {
  created: "default",
  running: "processing",
  waiting_permission: "warning",
  completed: "success",
  failed: "error",
  canceled: "default",
};

const PRE_STYLE: CSSProperties = {
  margin: 0,
  padding: 8,
  background: "#f5f5f5",
  borderRadius: 4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
  maxHeight: 200,
  overflow: "auto",
};

const formatTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatPayload = (payload: unknown) => {
  if (payload === null || payload === undefined) return "";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

const eventColor = (type: string): string => {
  if (type.includes("failed") || type.includes("error")) return "red";
  if (type.includes("completed")) return "green";
  if (type.includes("canceled")) return "gray";
  return "blue";
};

/**
 * 弹窗展示 AISummary 关联的 Agent 任务及其事件流。
 */
const AISummaryTaskModal = ({ taskId }: AISummaryTaskModalProps) => {
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<AgentTaskItem | null>(null);
  const [events, setEvents] = useState<AgentEventItem[]>([]);

  const loadData = useCallback(() => {
    if (taskId === undefined || taskId === null || taskId === "") {
      return;
    }

    const id = String(taskId);
    setLoading(true);
    Promise.all([getAgentTaskApi(id), getAgentTaskEventsApi(id)])
      .then(([taskRes, eventsRes]) => {
        setTask(taskRes.data ?? null);
        setEvents(eventsRes.data ?? []);
      })
      .catch(() => {
        // 错误提示已由 http 响应拦截器统一处理。
      })
      .finally(() => {
        setLoading(false);
      });
  }, [taskId]);

  useEffect(() => {
    if (taskId === undefined || taskId === null || taskId === "") {
      return;
    }

    loadData();
  }, [loadData]);

  return (
    <Spin spinning={loading}>
      {!task ? (
        <Flex align="center" justify="space-between">
          <Typography.Text type="secondary">No task available</Typography.Text>
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
            aria-label="Refresh"
          />
        </Flex>
      ) : (
        <Flex vertical gap={16}>
          <Flex align="center" justify="space-between">
            <Typography.Text strong>Agent Task</Typography.Text>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              aria-label="Refresh"
            />
          </Flex>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Task ID">{task.id}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={TASK_STATUS_COLOR[task.status] ?? "default"}>
                {task.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Provider">
              {task.provider || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Model">
              {task.model || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {formatTime(task.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {formatTime(task.updated_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Started">
              {formatTime(task.started_at)}
            </Descriptions.Item>
            <Descriptions.Item label="Finished">
              {formatTime(task.finished_at)}
            </Descriptions.Item>
            {task.error && (
              <Descriptions.Item label="Error" span={2}>
                <Typography.Text type="danger">{task.error}</Typography.Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          <div>
            <Typography.Text strong>Agent Events ({events.length})</Typography.Text>
            {events.length === 0 ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
                No events
              </Typography.Paragraph>
            ) : (
              <Timeline
                style={{ marginTop: 12 }}
                items={events.map((ev) => ({
                  color: eventColor(ev.type),
                  children: (
                    <Flex vertical gap={4}>
                      <Space size={8}>
                        <Tag>{ev.type}</Tag>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          #{ev.sequence} · {formatTime(ev.created_at)}
                        </Typography.Text>
                      </Space>
                      {ev.payload !== null && ev.payload !== undefined && (
                        <pre style={PRE_STYLE}>{formatPayload(ev.payload)}</pre>
                      )}
                    </Flex>
                  ),
                }))}
              />
            )}
          </div>
        </Flex>
      )}
    </Spin>
  );
};

export default AISummaryTaskModal;

import { ReloadOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Flex,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  getAgentTaskApi,
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

const formatTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

/**
 * 弹窗展示 AISummary 关联的 Agent 任务详情。
 */
const AISummaryTaskModal = ({ taskId }: AISummaryTaskModalProps) => {
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<AgentTaskItem | null>(null);

  const loadData = useCallback(() => {
    if (taskId === undefined || taskId === null || taskId === "") {
      return;
    }

    const id = String(taskId);
    setLoading(true);
    getAgentTaskApi(id)
      .then((taskRes) => {
        setTask(taskRes.data ?? null);
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
        </Flex>
      )}
    </Spin>
  );
};

export default AISummaryTaskModal;

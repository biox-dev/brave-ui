import { Button, Flex, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useState } from "react";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  AgentPermissionStatus,
  approveAgentPermissionApi,
  denyAgentPermissionApi,
  getAgentPendingPermissionsApi,
  type AgentPermissionItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const STATUS_COLORS: Record<string, string> = {
  [AgentPermissionStatus.Pending]: "gold",
  [AgentPermissionStatus.Approved]: "green",
  [AgentPermissionStatus.Denied]: "red",
  [AgentPermissionStatus.Expired]: "default",
  [AgentPermissionStatus.Canceled]: "default",
  [AgentPermissionStatus.Consumed]: "blue",
};

interface ActionHandlers {
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  resolvingId?: string;
}

const createColumns = ({ onApprove, onDeny, resolvingId }: ActionHandlers): ColumnsType<AgentPermissionItem> => [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 200,
    ellipsis: true,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 120,
    render: (value: string) => (
      <Tag color={STATUS_COLORS[value] ?? "default"}>{value}</Tag>
    ),
  },
  {
    title: "Operation Type",
    key: "operation_type",
    width: 140,
    render: (_: unknown, record) => record.operation?.type || "-",
  },
  {
    title: "Operation",
    key: "operation",
    ellipsis: true,
    render: (_: unknown, record) => {
      const op = record.operation;
      if (!op) return "-";
      return op.path || op.command || op.content || "-";
    },
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Actions",
    key: "actions",
    width: 180,
    fixed: "right",
    render: (_: unknown, record) => {
      const pending = record.status === AgentPermissionStatus.Pending;
      const loading = resolvingId === record.id;
      return (
        <Space size="small">
          <Popconfirm
            title="Approve this permission?"
            disabled={!pending}
            onConfirm={() => onApprove(record.id)}
          >
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              disabled={!pending}
              loading={loading}
            >
              Approve
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Deny this permission?"
            disabled={!pending}
            onConfirm={() => onDeny(record.id)}
          >
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              disabled={!pending}
              loading={loading}
            >
              Deny
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  },
];

interface TaskPermissionsModalProps {
  taskId?: string;
  onCancel?: () => void;
}

const TaskPermissionsModal: FC<TaskPermissionsModalProps> = ({ taskId, onCancel }) => {
  const [perms, setPerms] = useState<AgentPermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState<string>();

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await getAgentPendingPermissionsApi(taskId);
      setPerms(res.data ?? []);
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

  const handleApprove = async (id: string) => {
    setResolvingId(id);
    try {
      await approveAgentPermissionApi(id);
      getGlobalMessage()?.success("Permission approved");
      await load();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  const handleDeny = async (id: string) => {
    setResolvingId(id);
    try {
      await denyAgentPermissionApi(id);
      getGlobalMessage()?.success("Permission denied");
      await load();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  const columns = createColumns({
    onApprove: handleApprove,
    onDeny: handleDeny,
    resolvingId,
  });

  return (
    <Flex vertical gap="small">
      <Space>
        <Text type="secondary">Task: {taskId}</Text>
        <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Table<AgentPermissionItem>
        rowKey="id"
        columns={columns}
        dataSource={perms}
        loading={loading}
        size="small"
        scroll={{ x: 800, y: 320 }}
        locale={{ emptyText: error ? "Failed to load permissions" : "No pending permissions" }}
        pagination={false}
      />

      <Flex justify="end">
        <Button onClick={() => onCancel && onCancel()}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default TaskPermissionsModal;

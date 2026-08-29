import { useEffect, useState } from "react";
import { Button, Card, Flex, Input, Popconfirm, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAgentPermissionPageQuery } from "@/hooks/usePaginationV2";
import {
  AgentPermissionStatus,
  approveAgentPermissionApi,
  denyAgentPermissionApi,
  type AgentPermissionItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

const STATUS_OPTIONS = [
  { label: "Pending", value: AgentPermissionStatus.Pending },
  { label: "Approved", value: AgentPermissionStatus.Approved },
  { label: "Denied", value: AgentPermissionStatus.Denied },
  { label: "Expired", value: AgentPermissionStatus.Expired },
  { label: "Canceled", value: AgentPermissionStatus.Canceled },
  { label: "Consumed", value: AgentPermissionStatus.Consumed },
];

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

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
    width: 220,
    ellipsis: true,
  },
  {
    title: "Task ID",
    dataIndex: "task_id",
    key: "task_id",
    width: 220,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 130,
    render: (value: string) => value || "-",
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
    title: "Resolved At",
    dataIndex: "resolved_at",
    key: "resolved_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Resolved By",
    dataIndex: "resolved_by",
    key: "resolved_by",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
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

const AgentPermissionPage = () => {
  const [taskID, setTaskID] = useState<string>();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [resolvingId, setResolvingId] = useState<string>();

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    setQuery,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAgentPermissionPageQuery(
    {},
    {
      initialPageSize: 10,
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({
      task_id: taskID?.trim() || undefined,
      statuses: statuses.length > 0 ? statuses : undefined,
    });
  }, [taskID, statuses, setQuery]);

  const handleApprove = async (id: string) => {
    setResolvingId(id);
    try {
      await approveAgentPermissionApi(id);
      getGlobalMessage()?.success("Permission approved");
      refetch();
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
      refetch();
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
    <Card
      size="small"
      title="Agent Permission List"
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
        <Input
          allowClear
          placeholder="Filter by task id"
          style={{ width: 260 }}
          value={taskID}
          onChange={(e) => setTaskID(e.target.value)}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Filter by status"
          style={{ minWidth: 260 }}
          options={STATUS_OPTIONS}
          value={statuses}
          onChange={(value: string[]) => setStatuses(value)}
        />
      </Flex>

      <Table<AgentPermissionItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1600 }}
        locale={{ emptyText: error ? "Failed to load agent permissions" : "No agent permissions" }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200, 500, 1000],
          onChange: (nextPage, nextPageSize) => {
            if (nextPageSize !== pageSize) {
              setPageSize(nextPageSize);
            }
            setPage(nextPage);
          },
          showTotal: (value) => `Total ${value} items`,
        }}
      />
    </Card>
  );
};

export default AgentPermissionPage;

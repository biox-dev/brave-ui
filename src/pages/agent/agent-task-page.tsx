import { useEffect, useState } from "react";
import { Button, Card, Flex, Popconfirm, Select, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAgentTaskPageQuery } from "@/hooks/usePaginationV2";
import {
  AgentTaskStatus,
  cancelAgentTaskApi,
  type AgentTaskItem,
} from "@/api/agent";
import { invoke } from "@/core/ui-system/invokeV2";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

const ACTIVE_STATUSES = new Set<string>([
  AgentTaskStatus.Created,
  AgentTaskStatus.Running,
  AgentTaskStatus.WaitingPermission,
]);

const STATUS_OPTIONS = [
  { label: "Created", value: AgentTaskStatus.Created },
  { label: "Running", value: AgentTaskStatus.Running },
  { label: "Waiting Permission", value: AgentTaskStatus.WaitingPermission },
  { label: "Completed", value: AgentTaskStatus.Completed },
  { label: "Failed", value: AgentTaskStatus.Failed },
  { label: "Canceled", value: AgentTaskStatus.Canceled },
];

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

interface ActionHandlers {
  onViewEvents: (id: string) => void;
  onViewPermissions: (id: string) => void;
  onCancel: (id: string) => void;
  cancelingId?: string;
}

const createColumns = ({
  onViewEvents,
  onViewPermissions,
  onCancel,
  cancelingId,
}: ActionHandlers): ColumnsType<AgentTaskItem> => [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 220,
    ellipsis: true,
  },
  {
    title: "Provider",
    dataIndex: "provider",
    key: "provider",
    width: 130,
    render: (value: string) => value || "-",
  },
  {
    title: "Model",
    dataIndex: "model",
    key: "model",
    width: 130,
    render: (value: string) => value || "-",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 150,
    render: (value: string) => value || "-",
  },
  {
    title: "Working Dir",
    dataIndex: "working_dir",
    key: "working_dir",
    width: 200,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Error",
    dataIndex: "error",
    key: "error",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Started At",
    dataIndex: "started_at",
    key: "started_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Finished At",
    dataIndex: "finished_at",
    key: "finished_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Actions",
    key: "actions",
    width: 240,
    fixed: "right",
    render: (_: unknown, record) => {
      const cancelable = ACTIVE_STATUSES.has(record.status);
      return (
        <Space size="small">
          <Button size="small" onClick={() => onViewEvents(record.id)}>
            Events
          </Button>
          <Button size="small" onClick={() => onViewPermissions(record.id)}>
            Permissions
          </Button>
          <Popconfirm
            title="Cancel this task?"
            disabled={!cancelable}
            onConfirm={() => onCancel(record.id)}
          >
            <Button
              danger
              size="small"
              disabled={!cancelable}
              loading={cancelingId === record.id}
            >
              Cancel
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  },
];

const AgentTaskPage = () => {
  const [statuses, setStatuses] = useState<string[]>([]);
  const [cancelingId, setCancelingId] = useState<string>();

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
  } = useAgentTaskPageQuery(
    {},
    {
      initialPageSize: 10,
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({ statuses: statuses.length > 0 ? statuses : undefined });
  }, [statuses, setQuery]);

  const handleCreateTask = async () => {
    try {
      await invoke.createAgentTaskModal.openAsync(undefined, {
        title: "Create Agent Task",
        width: 560,
        footer: null,
      });
      await refetch();
    } catch (error) {
      // User canceled the create-task modal.
    }
  };

  const handleViewEvents = async (taskId: string) => {
    await invoke.taskEventsModal.openAsync(
      { taskId },
      {
        title: `Task Events - ${taskId.slice(0, 8)}...`,
        width: 900,
        footer: null,
      }
    );
  };

  const handleViewPermissions = async (taskId: string) => {
    await invoke.taskPermissionsModal.openAsync(
      { taskId },
      {
        title: `Pending Permissions - ${taskId.slice(0, 8)}...`,
        width: 900,
        footer: null,
      }
    );
  };

  const handleCancel = async (taskId: string) => {
    setCancelingId(taskId);
    try {
      await cancelAgentTaskApi(taskId);
      getGlobalMessage()?.success("Task canceled");
      refetch();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setCancelingId(undefined);
    }
  };

  const columns = createColumns({
    onViewEvents: handleViewEvents,
    onViewPermissions: handleViewPermissions,
    onCancel: handleCancel,
    cancelingId,
  });

  return (
    <Card
      size="small"
      title="Agent Task List"
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
            Create Task
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
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

      <Table<AgentTaskItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1600 }}
        locale={{ emptyText: error ? "Failed to load agent tasks" : "No agent tasks" }}
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

export default AgentTaskPage;

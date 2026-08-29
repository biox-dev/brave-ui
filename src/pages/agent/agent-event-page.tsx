import { useEffect, useState } from "react";
import { Button, Card, Flex, Input, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { useAgentEventPageQuery } from "@/hooks/usePaginationV2";
import type { AgentEventItem } from "@/api/agent";

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
    title: "Sequence",
    dataIndex: "sequence",
    key: "sequence",
    width: 100,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
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

const AgentEventPage = () => {
  const [taskID, setTaskID] = useState<string>();

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
  } = useAgentEventPageQuery(
    {},
    {
      initialPageSize: 10,
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({ task_id: taskID?.trim() || undefined });
  }, [taskID, setQuery]);

  return (
    <Card
      size="small"
      title="Agent Event List"
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
      </Flex>

      <Table<AgentEventItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1400 }}
        locale={{ emptyText: error ? "Failed to load agent events" : "No agent events" }}
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

export default AgentEventPage;

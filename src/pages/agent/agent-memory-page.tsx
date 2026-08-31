import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAgentMemoryPageQuery } from "@/hooks/usePaginationV2";
import {
  AgentMemoryKind,
  deleteAgentMemoryApi,
  retrieveAgentMemoryApi,
  type AgentMemoryItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";

const { Text } = Typography;

const KIND_OPTIONS = [
  { label: "Fact", value: AgentMemoryKind.Fact },
  { label: "Summary", value: AgentMemoryKind.Summary },
  { label: "Note", value: AgentMemoryKind.Note },
  { label: "Event", value: AgentMemoryKind.Event },
];

const KIND_COLORS: Record<string, string> = {
  [AgentMemoryKind.Fact]: "green",
  [AgentMemoryKind.Summary]: "blue",
  [AgentMemoryKind.Note]: "gold",
  [AgentMemoryKind.Event]: "purple",
};

const formatTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

interface ActionHandlers {
  onEdit: (record: AgentMemoryItem) => void;
  onDelete: (id: string) => void;
  deletingId?: string;
}

const createColumns = ({ onEdit, onDelete, deletingId }: ActionHandlers): ColumnsType<AgentMemoryItem> => [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 220,
    ellipsis: true,
  },
  {
    title: "Kind",
    dataIndex: "kind",
    key: "kind",
    width: 110,
    render: (value: string) => <Tag color={KIND_COLORS[value] ?? "default"}>{value || "-"}</Tag>,
  },
  {
    title: "Content",
    dataIndex: "content",
    key: "content",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Importance",
    dataIndex: "importance",
    key: "importance",
    width: 110,
    render: (value?: number) => value ?? 0,
  },
  {
    title: "Session ID",
    dataIndex: "session_id",
    key: "session_id",
    width: 200,
    ellipsis: true,
    render: (value?: string) => value || "-",
  },
  {
    title: "Updated At",
    dataIndex: "updated_at",
    key: "updated_at",
    width: 180,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Actions",
    key: "actions",
    width: 160,
    fixed: "right",
    render: (_: unknown, record) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
          Edit
        </Button>
        <Popconfirm title="Delete this memory?" onConfirm={() => onDelete(record.id)}>
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          >
            Delete
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];

const AgentMemoryPage = () => {
  const [kinds, setKinds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string>();

  // 关键词检索（非空时用 retrieve 结果覆盖表格数据源）。
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [retrieved, setRetrieved] = useState<AgentMemoryItem[]>([]);

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
  } = useAgentMemoryPageQuery(
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
      kinds: kinds.length > 0 ? kinds : undefined,
    });
  }, [kinds, setQuery]);

  const handleCreate = async () => {
    try {
      await invoke.agentMemoryEditModal.openAsync(
        { memory: null },
        {
          title: "New Memory",
          width: 560,
          footer: null,
        }
      );
      await refetch();
    } catch {
      // User canceled the create / edit modal.
    }
  };

  const handleEdit = async (record: AgentMemoryItem) => {
    try {
      await invoke.agentMemoryEditModal.openAsync(
        { memory: record },
        {
          title: "Edit Memory",
          width: 560,
          footer: null,
        }
      );
      await refetch();
    } catch {
      // User canceled the create / edit modal.
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAgentMemoryApi(id);
      getGlobalMessage()?.success("Memory deleted");
      refetch();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setDeletingId(undefined);
    }
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) {
      setRetrieved([]);
      return;
    }
    setSearching(true);
    try {
      const res = await retrieveAgentMemoryApi(query, 20);
      setRetrieved(res.data ?? []);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    setRetrieved([]);
  };

  const searchingActive = searchText.trim().length > 0;
  const tableData = searchingActive ? retrieved : data;
  const tableTotal = searchingActive ? retrieved.length : total;

  const columns = createColumns({ onEdit: handleEdit, onDelete: handleDelete, deletingId });

  return (
    <Card
      size="small"
      title="Agent Memory List"
      extra={
        <Space>
          <Text type="secondary">Total: {tableTotal}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            New Memory
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Search memories by keyword"
          style={{ width: 320 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={handleSearch}
          enterButton={<SearchOutlined />}
          loading={searching}
          onClear={clearSearch}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Filter by kind"
          style={{ minWidth: 240 }}
          options={KIND_OPTIONS}
          value={kinds}
          onChange={(value: string[]) => setKinds(value)}
        />
        {searchingActive && (
          <Button onClick={clearSearch}>Clear search</Button>
        )}
      </Flex>

      <Table<AgentMemoryItem>
        rowKey="id"
        columns={columns}
        dataSource={tableData}
        loading={isLoading || isFetching || searching}
        size="small"
        scroll={{ x: 1200 }}
        locale={{ emptyText: error ? "Failed to load agent memories" : "No agent memories" }}
        pagination={
          searchingActive
            ? false
            : {
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
              }
        }
      />
    </Card>
  );
};

export default AgentMemoryPage;

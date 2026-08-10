import { useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { useContainerInstancePageQuery } from "@/hooks/usePaginationV2";
import type { ContainerInstanceItem } from "@/api/container";

const { Text } = Typography;

export interface ContainerInstancePageProps {
  id?: string;
  template_id?: string;
  owner_type?: string;
  owner_id?: string;
  runtime_id?: string;
  name?: string;
  status?: string;
  ip_address?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerInstanceItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePageSize = (value?: number | string) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 10;
};

const formatTime = (value?: string) => (value ? new Date(value).toLocaleString() : "-");

const columns: ColumnsType<ContainerInstanceItem> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 220,
    ellipsis: true,
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    width: 140,
    render: (value: string) => value || "-",
  },
  {
    title: "Monitoring",
    dataIndex: "in_monitoring_registry",
    key: "in_monitoring_registry",
    width: 130,
    render: (value?: boolean) => (value ? "Yes" : "No"),
  },
  {
    title: "RefCount",
    dataIndex: "ref_count",
    key: "ref_count",
    width: 100,
    render: (value?: number) => (Number.isFinite(value) && (value ?? 0) > 0 ? value : "-"),
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => formatTime(value),
  },
  {
    title: "Owner",
    key: "owner",
    width: 220,
    render: (_: unknown, record) => `${record.owner_type || "-"} / ${record.owner_id || "-"}`,
  },
 
  {
    title: "Runtime ID",
    dataIndex: "runtime_id",
    key: "runtime_id",
    width: 220,
    ellipsis: true,
    render: (value: string) => value || "-",
  },  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 220,
    ellipsis: true,
  },{
    title: "Template ID",
    dataIndex: "template_id",
    key: "template_id",
    width: 170,
    render: (value: string) => value || "-",
  },
  {
    title: "IP Address",
    dataIndex: "ip_address",
    key: "ip_address",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Exit Code",
    dataIndex: "exit_code",
    key: "exit_code",
    width: 100,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
  
];

const ContainerInstancePage = ({
  id,
  template_id,
  owner_type,
  owner_id,
  runtime_id,
  name,
  status,
  ip_address,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: ContainerInstancePageProps) => {
  const [selectedId, setSelectedID] = useState<string>();
  const selectable = Boolean(onOk || onCancel);

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
  } = useContainerInstancePageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({
      id: normalizeText(id),
      template_id: normalizeText(template_id),
      owner_type: normalizeText(owner_type),
      owner_id: normalizeText(owner_id),
      runtime_id: normalizeText(runtime_id),
      name: normalizeText(name),
      status: normalizeText(status),
      ip_address: normalizeText(ip_address),
    });
  }, [id, template_id, owner_type, owner_id, runtime_id, name, status, ip_address, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const selectColumns = useMemo<ColumnsType<ContainerInstanceItem>>(() => {
    if (!selectable) {
      return columns;
    }

    return [
      ...columns,
      {
        title: "Action",
        key: "action",
        width: 120,
        fixed: "right",
        render: (_: unknown, record) => (
          <Button
            type={record.id === selectedId ? "primary" : "default"}
            size="small"
            onClick={() => setSelectedID(record.id)}
          >
            {record.id === selectedId ? "Selected" : "Select"}
          </Button>
        ),
      },
    ];
  }, [selectable, selectedId]);

  const handleConfirm = () => {
    if (!selectedItem || !onOk) {
      return;
    }
    onOk(selectedItem);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (close) {
      close();
    }
  };

  return (
    <Card
      size="small"
      title={title || "Container Instance List"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<ContainerInstanceItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1600 }}
        locale={{ emptyText: error ? "Failed to load container instances" : "No container instances" }}
        rowSelection={
          selectable
            ? {
                type: "radio",
                selectedRowKeys: selectedId ? [selectedId] : [],
                onChange: (selectedRowKeys) => {
                  setSelectedID(String(selectedRowKeys[0] || ""));
                },
              }
            : undefined
        }
        onRow={
          selectable
            ? (record) => ({
                onClick: () => setSelectedID(record.id),
              })
            : undefined
        }
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

      {selectable && (
        <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
            Confirm
          </Button>
        </Flex>
      )}
    </Card>
  );
};

export default ContainerInstancePage;

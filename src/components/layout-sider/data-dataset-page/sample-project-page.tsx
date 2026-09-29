import { useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSamplePageQuery } from "@/hooks/usePaginationV2";
import { deleteSampleApi } from "@/api/data";
import type { SampleItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface SampleProjectPageProps {
  sample_name?: string;
  tissue?: string;
  cell_type?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (sample: SampleItem) => void;
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

const columns: ColumnsType<SampleItem> = [
  {
    title: "Sample",
    dataIndex: "sample_name",
    key: "sample_name",
    ellipsis: true,
    render: (value: string, record) => value || `Sample-${record.id}`,
  },
  {
    title: "Tissue",
    dataIndex: "tissue",
    key: "tissue",
    width: 120,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Cell Type",
    dataIndex: "cell_type",
    key: "cell_type",
    width: 130,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Collection Time",
    dataIndex: "collection_time",
    key: "collection_time",
    width: 200,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

/**
 * Sample list page. When opened through `invoke.sampleProjectPage` (i.e. `onOk`
 * is injected) it also acts as a single-select picker.
 */
const SampleProjectPage = ({
  sample_name,
  tissue,
  cell_type,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: SampleProjectPageProps) => {
  const [selectedId, setSelectedID] = useState<string>();

  const selectable = Boolean(onOk || onCancel);

  const message = useGlobalMessage();

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
  } = useSamplePageQuery(
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
      sample_name: normalizeText(sample_name),
      tissue: normalizeText(tissue),
      cell_type: normalizeText(cell_type),
    });
  }, [sample_name, tissue, cell_type, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleCreate = async () => {
    try {
      await invoke.editSamplePage.openDrawerAsync({}, { width: 560, title: "New Sample" });
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: SampleItem) => {
    try {
      await invoke.editSamplePage.openDrawerAsync(
        { sample: record },
        { width: 560, title: `Edit Sample: ${record.sample_name || record.id}` }
      );
      refetch();
    } catch {
      // user cancelled
    }
  };

  // Deleting a sample cascades to the assays/files it owns.
  const handleDelete = async (record: SampleItem) => {
    try {
      await deleteSampleApi({ id: record.id });
      message.success("Sample deleted successfully");
      if (selectedId === record.id) {
        setSelectedID(undefined);
      }
      refetch();
    } catch {
      message.error("Failed to delete sample");
    }
  };

  const actionsColumn: ColumnsType<SampleItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 120,
    align: "right",
    fixed: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        </Tooltip>
        <Popconfirm
          title="Delete this sample?"
          description="Its assays and files are deleted too."
          onConfirm={() => handleDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const selectColumn: ColumnsType<SampleItem>[number] = {
    title: "Action",
    key: "action",
    width: 110,
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
  };

  const tableColumns: ColumnsType<SampleItem> = selectable
    ? [...columns, actionsColumn, selectColumn]
    : [...columns, actionsColumn];

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
    close?.();
  };

  return (
    <Card
      size="small"
      title={title || "Samples"}
      extra={
        <Space>
          
          <Text type="secondary">Total: {total}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            New
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
     
      <Table<SampleItem>
        rowKey="id"
        columns={tableColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: error ? "Failed to load samples" : "No samples" }}
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

export default SampleProjectPage;

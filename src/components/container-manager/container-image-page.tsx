import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Popconfirm, Space, Table, Typography, App } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useContainerImagePageQuery } from "@/hooks/usePaginationV2";
import type { ContainerImageItem } from "@/api/container";
import { deleteContainerImageApi } from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
    if (msg) {
      return msg;
    }
  }
  return fallback;
};

const { Text } = Typography;

export interface ContainerImagePageProps {
  id?: string;
  name?: string;
  tag?: string;
  registry?: string;
  namespace?: string;
  full_name?: string;
  digest?: string;
  description?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerImageItem) => void;
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

const columns: ColumnsType<ContainerImageItem> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 220,
    ellipsis: true,
  },
  {
    title: "Tag",
    dataIndex: "tag",
    key: "tag",
    width: 120,
    render: (value: string) => value || "-",
  },
  {
    title: "Registry",
    dataIndex: "registry",
    key: "registry",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Namespace",
    dataIndex: "namespace",
    key: "namespace",
    width: 150,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Full Name",
    dataIndex: "full_name",
    key: "full_name",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

const ContainerImagePage = ({
  id,
  name,
  tag,
  registry,
  namespace,
  full_name,
  digest,
  description,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: ContainerImagePageProps) => {
  const [selectedId, setSelectedID] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const selectable = Boolean(onOk || onCancel);
  const messageApi =  useGlobalMessage();

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
  } = useContainerImagePageQuery(
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
      name: normalizeText(name),
      tag: normalizeText(tag),
      registry: normalizeText(registry),
      namespace: normalizeText(namespace),
      full_name: normalizeText(full_name),
      digest: normalizeText(digest),
      description: normalizeText(description),
    });
  }, [id, name, tag, registry, namespace, full_name, digest, description, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleCreate = useCallback(async () => {
    try {
      await invoke.containerImageForm.openAsync(
        {},
        { title: "Create Container Image", width: 600, footer: false }
      );
      refetch();
    } catch {
      // User cancelled
    }
  }, [refetch]);

  const handleEdit = useCallback(async (record: ContainerImageItem) => {
    try {
      await invoke.containerImageForm.openAsync(
        { item: record },
        { title: "Edit Container Image", width: 600, footer: false }
      );
      refetch();
    } catch {
      // User cancelled
    }
  }, [refetch]);

  const handleDelete = useCallback(async (record: ContainerImageItem) => {
    setDeletingId(record.id);
    try {
      await deleteContainerImageApi({ id: record.id });
      messageApi.success("Container image deleted successfully");
      refetch();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to delete container image"));
    } finally {
      setDeletingId(undefined);
    }
  }, [messageApi, refetch]);

  const selectColumns = useMemo<ColumnsType<ContainerImageItem>>(() => {
    if (selectable) {
      return [
        ...columns,
        {
          title: "Action",
          key: "action",
          width: 120,
          fixed: "right" as const,
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
    }

    // Standalone mode: show Edit + Delete actions
    return [
      ...columns,
      {
        title: "Actions",
        key: "actions",
        width: 160,
        fixed: "right" as const,
        render: (_: unknown, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              onClick={() => handleEdit(record)}
            >
              Edit
            </Button>
            <Popconfirm
              title="Delete this image?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record)}
              okButtonProps={{ loading: deletingId === record.id }}
            >
              <Button type="link" size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];
  }, [selectable, selectedId, deletingId]);

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
      title={title || "Container Image List"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          {!selectable && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Create
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<ContainerImageItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1250 }}
        locale={{ emptyText: error ? "Failed to load container images" : "No container images" }}
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

export default ContainerImagePage;

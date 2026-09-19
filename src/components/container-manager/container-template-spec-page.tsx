import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Popconfirm, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useContainerTemplateSpecPageQuery } from "@/hooks/usePaginationV2";
import { deleteContainerTemplateSpecApi, type ContainerTemplateSpecItem } from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";

const { Text } = Typography;

export interface ContainerTemplateSpecPageProps {
  id?: string;
  name?: string;
  description?: string;
  app_type?: string;
  command?: string;
  work_dir?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerTemplateSpecItem) => void;
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

const createColumns = (locale: string): ColumnsType<ContainerTemplateSpecItem> => [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 220,
    ellipsis: true,
  },
  {
    title: "App Type",
    dataIndex: "app_type",
    key: "app_type",
    width: 120,
    render: (value: string) => value || "-",
  },
  {
    title: "Command",
    dataIndex: "command",
    key: "command",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "CPU",
    dataIndex: "cpu",
    key: "cpu",
    width: 90,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
  {
    title: "Memory",
    dataIndex: "memory",
    key: "memory",
    width: 120,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
  {
    title: "Port",
    dataIndex: "port",
    key: "port",
    width: 90,
    render: (value: number) => (Number.isFinite(value) ? value : "-"),
  },
  {
    title: "Work Dir",
    dataIndex: "work_dir",
    key: "work_dir",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Change UID",
    dataIndex: "change_uid",
    key: "change_uid",
    width: 110,
    render: (value?: boolean) => (value ? "Yes" : "No"),
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? formatRelativeTime(value, locale) : "-"),
  },
];

/**
 * ContainerTemplateSpec（共享运行配置）增删改查页面。
 * 一个 Spec 可被多个 Definition（配置 × 镜像绑定行）复用，见 container-template-page。
 */
const ContainerTemplateSpecPage = ({
  id,
  name,
  description,
  app_type,
  command,
  work_dir,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: ContainerTemplateSpecPageProps) => {
  const [selectedId, setSelectedID] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [messageApi, contextHolder] = message.useMessage();
  const { locale } = useI18n();
  const selectable = Boolean(onOk || onCancel);

  const columns = useMemo<ColumnsType<ContainerTemplateSpecItem>>(() => createColumns(locale), [locale]);

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
  } = useContainerTemplateSpecPageQuery(
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
      description: normalizeText(description),
      app_type: normalizeText(app_type),
      command: normalizeText(command),
      work_dir: normalizeText(work_dir),
    });
  }, [id, name, description, app_type, command, work_dir, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleCreate = useCallback(async () => {
    try {
      await invoke.containerTemplateSpecForm.openAsync(
        {},
        { title: "Create Container Template Spec", width: 640, footer: false }
      );
      refetch();
    } catch {
      // User cancelled
    }
  }, [refetch]);

  const handleEdit = useCallback(async (record: ContainerTemplateSpecItem) => {
    try {
      await invoke.containerTemplateSpecForm.openAsync(
        { item: record },
        { title: "Edit Container Template Spec", width: 640, footer: false }
      );
      refetch();
    } catch {
      // User cancelled
    }
  }, [refetch]);

  // 绑定镜像：用模板表单在该 Spec 下新增一条 Definition（spec_id 已锁定）。
  const handleBindImage = useCallback(async (record: ContainerTemplateSpecItem) => {
    try {
      await invoke.containerTemplateForm.openAsync(
        { initialSpecId: record.id, initialSpecName: record.name },
        { title: `Bind Image: ${record.name}`, width: 640, footer: false }
      );
      refetch();
    } catch {
      // User cancelled
    }
  }, [refetch]);

  const handleDelete = useCallback(async (record: ContainerTemplateSpecItem) => {
    setDeletingId(record.id);
    try {
      await deleteContainerTemplateSpecApi({ id: record.id });
      messageApi.success("Container template spec deleted successfully");
      refetch();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to delete container template spec"));
    } finally {
      setDeletingId(undefined);
    }
  }, [messageApi, refetch]);

  const selectColumns = useMemo<ColumnsType<ContainerTemplateSpecItem>>(() => {
    const crudColumns: ColumnsType<ContainerTemplateSpecItem> = [
      {
        title: "Actions",
        key: "crud_actions",
        width: 240,
        fixed: "right" as const,
        render: (_: unknown, record) => (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleEdit(record)}>
              Edit
            </Button>
            <Button type="link" size="small" onClick={() => handleBindImage(record)}>
              Bind Image
            </Button>
            <Popconfirm
              title="Delete this spec?"
              description="Specs still referenced by a binding row cannot be deleted."
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

    if (!selectable) {
      return [...columns, ...crudColumns];
    }

    return [
      ...columns,
      ...crudColumns,
      {
        title: "Select",
        key: "select_action",
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
  }, [selectable, selectedId, deletingId, columns, handleEdit, handleBindImage, handleDelete]);

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
      title={title || "Container Template Spec List"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      {contextHolder}
      <Table<ContainerTemplateSpecItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1700 }}
        locale={{ emptyText: error ? "Failed to load container template specs" : "No container template specs" }}
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

export default ContainerTemplateSpecPage;

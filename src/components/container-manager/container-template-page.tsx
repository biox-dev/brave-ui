import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Popconfirm, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ImportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useContainerTemplatePageQuery } from "@/hooks/usePaginationV2";
import {
  deleteContainerTemplateApi,
  exportContainerTemplateApi,
  setDefaultContainerTemplateApi,
  type ContainerTemplateItem,
} from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";

const { Text } = Typography;

export interface ContainerTemplatePageProps {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  image_id?: string;
  spec_id?: string;
  command?: string;
  work_dir?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerTemplateItem) => void;
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

const createColumns = (locale: string): ColumnsType<ContainerTemplateItem> => [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 220,
    ellipsis: true,
    render: (value: string, record) =>
      record.is_default ? (
        <Space size={4}>
          <Tag color="gold">Default</Tag>
          <span>{value || "-"}</span>
        </Space>
      ) : (
        value || "-"
      ),
  },
  {
    title: "Spec ID",
    dataIndex: "spec_id",
    key: "spec_id",
    width: 170,
    render: (value: string) => value || "-",
  },
  {
    title: "App Type",
    dataIndex: "app_type",
    key: "app_type",
    width: 120,
    render: (value: string) => value || "-",
  },
  {
    title: "Image",
    key: "image",
    width: 220,
    ellipsis: true,
    render: (_: unknown, record) => record.image?.full_name || record.image_id || "-",
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
    title: "Work Dir",
    dataIndex: "work_dir",
    key: "work_dir",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? formatRelativeTime(value, locale) : "-"),
  },
];

const ContainerTemplatePage = ({
  id,
  name,
  description,
  type,
  image_id,
  spec_id,
  command,
  work_dir,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: ContainerTemplatePageProps) => {
  const [selectedId, setSelectedID] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [settingDefaultId, setSettingDefaultId] = useState<string>();
  const [messageApi, contextHolder] = message.useMessage();
  const { locale } = useI18n();
  const selectable = Boolean(onOk || onCancel);

  const columns = useMemo<ColumnsType<ContainerTemplateItem>>(
    () => createColumns(locale),
    [locale]
  );

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
  } = useContainerTemplatePageQuery(
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
      type: normalizeText(type),
      image_id: normalizeText(image_id),
      spec_id: normalizeText(spec_id),
      command: normalizeText(command),
      work_dir: normalizeText(work_dir),
    });
  }, [id, name, description, type, image_id, spec_id, command, work_dir, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  // 当前页是否已有默认模板：分页接口已返回 is_default，可直接判断，无需单独请求。
  const hasDefaultInPage = useMemo(() => data.some((item) => item.is_default), [data]);

  // 设为默认：后端会互斥地清空其它模板的默认标记，因此成功后重新拉取当前页即可。
  const handleSetDefault = useCallback(
    async (record: ContainerTemplateItem, checked: boolean) => {
      if (!checked) {
        messageApi.warning("At least one template must stay as default. Set another template as default instead.");
        return;
      }
      setSettingDefaultId(record.id);
      try {
        await setDefaultContainerTemplateApi({ id: record.id });
        messageApi.success(`"${record.name}" is now the default container template`);
        refetch();
      } catch (error) {
        messageApi.error(getErrorMessage(error, "Failed to set default container template"));
      } finally {
        setSettingDefaultId(undefined);
      }
    },
    [messageApi, refetch]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleCreate = useCallback(async () => {
    try {
      await invoke.containerTemplateForm.openAsync(
        {},
        { title: "Create Container Template", width: 600, footer: false }
      );
      handleRefresh();
    } catch {
      // User cancelled
    }
  }, [handleRefresh]);

  const handleEdit = useCallback(async (record: ContainerTemplateItem) => {
    try {
      await invoke.containerTemplateForm.openAsync(
        { item: record },
        { title: "Edit Container Template", width: 600, footer: false }
      );
      handleRefresh();
    } catch {
      // User cancelled
    }
  }, [handleRefresh]);

  const handleDelete = useCallback(async (record: ContainerTemplateItem) => {
    setDeletingId(record.id);
    try {
      await deleteContainerTemplateApi({ id: record.id });
      messageApi.success("Container template deleted successfully");
      handleRefresh();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to delete container template"));
    } finally {
      setDeletingId(undefined);
    }
  }, [messageApi, handleRefresh]);

  const handleExport = useCallback(async (record: ContainerTemplateItem) => {
    try {
      const resp = await exportContainerTemplateApi({ id: record.id });
      const json = JSON.stringify(resp.data, null, 2);
      invoke.containerTemplateExportDialog.open(
        { json, name: record.name },
        { title: `Export: ${record.name}`, width: 720, footer: false }
      );
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to export container template"));
    }
  }, [messageApi]);

  const handleImport = useCallback(async () => {
    try {
      await invoke.containerTemplateImportDialog.openAsync(
        {},
        { title: "Import Container Template", width: 600, footer: false }
      );
      handleRefresh();
    } catch {
      // User cancelled
    }
  }, [handleRefresh]);

  const selectColumns = useMemo<ColumnsType<ContainerTemplateItem>>(() => {
    const crudColumns: ColumnsType<ContainerTemplateItem> = [
      {
        title: "Default",
        key: "default_action",
        width: 110,
        fixed: "right" as const,
        render: (_: unknown, record) => (
          <Switch
            size="small"
            checked={Boolean(record.is_default)}
            loading={settingDefaultId === record.id}
            disabled={Boolean(record.is_default)}
            onChange={(checked) => handleSetDefault(record, checked)}
          />
        ),
      },
      {
        title: "Actions",
        key: "crud_actions",
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
            <Button
              type="link"
              size="small"
              onClick={() => handleExport(record)}
            >
              Export
            </Button>
            <Popconfirm
              title="Delete this template?"
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
  }, [selectable, selectedId, deletingId, columns, handleEdit, handleExport, handleDelete, handleSetDefault, settingDefaultId]);

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
      title={title || "Container Template List"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          {/* {!selectable && (
            <>
             
            </>
          )} */}
           <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Create
              </Button>
              <Button icon={<ImportOutlined />} onClick={handleImport}>
                Import
              </Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      {contextHolder}
      {!hasDefaultInPage && total > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="No default container template configured"
          description="Turn on the Default switch for one template below. Scripts created by the agent without an explicit container template will use it."
        />
      )}
      <Table<ContainerTemplateItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1500 }}
        locale={{ emptyText: error ? "Failed to load container templates" : "No container templates" }}
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

export default ContainerTemplatePage;

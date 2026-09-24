import { useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSubjectPageQuery } from "@/hooks/usePaginationV2";
import { deleteSubjectApi } from "@/api/data";
import type { SubjectItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface SubjectProjectPageProps {
  subject_key?: string;
  subject_name?: string;
  species?: string;
  strain?: string;
  sex?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (subject: SubjectItem) => void;
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

const columns: ColumnsType<SubjectItem> = [
  {
    title: "Subject Key",
    dataIndex: "subject_key",
    key: "subject_key",
    width: 180,
    ellipsis: true,
    render: (value: string, record) => value || `Subject-${record.id}`,
  },
  {
    title: "Subject Name",
    dataIndex: "subject_name",
    key: "subject_name",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Species",
    dataIndex: "species",
    key: "species",
    width: 160,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Strain",
    dataIndex: "strain",
    key: "strain",
    width: 140,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Sex",
    dataIndex: "sex",
    key: "sex",
    width: 100,
    render: (value: string) => value || "-",
  },
  {
    title: "Age",
    dataIndex: "age",
    key: "age",
    width: 110,
    render: (value: string) => value || "-",
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 200,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

/**
 * Subject list page. When opened through `invoke.subjectProjectPage` (i.e.
 * `onOk` is injected) it also acts as a single-select picker.
 */
const SubjectProjectPage = ({
  subject_key,
  subject_name,
  species,
  strain,
  sex,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: SubjectProjectPageProps) => {
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
  } = useSubjectPageQuery(
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
      subject_key: normalizeText(subject_key),
      subject_name: normalizeText(subject_name),
      species: normalizeText(species),
      strain: normalizeText(strain),
      sex: normalizeText(sex),
    });
  }, [subject_key, subject_name, species, strain, sex, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleCreate = async () => {
    try {
      await invoke.editSubjectPage.openDrawerAsync({}, { width: 480, title: "New Subject" });
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: SubjectItem) => {
    try {
      await invoke.editSubjectPage.openDrawerAsync(
        { subject: record },
        { width: 480, title: `Edit Subject: ${record.subject_key || record.subject_name || record.id}` }
      );
      refetch();
    } catch {
      // user cancelled
    }
  };

  // The backend refuses (409) while the subject still owns samples.
  const handleDelete = async (record: SubjectItem) => {
    try {
      await deleteSubjectApi({ id: record.id });
      message.success("Subject deleted successfully");
      if (selectedId === record.id) {
        setSelectedID(undefined);
      }
      refetch();
    } catch {
      message.error("Failed to delete subject");
    }
  };

  const actionsColumn: ColumnsType<SubjectItem>[number] = {
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
          title="Delete this subject?"
          description="Subjects that still own samples cannot be deleted."
          onConfirm={() => handleDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const selectColumn: ColumnsType<SubjectItem>[number] = {
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

  const tableColumns: ColumnsType<SubjectItem> = selectable
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
      title={title || "Subjects"}
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
      <Table<SubjectItem>
        rowKey="id"
        columns={tableColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: error ? "Failed to load subjects" : "No subjects" }}
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

export default SubjectProjectPage;

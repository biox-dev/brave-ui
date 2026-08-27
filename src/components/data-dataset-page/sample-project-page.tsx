import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { useSampleProjectPageQuery } from "@/hooks/usePaginationV2";
import type { SampleItem } from "@/api/data";

const { Text } = Typography;

export interface SampleProjectPageProps {
  project_id?: string;
  sample_id?: string;
  sample_name?: string;
  subject_id?: string;
  group_name?: string;
  phenotype?: string;
  metadata?: string;
  description?: string;
  dataset_id?: string;
  dataset_name?: string;
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
    title: "Sample Name",
    dataIndex: "sample_name",
    key: "sample_name",
    ellipsis: true,
  },
  {
    title: "Sample ID",
    dataIndex: "sample_id",
    key: "sample_id",
    width: 180,
    render: (value: string) => value || "-",
  },
  {
    title: "Dataset",
    dataIndex: "dataset_name",
    key: "dataset_name",
    width: 180,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Subject",
    dataIndex: "subject_id",
    key: "subject_id",
    width: 140,
    render: (value: string) => value || "-",
  },
  {
    title: "Group",
    dataIndex: "group_name",
    key: "group_name",
    width: 140,
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

const SampleProjectPage = ({
  project_id,
  sample_id,
  sample_name,
  subject_id,
  group_name,
  phenotype,
  metadata,
  description,
  dataset_id,
  dataset_name,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: SampleProjectPageProps) => {
  // const { project, projectObj } = useSelector((state: any) => state.user);
  const [selectedId, setSelectedID] = useState<string>();

  const selectable = Boolean(onOk || onCancel);

  // const resolvedProjectId = useMemo(
  //   () => normalizeText(project_id) || normalizeText(project) || normalizeText(projectObj?.project_id) || "",
  //   [project_id, project, projectObj?.project_id]
  // );

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
  } = useSampleProjectPageQuery(
    {
      // project_id: resolvedProjectId,
    },
    {
      // enabled: Boolean(resolvedProjectId),
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({
      // project_id: resolvedProjectId,
      sample_id: normalizeText(sample_id),
      sample_name: normalizeText(sample_name),
      subject_id: normalizeText(subject_id),
      group_name: normalizeText(group_name),
      phenotype: normalizeText(phenotype),
      metadata: normalizeText(metadata),
      description: normalizeText(description),
      dataset_id: normalizeText(dataset_id),
      dataset_name: normalizeText(dataset_name),
    });
  }, [ sample_id, sample_name, subject_id, group_name, phenotype, metadata, description, dataset_id, dataset_name, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const selectColumns = useMemo<ColumnsType<SampleItem>>(() => {
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

  // if (!resolvedProjectId) {
  //   return <Alert type="warning" showIcon message="Project ID is required" description="No project_id found in props or store." />;
  // }

  return (
    <Card
      size="small"
      title={title || "Sample List By Project"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<SampleItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1200 }}
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

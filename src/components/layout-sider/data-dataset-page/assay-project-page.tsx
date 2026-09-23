import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Pagination, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ExperimentOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAssayProjectPageQuery } from "@/hooks/usePaginationV2";
import type { AssayItem } from "@/api/data";
import { useSelector } from "react-redux";

export interface AssayProjectPageProps {
  project_id?: string;
  id?: string;
  sample_id?: string;
  assay_type?: string;
  platform?: string;
  library_id?: string;
  metadata?: string;
  dataset_id?: string;
  dataset_name?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (assay: AssayItem) => void;
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

// Assay 没有独立 name 列，展示名按 library_id → assay_type → 主键推导（与后端 assayDisplayName 一致）。
const assayLabel = (record: AssayItem) =>
  record.library_id || record.assay_type || record.id;

const listColumns: ColumnsType<AssayItem> = [
  {
    title: "Assay",
    dataIndex: "library_id",
    key: "library_id",
    render: (_value: string, record) => (
      <div className="project-report-item">
        <ExperimentOutlined className="project-report-item-icon" />
        <div className="project-report-item-text">
          <span className="project-report-item-title">{assayLabel(record)}</span>
          {[record.assay_type, record.dataset_name].filter(Boolean).length > 0 && (
            <span className="project-report-item-meta">
              {[record.assay_type, record.dataset_name].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    title: "Platform",
    dataIndex: "platform",
    key: "platform",
    width: 110,
    render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : "-"),
  },
];

const detailColumns: ColumnsType<AssayItem> = [
  {
    title: "Assay",
    dataIndex: "library_id",
    key: "library_id",
    ellipsis: true,
    render: (_value: string, record) => assayLabel(record),
  },
  {
    title: "Assay Type",
    dataIndex: "assay_type",
    key: "assay_type",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Platform",
    dataIndex: "platform",
    key: "platform",
    width: 160,
    render: (value: string) => value || "-",
  },
  {
    title: "Sample ID",
    dataIndex: "sample_id",
    key: "sample_id",
    width: 160,
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
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

const AssayProjectPage = ({
  id,
  sample_id,
  assay_type,
  platform,
  library_id,
  metadata,
  dataset_id,
  dataset_name,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: AssayProjectPageProps) => {
  const [selectedId, setSelectedID] = useState<string>();

  const selectable = Boolean(onOk || onCancel);
  const { projectId } = useSelector((state: any) => state.user);

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
  } = useAssayProjectPageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
      scopeKey: projectId,
    }
  );

  useEffect(() => {
    setQuery({
      id: normalizeText(id),
      sample_id: normalizeText(sample_id),
      assay_type: normalizeText(assay_type),
      platform: normalizeText(platform),
      library_id: normalizeText(library_id),
      metadata: normalizeText(metadata),
      dataset_id: normalizeText(dataset_id),
      dataset_name: normalizeText(dataset_name),
    });
  }, [id, sample_id, assay_type, platform, library_id, metadata, dataset_id, dataset_name, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const columns: ColumnsType<AssayItem> = selectable
    ? [
        ...detailColumns,
        {
          title: "Action",
          key: "action",
          width: 96,
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
      ]
    : listColumns;

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
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Assays"}</span>
        <div className="project-report-panel-actions">
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "Failed to load assays" : "No assays"}
          />
        ) : (
          <Table<AssayItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={selectable}
            scroll={selectable ? { x: 1200 } : undefined}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
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
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showTotal={(t) => `${t} assays`}
            onChange={(nextPage, nextSize) => {
              if (nextSize !== pageSize) {
                setPageSize(nextSize);
              } else {
                setPage(nextPage);
              }
            }}
          />
          {selectable && (
            <Flex gap="small">
              <Button size="small" onClick={handleCancel}>Cancel</Button>
              <Button size="small" type="primary" disabled={!selectedItem} onClick={handleConfirm}>
                Confirm
              </Button>
            </Flex>
          )}
        </Flex>
      </div>
    </div>
  );
};

export default AssayProjectPage;

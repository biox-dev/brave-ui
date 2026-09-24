import { useEffect, useMemo, useState } from "react";
import type { HTMLAttributes } from "react";
import { Button, Descriptions, Empty, Flex, Pagination, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useAssayProjectPageQuery } from "@/hooks/usePaginationV2";
import { deleteAssayApi } from "@/api/data";
import type { AssayItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
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

// Files owned by one assay (go_file.assay_id) are rendered by the dedicated
// drawer view `assayFileListPage`, so the narrow left panel only ever shows
// this compact single-column list.

// The left panel is only ~320px wide, so the list keeps a single text column
// (title + meta lines) and reveals the remaining fields in a hover popover.
const listColumns: ColumnsType<AssayItem> = [
  {
    title: "Assay",
    dataIndex: "library_id",
    key: "library_id",
    ellipsis: { showTitle: false },
    render: (_value: string, record) => {
      const label = assayLabel(record);
      const meta = [record.sample_name || record.sample_id, record.platform, record.assay_type]
        .filter(Boolean)
        .join(" · ");

      return (
        <div className="project-report-item">
          <ExperimentOutlined className="project-report-item-icon" />
          <div className="project-report-item-text">
            <Tooltip placement="topLeft" title={label}>
              <span className="project-report-item-title">{label}</span>
            </Tooltip>
            {meta && (
              <span className="project-report-item-meta" title={meta}>
                {meta}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
];

const AssayDetailCard = ({ item }: { item: AssayItem }) => (
  <div style={{ width: 360 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "id", label: "Assay ID", children: item.id || "-" },
        { key: "library_id", label: "Library ID", children: item.library_id || "-" },
        { key: "assay_type", label: "Assay Type", children: item.assay_type || "-" },
        { key: "platform", label: "Platform", children: item.platform || "-" },
        { key: "sample", label: "Sample", children: item.sample_name || item.sample_id || "-" },
        { key: "subject", label: "Subject", children: item.subject_name || "-" },
        { key: "dataset", label: "Dataset", children: item.dataset_name || "-" },
        {
          key: "created_at",
          label: "Created At",
          children: item.created_at ? new Date(item.created_at).toLocaleString() : "-",
        },
        {
          key: "updated_at",
          label: "Updated At",
          children: item.updated_at ? new Date(item.updated_at).toLocaleString() : "-",
        },
      ]}
    />
  </div>
);

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
    title: "Sample Name",
    dataIndex: "sample_name",
    key: "sample_name",
    width: 160,
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Subject",
    dataIndex: "subject_name",
    key: "subject_name",
    width: 150,
    ellipsis: true,
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

  const message = useGlobalMessage();

  // Assay files live in their own drawer view (`assayFileListPage`) so this
  // page stays a thin list; the row actions only open drawers.
  const handleOpenFiles = (record: AssayItem) => {
    invoke.assayFileListPage.drawer(
      { assay_id: record.id, assay_label: assayLabel(record) },
      { width: 880, title: `Assay Files: ${assayLabel(record)}` }
    );
  };

  const handleAddFile = async (record: AssayItem) => {
    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id: record.id, assay_label: assayLabel(record) },
        { width: 520, title: `Add File: ${assayLabel(record)}` }
      );
    } catch {
      // user cancelled
    }
  };

  // Hovering a row previews the whole record; clicking it opens the owned
  // files drawer instead of expanding an unusable row inside the narrow panel.
  const bodyRow = useMemo(() => {
    type PanelRowProps = HTMLAttributes<HTMLTableRowElement> & { "data-row-key"?: string };

    const Row = (props: PanelRowProps) => {
      const rowKey = props["data-row-key"];
      const record = data.find((item) => String(item.id) === String(rowKey));
      const rowElement = <tr {...props} />;

      if (!record) {
        return rowElement;
      }

      return (
        // The panel sits at the left edge, so the card opens to the right and
        // floats over the main content area instead of off-screen.
        <Popover
          placement="right"
          mouseEnterDelay={0.2}
          mouseLeaveDelay={0.1}
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExperimentOutlined />
              {assayLabel(record)}
            </span>
          }
          content={<AssayDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  // Creating an assay always goes through the dataset-first form: pick a
  // dataset, then select/create the sample (and its subject). Files are added
  // per assay from the row actions ("Add File") or from the expanded panel.
  const handleCreate = async () => {
    try {
      await invoke.editAssayPage.openDrawerAsync({}, { width: 640, title: "New Assay" });
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: AssayItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { assay: record },
        { width: 640, title: `Edit Assay: ${assayLabel(record)}` }
      );
      refetch();
    } catch {
      // user cancelled
    }
  };

  // Deleting an assay also removes the files it owns and its dataset binding.
  const handleDelete = async (record: AssayItem) => {
    try {
      await deleteAssayApi({ id: record.id });
      message.success("Assay deleted successfully");
      if (selectedId === record.id) {
        setSelectedID(undefined);
      }
      refetch();
    } catch {
      message.error("Failed to delete assay");
    }
  };

  const actionsColumn: ColumnsType<AssayItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 130,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Owned Files">
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => handleOpenFiles(record)}
          />
        </Tooltip>
        <Tooltip title="Add File">
          <Button type="text" size="small" icon={<FileAddOutlined />} onClick={() => handleAddFile(record)} />
        </Tooltip>
        <Tooltip title="Edit Assay">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
        </Tooltip>
        <Popconfirm
          title="Delete this assay?"
          description="Its files and dataset binding are deleted too."
          onConfirm={() => handleDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const selectColumn: ColumnsType<AssayItem>[number] = {
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
  };

  const columns: ColumnsType<AssayItem> = selectable
    ? [...detailColumns, { ...actionsColumn, fixed: "right" }, selectColumn]
    : [...listColumns, actionsColumn];

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
          <Tooltip title="New Assay">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreate} />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
          </Tooltip>
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
            scroll={selectable ? { x: 1500 } : undefined}
            components={selectable ? undefined : { body: { row: bodyRow } }}
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
            onRow={(record) => ({
              onClick: () => {
                if (selectable) {
                  setSelectedID(record.id);
                  return;
                }
                handleOpenFiles(record);
              },
            })}
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

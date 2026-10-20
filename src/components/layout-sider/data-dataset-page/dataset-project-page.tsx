import { useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, FolderAddOutlined, ImportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { useDatasetProjectPageQuery } from "@/hooks/usePaginationV2";
import { deleteDatasetApi, ensureDatasetDirApi, importDatasetDirFilesApi, listDatasetFilesApi } from "@/api/data";
import type { DatasetFileItem, DatasetItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface DatasetProjectPageProps {
  project_id?: string;
  dataset_name?: string;
  description?: string;
  metadata?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (dataset: DatasetItem) => void;
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

const columns: ColumnsType<DatasetItem> = [
  {
    title: "Dataset Name",
    dataIndex: "dataset_name",
    key: "dataset_name",
    ellipsis: true,
    render: (value: string, record) => value || `Dataset-${record.id}`,
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    render: (value: string) => value || "-",
  },
  {
    title: "Metadata",
    dataIndex: "metadata",
    key: "metadata",
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

const formatBytes = (size?: number) => {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

// One row per go_file bound to the dataset (go_dataset_file -> go_file).
const datasetFileColumns: ColumnsType<DatasetFileItem> = [
  {
    title: "File Name",
    dataIndex: "file_name",
    key: "file_name",
    ellipsis: true,
    render: (value: string, record) => value || record.file_id || `File-${record.id}`,
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    width: 110,
    render: (value: string) => value || "-",
  },
  {
    title: "Format",
    dataIndex: "format",
    key: "format",
    width: 90,
    render: (value: string) => value || "-",
  },
  {
    title: "Size",
    dataIndex: "size",
    key: "size",
    width: 100,
    render: (value: number) => formatBytes(value),
  },
  {
    title: "Path",
    dataIndex: "path",
    key: "path",
    ellipsis: true,
    render: (value: string) => <Typography.Text ellipsis={{ tooltip: value }}>{value || "-"}</Typography.Text>,
  },
];

// DatasetFilesPanel is rendered inside an expanded dataset row and loads the
// dataset's File rows on demand, so opening one row does not fetch files for
// every dataset in the page.
const DatasetFilesPanel = ({ datasetId }: { datasetId: string }) => {
  const [files, setFiles] = useState<DatasetFileItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listDatasetFilesApi({ dataset_id: datasetId })
      .then((response) => {
        if (!cancelled) {
          setFiles(response.data ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return (
    <Table<DatasetFileItem>
      rowKey="id"
      size="small"
      columns={datasetFileColumns}
      dataSource={files}
      loading={loading}
      pagination={false}
      scroll={{ x: 860 }}
      locale={{ emptyText: "No files bound to this dataset" }}
    />
  );
};

const DatasetProjectPage = ({
  project_id,
  dataset_name,
  description,
  metadata,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: DatasetProjectPageProps) => {
  const message = useGlobalMessage();
  const { projectId } = useSelector((state: any) => state.user);
  const [selectedId, setSelectedID] = useState<string>();
  // Tracks the dataset currently importing its directory so only that row's
  // button shows a spinner.
  const [importingId, setImportingId] = useState<string>();
  // Datasets whose files are currently expanded (click a row to toggle).
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  // Bumped after an import so expanded panels remount and refetch their files.
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);

  const selectable = Boolean(onOk || onCancel);

  // The backend resolves the project from the caller's active project, the
  // value below is only forwarded so the page query keeps its previous shape.
  const resolvedProjectId = useMemo(
    () => normalizeText(project_id) ?? projectId,
    [project_id, projectId]
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
  } = useDatasetProjectPageQuery(
    {
      project_id: resolvedProjectId,
    },
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
      project_id: resolvedProjectId,
      dataset_name: normalizeText(dataset_name),
      description: normalizeText(description),
      metadata: normalizeText(metadata),
    });
  }, [resolvedProjectId, dataset_name, description, metadata, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const toggleExpanded = (datasetId: string) => {
    setExpandedRowKeys((prev) =>
      prev.includes(datasetId) ? prev.filter((id) => id !== datasetId) : [...prev, datasetId]
    );
  };

  // Clicking a dataset row toggles its file list; when the page is used as a
  // picker the same click selects the row instead.
  const handleRowClick = (record: DatasetItem, event: { target: EventTarget | null }) => {
    if (selectable) {
      setSelectedID(record.id);
      return;
    }
    // The expand icon handles its own click, so ignore it here to avoid a
    // double toggle.
    if ((event.target as HTMLElement | null)?.closest?.(".ant-table-row-expand-icon")) {
      return;
    }
    toggleExpanded(record.id);
  };

  const handleCreate = async () => {
    try {
      await invoke.editDatasetPage.openDrawerAsync({}, { width: 480, title: "New Dataset" });
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: DatasetItem) => {
    try {
      await invoke.editDatasetPage.openDrawerAsync(
        { dataset: record },
        { width: 720, title: `Edit Dataset: ${record.dataset_name || record.id}` }
      );
      refetch();
    } catch {
      // user cancelled
    }
  };

  const handleDelete = async (record: DatasetItem) => {
    try {
      await deleteDatasetApi({ id: record.id });
      message.success("Dataset deleted successfully");
      refetch();
    } catch {
      message.error("Failed to delete dataset");
    }
  };

  const handleEnsureDir = async (record: DatasetItem) => {
    try {
      const response = await ensureDatasetDirApi({ id: record.id });
      const dirPath = response.data?.path;
      message.success(dirPath ? `Dataset dir ready: ${dirPath}` : "Dataset dir ready");
    } catch {
      message.error("Failed to create dataset dir");
    }
  };

  // Import every file under the dataset workspace directory (utils.GetDatasetDir)
  // into go_file / go_dataset_file. The backend skips files already bound to the
  // dataset (same path + dataset_id), so re-running it is idempotent.
  const handleImportDirFiles = async (record: DatasetItem) => {
    setImportingId(record.id);
    try {
      const response = await importDatasetDirFilesApi({ dataset_id: record.id });
      const result = response.data;
      const imported = result?.imported ?? 0;
      const skipped = result?.skipped ?? 0;
      const failed = result?.failed ?? 0;
      const summary = `Imported ${imported}, skipped ${skipped}${failed > 0 ? `, failed ${failed}` : ""}`;

      if (failed > 0) {
        message.warning(summary);
      } else {
        message.success(summary);
      }
      // Refresh both the dataset list and any expanded file panel.
      setFilesRefreshKey((value) => value + 1);
      refetch();
    } catch {
      message.error("Failed to import dataset dir files");
    } finally {
      setImportingId(undefined);
    }
  };

  const actionsColumn: ColumnsType<DatasetItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 190,
    align: "right",
    fixed: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Create Dir">
          <Button
            type="text"
            size="small"
            icon={<FolderAddOutlined />}
            onClick={() => handleEnsureDir(record)}
          />
        </Tooltip>
        <Tooltip title="Import Dir Files">
          <Button
            type="text"
            size="small"
            icon={<ImportOutlined />}
            loading={importingId === record.id}
            disabled={Boolean(importingId) && importingId !== record.id}
            onClick={() => handleImportDirFiles(record)}
          />
        </Tooltip>
        <Tooltip title="Edit">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this dataset?"
          description="This will also remove its project, file and sample associations."
          onConfirm={() => handleDelete(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const selectColumn: ColumnsType<DatasetItem>[number] = {
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
  };

  const tableColumns: ColumnsType<DatasetItem> = selectable
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
    if (close) {
      close();
    }
  };

  return (
    <Card
      size="small"
      title={title || "Dataset List By Project"}
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
      <Table<DatasetItem>
        rowKey="id"
        columns={tableColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 980 }}
        locale={{ emptyText: error ? "Failed to load datasets" : "No datasets" }}
        expandable={{
          expandedRowKeys,
          onExpand: (expanded, record) => {
            setExpandedRowKeys((prev) =>
              expanded ? [...prev.filter((id) => id !== record.id), record.id] : prev.filter((id) => id !== record.id)
            );
          },
          expandedRowRender: (record) => (
            <DatasetFilesPanel key={`${record.id}:${filesRefreshKey}`} datasetId={record.id} />
          ),
        }}
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
          onClick: (event) => handleRowClick(record, event),
        })}
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

export default DatasetProjectPage;

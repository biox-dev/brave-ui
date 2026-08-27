import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { useDatasetFilePageQuery } from "@/hooks/usePaginationV2";
import type { DatasetFileItem } from "@/api/data";
import { deleteFileApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface DatasetFilePageProps {
  project_id?: string;
  file_id?: string;
  file_name?: string;
  path?: string;
  format?: string;
  storage?: string;
  description?: string;
  dataset_id?: string;
  dataset_name?: string;
  role?: string | string[];
  page_size?: number | string;
  title?: string;
  onOk?: (file: DatasetFileItem) => void;
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

const normalizeRoles = (role?: string | string[]) => {
  if (!role) {
    return undefined;
  }

  const source = Array.isArray(role) ? role : role.split(",");
  const roles = source
    .map((item) => item.trim())
    .filter(Boolean);

  return roles.length > 0 ? roles : undefined;
};

const isSpreadsheetFile = (item: DatasetFileItem) => {
  const format = String(item.format ?? "").toLowerCase();
  if (["xlsx", "xls", "csv", "tsv"].includes(format)) {
    return true;
  }

  const path = String(item.path ?? "").toLowerCase();
  return [".xlsx", ".xls", ".csv", ".tsv"].some((ext) => path.endsWith(ext));
};

const columns: ColumnsType<DatasetFileItem> = [
  {
    title: "File Name",
    dataIndex: "file_name",
    key: "file_name",
    ellipsis: true,
  },
  {
    title: "File ID",
    dataIndex: "file_id",
    key: "file_id",
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
    title: "Role",
    dataIndex: "role",
    key: "role",
    width: 100,
    render: (value: string) => value || "-",
  },
  {
    title: "Path",
    dataIndex: "path",
    key: "path",
    ellipsis: true,
    render: (value: string) => <Tooltip placement="left" title={value || "-"} >{value || "-"}</Tooltip>,
  },
  {
    title: "Created At",
    dataIndex: "created_at",
    key: "created_at",
    width: 210,
    render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
  },
];

const DatasetFilePage = ({
  project_id,
  file_id,
  file_name,
  path,
  format,
  storage,
  description,
  dataset_id,
  dataset_name,
  role,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: DatasetFilePageProps) => {
  const { project } = useSelector((state: any) => state.user);
  const message = useGlobalMessage();
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
  } = useDatasetFilePageQuery(
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
      file_id: normalizeText(file_id),
      file_name: normalizeText(file_name),
      path: normalizeText(path),
      format: normalizeText(format),
      storage: normalizeText(storage),
      description: normalizeText(description),
      dataset_id: normalizeText(dataset_id),
      dataset_name: normalizeText(dataset_name),
      role: normalizeRoles(role),
    });
  }, [ file_id, file_name, path, format, storage, description, dataset_id, dataset_name, role, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleOpenSheet = (item: DatasetFileItem) => {
    if (!isSpreadsheetFile(item)) {
      message.warning("Only spreadsheet files can be opened in Univer");
      return;
    }

    invoke.univerView.open(
      {
        // path: item.path,
        file_id: item.file_id,
      },
      {
        width: "90%",
        title: `Sheet: ${item.file_name || item.file_id}`,
      }
    );
  };

  const selectColumns = useMemo<ColumnsType<DatasetFileItem>>(() => {
    const actionColumn: ColumnsType<DatasetFileItem>[number] = {
      title: "Actions",
      key: "actions",
      width: 240,
      fixed: "right",
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            size="small"
            color="cyan"
            variant="solid"
            onClick={async () => {
              try {
                await invoke.editFilePage.openDrawerAsync(
                  { file: record },
                  { width: 480, title: `Edit File: ${record.file_name || record.file_id}` }
                );
                refetch();
              } catch {
                // user cancelled
              }
            }}
          >
            Edit
          </Button>
          <Button
            size="small"
            onClick={async () => {
              try {
                await invoke.editDatasetFileRole.openDrawerAsync(
                  { file: record },
                  { width: 400, title: `Edit Role: ${record.file_name || record.file_id}` }
                );
                refetch();
              } catch {
                // user cancelled
              }
            }}
          >
            Role
          </Button>
          <Popconfirm
            title="Delete this file?"
            description="This will remove the file and its dataset associations."
            onConfirm={async () => {
              await deleteFileApi({ id: record.id });
              message.success("File deleted successfully");
              refetch();
            }}
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    };

    const sheetColumn: ColumnsType<DatasetFileItem>[number] = {
      title: "Sheet",
      key: "sheet",
      width: 80,
      fixed: "right",
      render: (_: unknown, record) => (
        <Button size="small" disabled={!isSpreadsheetFile(record)} onClick={() => handleOpenSheet(record)}>
          Open
        </Button>
      ),
    };

    const baseColumns: ColumnsType<DatasetFileItem> = [
      ...columns,
      sheetColumn,
      actionColumn,
    ];

    if (!selectable) {
      return baseColumns;
    }

    return [
      ...baseColumns,
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
      title={title || "File List By Project"}
      extra={
        <Space>
          <Text type="secondary">Total: {total}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<DatasetFileItem>
        rowKey="id"
        columns={selectColumns}
        dataSource={data}
        loading={isLoading || isFetching}
        size="small"
        scroll={{ x: 1200 }}
        locale={{ emptyText: error ? "Failed to load files" : "No files" }}
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

export default DatasetFilePage;

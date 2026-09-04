import { useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Flex, Pagination, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAppSessionPageQuery } from "@/hooks/usePaginationV2";
import {
  createAppSessionApi,
  createAppSessionByAnalysisNodeApi,
  deleteAppSessionApi,
  recreateAppSessionContainerApi,
  startAppSessionApi,
  stopAppSessionApi,
  type AppSessionItem,
  type ContainerTemplateItem,
} from "@/api/container";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";

const { Text } = Typography;

export interface AppSessionPageProps {
  id?: string;
  project_id?: string;
  analysis_node_id?: string;
  analysis_node_name?: string;
  container_template_id?: string;
  name?: string;
  status?: string;
  workspace_path?: string;
  page_size?: number | string;
  view_mode?: "table" | "card" | string;
  title?: string;
  onOk?: (item: AppSessionItem) => void;
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

const normalizeViewMode = (value?: string) => {
  return value?.toLowerCase() === "card" ? "card" : "table";
};

const buildAppUrl = (containerURL: string, appSession?: AppSessionItem) => {
  if (!appSession || !appSession.id) {
    return "";
  }
  //如果containerURL后有/ 去掉
  const normalizedContainerURL = containerURL.endsWith("/") ? containerURL.slice(0, -1) : containerURL;
  return `${normalizedContainerURL}${appSession.path_prefix}/`;
};

const isRunningStatus = (status?: string) => /running|started|active/i.test(status || "");

const isStoppedStatus = (status?: string) => /stopped|exited|failed|terminated|created/i.test(status || "");

const getStatusColor = (status?: string) => {
  if (isRunningStatus(status)) {
    return "success";
  }
  if (isStoppedStatus(status)) {
    return "default";
  }
  return "processing";
};

const getDefaultAppSessionName = (item: ContainerTemplateItem) => {
  const base = (item.name || "app-session").trim().replace(/\s+/g, "-").toLowerCase();
  return `${base}-${Date.now()}`;
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

const AppSessionPage = ({
  id,
  project_id: projectIdProp,
  analysis_node_id,
  analysis_node_name,
  container_template_id,
  name,
  status,
  workspace_path,
  page_size,
  view_mode,
  title,
  onOk,
  onCancel,
  close,
}: AppSessionPageProps) => {
  const { register, unregister } = useComponentStore();
  const { locale } = useI18n();
  const [selectedId, setSelectedID] = useState<string>();
  const [pendingAction, setPendingAction] = useState<string>("");
  const [creatingFromAnalysisNode, setCreatingFromAnalysisNode] = useState(false);
  const [onlyCurrentProject, setOnlyCurrentProject] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const selectable = Boolean(onOk || onCancel);
  const activeViewMode = normalizeViewMode(view_mode);
  const isCardMode = activeViewMode === "card";
  const { containerURL } = useSelector((state: any) => state.user);
  // const resolvedProjectID = normalizeText(projectIdProp) || normalizeText(currentProjectID);

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
  } = useAppSessionPageQuery(
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
      // project_id: onlyCurrentProject ? resolvedProjectID : undefined,
      analysis_node_id: normalizeText(analysis_node_id),
      container_template_id: normalizeText(container_template_id),
      name: normalizeText(name),
      status: normalizeText(status),
      workspace_path: normalizeText(workspace_path),
    });
  }, [
    id,
    onlyCurrentProject,
    // resolvedProjectID,
    analysis_node_id,
    container_template_id,
    name,
    status,
    workspace_path,
    setQuery,
  ]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const realtimeInstance = useMemo(
    () => ({
      analysisSubmitted: (_args: any) => {
        refetch();
      },
      analysisStarted: (_args: any) => {
        refetch();
      },
      analysisDone: (_args: any) => {
        refetch();
      },
    }),
    [refetch]
  );

  useEffect(() => {
    register("app-session", "*", realtimeInstance);
    return () => {
      unregister("app-session", "*", realtimeInstance);
    };
  }, [register, unregister, realtimeInstance]);

  const runAction = async (action: "start" | "stop" | "recreate" | "delete", item: AppSessionItem) => {
    const actionKey = `${action}-${item.id}`;
    setPendingAction(actionKey);
    try {
      if (action === "start") {
        await startAppSessionApi({ id: String(item.id) });
        messageApi.success("App session started");
      } else if (action === "stop") {
        await stopAppSessionApi({ id: String(item.id) });
        messageApi.success("App session stopped");
      } else if (action === "recreate") {
        await recreateAppSessionContainerApi({ id: String(item.id) });
        messageApi.success("App session container recreate request submitted");
      } else {
        await deleteAppSessionApi({ id: String(item.id) });
        messageApi.success("App session deleted");
      }
      await refetch();
    } catch (_error) {
      // Error message is handled by the global HTTP interceptor.
    } finally {
      setPendingAction("");
    }
  };

  const handleDescribe = async (record: AppSessionItem) => {
    const instanceId = normalizeText(record.container_instance_id);
    if (!instanceId) {
      messageApi.warning("No container instance");
      return;
    }
    try {
      await invoke.containerInstanceDescribeDialog.openAsync(
        { instanceId },
        {
          title: `Describe: ${record.container_instance_name || record.name || instanceId}`,
          width: 720,
          footer: false,
        }
      );
    } catch {
      // User cancelled
    }
  };

  const renderOperationButtons = (record: AppSessionItem, compact = false) => {
    const itemStatus = record.status || "";
    const startKey = `start-${record.id}`;
    const stopKey = `stop-${record.id}`;
    const recreateKey = `recreate-${record.id}`;
    const deleteKey = `delete-${record.id}`;
    const appUrl = buildAppUrl(containerURL, record);

    return (
      <Space size={compact ? 2 : 4} wrap>
        <Tooltip title={`${appUrl}`}>
          <Button
            size="small"
            type="link"
            disabled={!isRunningStatus(itemStatus) || !appUrl}
            onClick={() => window.open(appUrl, "_blank", "noopener,noreferrer")}
          >
            Open
          </Button>
        </Tooltip>

        <Button
          size="small"
          type="link"
          disabled={!record.container_instance_id}
          onClick={() => handleDescribe(record)}
        >
          Describe
        </Button>

        <Button
          size="small"
          type="link"
          disabled={isRunningStatus(itemStatus)}
          loading={pendingAction === startKey}
          onClick={() => runAction("start", record)}
        >
          Start
        </Button>
        <Button
          size="small"
          type="link"
          disabled={isStoppedStatus(itemStatus)}
          loading={pendingAction === stopKey}
          onClick={() => runAction("stop", record)}
        >
          Stop
        </Button>
        <Popconfirm
          title="Recreate this app session container?"
          description="This will delete and create a new container for this app session."
          onConfirm={() => runAction("recreate", record)}
          okButtonProps={{ loading: pendingAction === recreateKey }}
        >
          <Button size="small" type="link" loading={pendingAction === recreateKey}>
            Recreate
          </Button>
        </Popconfirm>
        <Popconfirm
          title="Delete this app session?"
          onConfirm={() => runAction("delete", record)}
          okButtonProps={{ loading: pendingAction === deleteKey }}
        >
          <Button size="small" type="link" danger loading={pendingAction === deleteKey}>
            Delete
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  const columns = useMemo<ColumnsType<AppSessionItem>>(
    () => [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        width: 220,
        ellipsis: true,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (value: string) => value || "-",
      },
      {
        title: "Project ID",
        dataIndex: "project_id",
        key: "project_id",
        width: 160,
        render: (value: string) => value || "-",
      },
      {
        title: "Node Name",
        dataIndex: "node_name",
        key: "node_name",
        width: 180,
        ellipsis: true,
        render: (value?: string) => value?.trim() || "-",
      },
      {
        title: "Template ID",
        dataIndex: "container_template_id",
        key: "container_template_id",
        width: 180,
        render: (value: string) => value || "-",
      },
      {
        title: "Workspace",
        dataIndex: "workspace_path",
        key: "workspace_path",
        ellipsis: true,
        render: (value: string) => value || "-",
      },
      {
        title: "Started At",
        dataIndex: "started_at",
        key: "started_at",
        width: 200,
        render: (value: string) => formatRelativeTime(value, locale),
      },
      {
        title: "Stopped At",
        dataIndex: "stopped_at",
        key: "stopped_at",
        width: 200,
        render: (value: string) => formatRelativeTime(value, locale),
      },
      {
        title: "Created At",
        dataIndex: "created_at",
        key: "created_at",
        width: 210,
        render: (value: string) => formatRelativeTime(value, locale),
      },
    ],
    [locale]
  );

  const selectColumns = useMemo<ColumnsType<AppSessionItem>>(() => {
    const actionColumns: ColumnsType<AppSessionItem> = [
      {
        title: "Operation",
        key: "operation",
        width: 340,
        fixed: "right",
        render: (_: unknown, record) => renderOperationButtons(record),
      },
    ];

    if (!selectable) {
      return [...columns, ...actionColumns];
    }

    return [
      ...columns,
      ...actionColumns,
      {
        title: "Select",
        key: "select_action",
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
  }, [selectable, selectedId, renderOperationButtons, columns]);

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

  const handleCreateByAnalysisNode = async () => {
    const normalizedAnalysisNodeId = normalizeText(analysis_node_id);
    if (!normalizedAnalysisNodeId) {
      return;
    }

    setCreatingFromAnalysisNode(true);
    try {
      const normalizedNodeName = normalizeText(analysis_node_name) || normalizedAnalysisNodeId;
      await createAppSessionByAnalysisNodeApi({
        analysis_node_id: normalizedAnalysisNodeId,
        name: `app-${normalizedNodeName}`,
      });
      messageApi.success("App session created");
      await refetch();
    } catch (_error) {
      // Error message is handled by the global HTTP interceptor.
    } finally {
      setCreatingFromAnalysisNode(false);
    }
  };

  const handleCreateAppSession = async (item: ContainerTemplateItem) => {
    // const normalizedProjectID = normalizeText(resolvedProjectID);
    // if (!normalizedProjectID) {
    //   messageApi.warning("No active project selected");
    //   return;
    // }

    try {
      await createAppSessionApi({
        container_template_id: String(item.id),
        // project_id: normalizedProjectID,
        name: getDefaultAppSessionName(item),
      });
      messageApi.success("App session created");
      await refetch();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Failed to create app session"));
    }
  };

  const handleOpenTemplatePage = async () => {
    try {
      const selectedTemplate = await invoke.containerTemplatePage.openAsync(
        {},
        {
          title: "Container Template List",
          width: 1200,
          footer: false,
        }
      );

      if (selectedTemplate) {
        await handleCreateAppSession(selectedTemplate as ContainerTemplateItem);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <Card
      size="small"
      title={title || "App Session List"}
      extra={
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenTemplatePage}>
            Create
          </Button>
          {normalizeText(analysis_node_id) && (
            <Button
              type="default"
              onClick={handleCreateByAnalysisNode}
              loading={creatingFromAnalysisNode}
            >
              Create from Analysis Node
            </Button>
          )}
          {/* <Space size={6}>
            <Text type="secondary">Only current project</Text>
            <Switch
              size="small"
              checked={onlyCurrentProject}
              onChange={(checked) => {
                setOnlyCurrentProject(checked);
                setPage(1);
              }}
              disabled={!resolvedProjectID}
            />
          </Space> */}
          <Text type="secondary">Total: {total}</Text>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      }
    >
      {contextHolder}
      {isCardMode ? (
        <>
          {data.length > 0 ? (
            <Flex vertical gap={8}>
              {data.map((record) => (
                <Card
                  key={record.id}
                  size="small"
                  style={{
                    borderColor: record.id === selectedId ? "#1677ff" : undefined,
                    background: record.id === selectedId ? "#f0f7ff" : undefined,
                  }}
                  bodyStyle={{ padding: 10 }}
                >
                  <Flex vertical gap={6}>
                    <Flex justify="space-between" align="flex-start" gap={8}>
                      {/* <Space size={2} style={{ minWidth: 0, flex: 1 }}> */}
                      <Text strong ellipsis={{ tooltip: record.id || "-" }}>
                        {record.name || "-"}
                      </Text>

                      <Tag color={getStatusColor(record.status)} style={{ marginInlineEnd: 0 }}>
                        {record.status || "unknown"}
                      </Tag>
                      {/* </Space> */}

                      {/* {selectable && (
                        <Button
                          type={record.id === selectedId ? "primary" : "default"}
                          size="small"
                          onClick={() => setSelectedID(record.id)}
                        >
                          {record.id === selectedId ? "Selected" : "Select"}
                        </Button>
                      )} */}
                    </Flex>

                    <Space direction="vertical" size={1} style={{ width: "100%" }}>
                      {/* <Text type="secondary" ellipsis={{ tooltip: record.project_id || "-" }}>
                        Project: {record.project_id || "-"}
                      </Text> */}
                      {normalizeText(record.node_name) && (
                        <Text type="secondary" ellipsis={{ tooltip: record.node_name || "-" }}>
                          Node: {record.node_name}
                        </Text>
                      )}
                      <Tooltip title={record.container_instance_id || "-"}>
                        <Text type="secondary" ellipsis={{ tooltip: record.container_instance_name || "-" }}>
                          Container Instance: {record.container_instance_name || "-"}
                        </Text>
                      </Tooltip>
                      {/* <Text type="secondary" ellipsis={{ tooltip: record.workspace_path || "-" }}>
                        Workspace: {record.workspace_path || "-"}
                      </Text> */}
                      <Text type="secondary">
                        Started: {formatRelativeTime(record.started_at, locale)}
                      </Text>
                      <Text type="secondary">
                        Created: {formatRelativeTime(record.created_at, locale)}
                      </Text>
                    </Space>

                    <Flex align="center" justify="space-between" wrap gap={4}>
                      {renderOperationButtons(record, true)}
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Flex>
          ) : (
            <Empty description={error ? "Failed to load app sessions" : "No app sessions"} />
          )}

          <Flex justify="end" style={{ marginTop: 12 }}>
            <Pagination
              size="small"
              responsive
              showLessItems
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
              onChange={(nextPage, nextPageSize) => {
                if (nextPageSize !== pageSize) {
                  setPageSize(nextPageSize);
                }
                setPage(nextPage);
              }}
              showTotal={(value) => `Total ${value} items`}
            />
          </Flex>
        </>
      ) : (
        <Table<AppSessionItem>
          rowKey="id"
          columns={selectColumns}
          dataSource={data}
          loading={isLoading || isFetching}
          size="small"
          scroll={{ x: 1500 }}
          locale={{ emptyText: error ? "Failed to load app sessions" : "No app sessions" }}
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
      )}

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

export default AppSessionPage;

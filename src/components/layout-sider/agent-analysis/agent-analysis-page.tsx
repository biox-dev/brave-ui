import { useEffect, useMemo } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Pagination,
  Popconfirm,
  Popover,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  RobotOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  deleteAgentAnalysisApi,
  isAgentAnalysisActive,
  isAgentAnalysisRunning,
  rerunAgentAnalysisApi,
  stopAgentAnalysisApi,
  type AgentAnalysisItem,
} from "@/api/agent-analysis";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { useAgentAnalysisPageQuery } from "@/hooks/usePaginationV2";
import { formatRelativeTime } from "@/utils/time";
import { useSelector } from "react-redux";

const statusColor = (status?: string) => {
  const normalized = (status || "").toLowerCase();
  if (normalized === "running") return "success";
  if (normalized === "pending") return "processing";
  if (normalized === "done") return "blue";
  if (normalized === "failed" || normalized === "timeout") return "error";
  return "default";
};

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const AgentAnalysisDetailCard = ({ item }: { item: AgentAnalysisItem }) => (
  <div style={{ width: 420 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "name", label: "Name", children: item.name || item.id },
        { key: "id", label: "ID", children: item.id },
        { key: "template_id", label: "Template", children: item.template_id || "-" },
        {
          key: "status",
          label: "Status",
          children: (
            <Tag color={statusColor(item.status)}>{item.status || "unknown"}</Tag>
          ),
        },
        {
          key: "command",
          label: "Command",
          children: (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
              {item.command || "-"}
            </span>
          ),
        },
        {
          key: "workspace_dir",
          label: "Workspace",
          children: (
            <span style={{ wordBreak: "break-all" }}>{item.workspace_dir || "-"}</span>
          ),
        },
        { key: "exit_code", label: "Exit Code", children: item.exit_code ?? "-" },
        ...(item.error_message
          ? [
              {
                key: "error_message",
                label: "Error",
                children: (
                  <span
                    style={{
                      color: "#ff4d4f",
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.error_message}
                  </span>
                ),
              },
            ]
          : []),
        { key: "started_at", label: "Started At", children: formatDateTime(item.started_at) },
        { key: "finished_at", label: "Finished At", children: formatDateTime(item.finished_at) },
        { key: "created_at", label: "Created At", children: formatDateTime(item.created_at) },
      ]}
    />
  </div>
);

const AgentAnalysisPage = () => {
  const message = useGlobalMessage();
  const { register, unregister } = useComponentStore();
  const { locale } = useI18n();
  const { projectId } = useSelector((state: { user: { projectId?: string } }) => state.user);

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    isFetching,
    refetch,
  } = useAgentAnalysisPageQuery(
    {},
    {
      initialPageSize: 20,
      scopeKey: projectId,
    },
  );

  // websocket 实时刷新：后端推送 component.invoke(category="agent-analysis", method=...)。
  // 使用 refetch() 静默刷新，不切换 loading 遮罩，避免列表闪烁。
  const realtimeInstance = useMemo(
    () => ({
      refresh: () => {
        refetch();
      },
      analysisSubmitted: () => {
        refetch();
      },
      analysisStarted: () => {
        refetch();
      },
      analysisDone: () => {
        refetch();
      },
      analysisFailed: () => {
        refetch();
      },
    }),
    [refetch],
  );

  useEffect(() => {
    register("agent-analysis", "*", realtimeInstance);
    return () => {
      unregister("agent-analysis", "*", realtimeInstance);
    };
  }, [register, unregister, realtimeInstance]);

  const openCreate = () => {
    invoke.agentAnalysisForm.open(
      { callback: () => refetch() },
      { title: "Create AgentAnalysis", width: 640, footer: null },
    );
  };

  const openEdit = (item: AgentAnalysisItem) => {
    invoke.agentAnalysisForm.open(
      { id: item.id, callback: () => refetch() },
      {
        title: `Edit AgentAnalysis: ${item.name || item.id}`,
        width: 640,
        footer: null,
      },
    );
  };

  // 通过 invoke 打开容器实例 describe 弹窗（依赖 container_instance_id）。
  const openContainerDescribe = async (item: AgentAnalysisItem) => {
    if (!item.container_instance_id) {
      return;
    }
    try {
      await invoke.containerInstanceDescribeDialog.openAsync(
        { instanceId: item.container_instance_id },
        {
          title: `Container Describe: ${item.name || item.id}`,
          width: 720,
          footer: false,
        },
      );
    } catch {
      // User cancelled
    }
  };

  const openTerminal = (item: AgentAnalysisItem) => {
    invoke.agentAnalysisTerminal.open(
      { id: item.id, name: item.name },
      {
        title: `Terminal: ${item.name || item.id}`,
        width: "85%",
        footer: null,
      },
    );
  };

  // 通过 invoke 弹窗查看命令日志（WorkspaceDir/command.log）。
  const openLog = (item: AgentAnalysisItem) => {
    invoke.agentAnalysisLog.open(
      {
        id: item.id,
        name: item.name,
        log_path: item.log_path,
        status: item.status,
      },
      {
        title: `Log: ${item.name || item.id}`,
        width: "80%",
        footer: null,
      },
    );
  };

  const handleDelete = async (item: AgentAnalysisItem) => {
    try {
      await deleteAgentAnalysisApi(item.id);
      message.success("AgentAnalysis 已删除");
      await refetch();
    } catch (error) {
      console.warn("delete agent analysis failed", error);
    }
  };

  const handleRerun = async (item: AgentAnalysisItem) => {
    try {
      await rerunAgentAnalysisApi(item.id);
      message.success("已提交重新运行");
      await refetch();
    } catch (error) {
      console.warn("rerun agent analysis failed", error);
    }
  };

  const handleStop = async (item: AgentAnalysisItem) => {
    try {
      await stopAgentAnalysisApi(item.id);
      message.success("已提交停止");
      await refetch();
    } catch (error) {
      console.warn("stop agent analysis failed", error);
    }
  };

  const columns = useMemo<ColumnsType<AgentAnalysisItem>>(
    () => [
      {
        key: "item",
        render: (_: unknown, record) => {
          const meta = [
            // `template ${record.template_id}`,
            // record.workspace_dir,
            record.status,
            record.created_at ? formatRelativeTime(record.created_at, locale) : "",
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <RobotOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip placement="topLeft" title={record.name || record.id}>
                  <span className="project-report-item-title">
                    {record.name || record.id}
                  </span>
                </Tooltip>
                {meta ? (
                  <span className="project-report-item-meta" title={meta}>
                    {/* {record.status || "unknown"} */}
                    {meta}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
    ],
    [locale],
  );

  const bodyRow = useMemo(() => {
    const Row = (props: any) => {
      const rowKey = props?.["data-row-key"];
      const record = data.find((item) => String(item.id) === String(rowKey));
      const rowElement = <tr {...props} />;

      if (!record) {
        return rowElement;
      }

      return (
        <Popover
          placement="left"
          mouseEnterDelay={0.2}
          mouseLeaveDelay={0.1}
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RobotOutlined />
              {record.name || record.id}
            </span>
          }
          content={<AgentAnalysisDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  const actionsColumn: ColumnsType<AgentAnalysisItem>[number] = {
    key: "actions",
    width: 260,
    align: "right",
    render: (_: unknown, record) => {
      const running = isAgentAnalysisRunning(record.status);
      const active = isAgentAnalysisActive(record.status);
      return (
        <span
          className="project-report-item-actions"
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip title="View log">
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openLog(record)}
            />
          </Tooltip>
          <Tooltip
            title={
              record.container_instance_id
                ? "Describe container instance"
                : "No container instance"
            }
          >
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              disabled={!record.container_instance_id}
              onClick={() => openContainerDescribe(record)}
            />
          </Tooltip>
          <Tooltip
            title={running ? "Attach terminal" : "Only available while running"}
          >
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              disabled={!running}
              onClick={() => openTerminal(record)}
            />
          </Tooltip>
          <Tooltip
            title={active ? "Only available after it finishes" : "Rerun container"}
          >
            <Popconfirm
              title="Rerun this AgentAnalysis?"
              description="A new container will be created and the old one deleted."
              disabled={active}
              onConfirm={() => handleRerun(record)}
            >
              <Button
                type="text"
                size="small"
                icon={<RedoOutlined />}
                disabled={active}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title={active ? "Stop container" : "Not running"}>
            <Popconfirm
              title="Stop this AgentAnalysis?"
              description="The running container will be stopped and marked canceled."
              disabled={!active}
              onConfirm={() => handleStop(record)}
            >
              <Button
                type="text"
                size="small"
                icon={<StopOutlined />}
                disabled={!active}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this AgentAnalysis?"
            description="Its container will be deleted as well."
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      );
    },
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Agent Analysis</span>
        <div className="project-report-panel-actions">
          <Tooltip title="Create AgentAnalysis">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={openCreate}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => refetch()}
            />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No AgentAnalysis" />
        ) : (
          <Table<AgentAnalysisItem>
            rowKey="id"
            size="small"
            showHeader={false}
            pagination={false}
            loading={isLoading}
            columns={[...columns, actionsColumn]}
            dataSource={data}
            components={{ body: { row: bodyRow } }}
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `${t} agent analyses`}
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>
    </div>
  );
};

export default AgentAnalysisPage;

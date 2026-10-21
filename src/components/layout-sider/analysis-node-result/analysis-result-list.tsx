import { deleteAnalysisNodeApi, type AnalysisNodeItem } from "@/api/analysis";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";
import { useAnalysisNodePageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, ExperimentOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";

const statusColor = (status: string) => {
  switch (status) {
    case "succeeded":
    case "success":
    case "finished":
      return "success";
    case "failed":
    case "error":
      return "error";
    case "running":
    case "submitted":
      return "processing";
    case "ready":
    case "pending":
      return "default";
    default:
      return "default";
  }
};

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString() : "-";

const AnalysisNodeDetailCard = ({ item }: { item: AnalysisNodeItem }) => (
  <div style={{ width: 380 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "node_name", label: "Node Name", children: item.node_name || item.analysis_node_id || "-" },
        { key: "id", label: "ID", children: item.id || "-" },
        { key: "analysis_node_id", label: "Analysis Node ID", children: item.analysis_node_id || "-" },
        { key: "node_id", label: "Node ID", children: item.node_id || "-" },
        { key: "script_id", label: "Script ID", children: item.script_id || "-" },
        { key: "analysis_id", label: "Analysis ID", children: item.analysis_id || "-" },
        { key: "project_id", label: "Project ID", children: item.project_id || "-" },
        {
          key: "status",
          label: "Status",
          children: item.status ? <Tag color={statusColor(item.status)}>{item.status}</Tag> : "-",
        },
        // { key: "server_status", label: "Server Status", children: item.server_status || "-" },
        { key: "executor", label: "Executor", children: item.executor || "-" },
        // { key: "cache_hit", label: "Cache Hit", children: item.cache_hit ? "Yes" : "No" },
        {
          key: "retry",
          label: "Retry",
          children: `${item.retry ?? 0} / ${item.max_retry ?? 0}`,
        },
        // { key: "created_at", label: "Created At", children: formatDateTime(item.created_at) },
        { key: "updated_at", label: "Updated At", children: formatDateTime(item.updated_at) },
        // { key: "started_at", label: "Started At", children: formatDateTime(item.started_at) },
        { key: "finished_at", label: "Finished At", children: formatDateTime(item.finished_at) },
        {
          key: "output_dir",
          label: "Output Dir",
          children: item.output_dir ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.output_dir}</span>
          ) : (
            "-"
          ),
        },
        {
          key: "workspace_dir",
          label: "Workspace Dir",
          children: item.workspace_dir ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.workspace_dir}</span>
          ) : (
            "-"
          ),
        },
      ]}
    />
  </div>
);

export interface AnalysisResultListProps {
  title?: string;
  onOk?: (node: AnalysisNodeItem) => void;
  onCancel?: () => void;
  close?: () => void;
  // multiple 为 true 时支持一次选择多条，确认时 onOk 收到选中节点数组。
  multiple?: boolean;
}

const AnalysisResultList: FC<AnalysisResultListProps> = ({ title, onOk, onCancel, close, multiple = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();

  // Derive the selected node id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    const match = location.pathname.match(/\/analsyis-node-report\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 后端按调用者的 active project 过滤数据，所以把 project_id 作为 scopeKey 传给
  // 分页 hook：只进 query key（切项目时自动重新请求并回到第 1 页），不发给后端。
  const { projectId } = useSelector((state: any) => state.user);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, AnalysisNodeItem>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string) => picked.has(String(id));
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: AnalysisNodeItem) => {
    setPicked((prev) => {
      if (!multiple) {
        return new Map([[String(record.id), record]]);
      }
      const next = new Map(prev);
      if (next.has(String(record.id))) {
        next.delete(String(record.id));
      } else {
        next.set(String(record.id), record);
      }
      return next;
    });
  };

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
  } = useAnalysisNodePageQuery(
    {},
    {
      initialPageSize: 20,
      scopeKey: projectId,
    }
  );

  // 订阅 ws 分析事件：节点开始/结束后自动刷新列表。
  const { register, unregister } = useComponentStore();
  const instanceNode = useMemo(
    () => ({
      analysisStarted: () => {
        refetch();
      },
      analysisDone: () => {
        refetch();
      },
    }),
    [refetch]
  );
  useEffect(() => {
    register("analysis", "*", instanceNode);
    return () => {
      unregister("analysis", "*", instanceNode);
    };
  }, [register, unregister, instanceNode]);

  const handleDelete = async (node: AnalysisNodeItem) => {
    await deleteAnalysisNodeApi(node.id);
    message.success("Deleted successfully");
    refetch();
  };

  /**
   * invoke 弹窗打开节点报告（与路由 /analsyis-node-report/:analysisNodeId 同一组件：
   * 路由传的是 record.id，这里保持一致）。
   */
  const handleOpenReport = (node: AnalysisNodeItem) => {
    invoke.analysisNodeDetails.open(
      { analysis_node_id: String(node.id) },
      {
        width: 960,
        title: node.node_name || node.analysis_node_id || `Node-${node.id}`,
        footer: null,
      }
    );
  };

  /**
   * 手动创建命令型分析节点（无脚本，等价于 create_agent_analysis 的建节点部分）。
   * 弹窗内完成创建后返回新节点，这里只负责刷新列表。
   */
  const handleCreateCommandNode = async () => {
    try {
      await invoke.createCommandNode.openAsync(
        undefined,
        { title: "Create Command Analysis Node", width: 720, footer: null }
      );
      refetch();
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
    }
  };

  const handleConfirm = () => {
    if (!onOk || pickedItems.length === 0) {
      return;
    }
    // 多选时回传数组，单选时回传单个对象，保持既有调用方兼容。
    const payload = multiple ? pickedItems : pickedItems[0];
    (onOk as (value: AnalysisNodeItem | AnalysisNodeItem[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const columns = useMemo<ColumnsType<AnalysisNodeItem>>(
    () => [
      {
        title: "Node Name",
        dataIndex: "node_name",
        key: "node_name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = name || record.analysis_node_id || `Node-${record.id}`;
          const meta = [
            record.status,
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
            // script_name 来自后端按 script_id join 出来的脚本名称。
            record.script_name,
            // record.executor,

          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <ExperimentOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip placement="topLeft" title={title}>
                  <span className="project-report-item-title">{title}</span>
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
      // {
      //   title: "Status",
      //   dataIndex: "status",
      //   key: "status",
      //   width: 96,
      //   render: (status: string) =>
      //     status ? <Tag color={statusColor(status)}>{status}</Tag> : "-",
      // },
      {
        title: "Actions",
        key: "actions",
        width: 96,
        align: "right",
        render: (_, record) => (
          <span
            className="project-report-item-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title="Report">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenReport(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Delete selected analysis node?"
              onConfirm={() => handleDelete(record)}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </span>
        ),
      },
    ],
    [locale]
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
              <ExperimentOutlined />
              {record.node_name || record.analysis_node_id || `Node-${record.id}`}
            </span>
          }
          content={<AnalysisNodeDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  const selectColumn: ColumnsType<AnalysisNodeItem>[number] = {
    title: "Select",
    key: "select",
    width: 96,
    align: "right",
    render: (_, record) => (
      <Button
        type={isPicked(record.id) ? "primary" : "default"}
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          handleSelect(record);
        }}
      >
        {isPicked(record.id) ? "Selected" : "Select"}
      </Button>
    ),
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Analysis Nodes"}</span>
        <div className="project-report-panel-actions">
          <Tooltip title="Create command analysis node">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleCreateCommandNode}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No analysis node"
          />
        ) : (
          <Table<AnalysisNodeItem>
            rowKey="id"
            size="small"
            columns={selectable ? [...columns, selectColumn] : columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              isPicked(record.id) || String(record.id) === String(selectedId)
                ? "project-report-row-selected"
                : ""
            }
            onRow={(record) => ({
              onClick: () =>
                selectable
                  ? handleSelect(record)
                  : navigate(`/analsyis-node-report/${record.id}`),
            })}
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
          showTotal={(t) => `${t} nodes`}
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>

      {selectable && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid var(--sharp-divider)",
          }}
        >
          {multiple && pickedItems.length > 0 && (
            <span style={{ marginRight: "auto" }}>{pickedItems.length} selected</span>
          )}
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            type="primary"
            disabled={pickedItems.length === 0}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
};

export default AnalysisResultList;

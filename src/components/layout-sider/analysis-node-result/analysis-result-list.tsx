import { deleteAnalysisNodeApi, type AnalysisNodeItem } from "@/api/analysis";
import { useAnalysisNodePageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, ExperimentOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
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

const AnalysisResultList: FC<any> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();

  // Derive the selected node id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/analsyis-node-report\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 后端按调用者的 active project 过滤数据，所以把 project_id 作为 scopeKey 传给
  // 分页 hook：只进 query key（切项目时自动重新请求并回到第 1 页），不发给后端。
  const { projectId } = useSelector((state: any) => state.user);

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

  const handleDelete = async (node: AnalysisNodeItem) => {
    await deleteAnalysisNodeApi(node.id);
    message.success("Deleted successfully");
    refetch();
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
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
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
        width: 56,
        align: "right",
        render: (_, record) => (
          <span
            className="project-report-item-actions"
            onClick={(e) => e.stopPropagation()}
          >
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

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Analysis Nodes</span>
        <div className="project-report-panel-actions">
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
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => navigate(`/analsyis-node-report/${record.id}`),
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
    </div>
  );
};

export default AnalysisResultList;

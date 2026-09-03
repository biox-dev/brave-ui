import { deleteAnalysisNodeApi, type AnalysisNodeItem } from "@/api/analysis";
import { useAnalysisNodePageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, ExperimentOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Pagination, Popconfirm, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

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
        render: (name: string, record) => (
          <div className="project-report-item">
            <ExperimentOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <span className="project-report-item-title">
                {name || `Node-${record.id}`}
              </span>
              {record.updated_at && (
                <span className="project-report-item-meta">
                  {formatRelativeTime(record.updated_at, locale)}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 96,
        render: (status: string) =>
          status ? <Tag color={statusColor(status)}>{status}</Tag> : "-",
      },
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

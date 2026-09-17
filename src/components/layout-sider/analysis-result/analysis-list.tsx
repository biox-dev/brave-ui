import { deleteAnalysisApi, type AnalysisItem } from "@/api/analysis";
import { useAnalysisPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, FileSearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

const statusColor = (status: string) => {
  switch (status) {
    case "succeeded":
    case "success":
    case "finished":
    case "done":
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

const AnalysisDetailCard = ({ item }: { item: AnalysisItem }) => (
  <div style={{ width: 380 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "analysis_name", label: "Analysis Name", children: item.analysis_name || item.analysis_id || "-" },
        { key: "id", label: "ID", children: item.id || "-" },
        { key: "analysis_id", label: "Analysis ID", children: item.analysis_id || "-" },
        { key: "relation_id", label: "Relation ID", children: item.relation_id || "-" },
        { key: "project_id", label: "Project ID", children: item.project_id || "-" },
        {
          key: "job_status",
          label: "Job Status",
          children: item.job_status ? (
            <Tag color={statusColor(item.job_status)}>{item.job_status}</Tag>
          ) : (
            "-"
          ),
        },
        { key: "server_status", label: "Server Status", children: item.server_status || "-" },
        { key: "is_report", label: "Is Report", children: item.is_report ? "Yes" : "No" },
        { key: "cache_type", label: "Cache Type", children: item.cache_type ?? "-" },
        { key: "created_at", label: "Created At", children: formatDateTime(item.created_at) },
        { key: "updated_at", label: "Updated At", children: formatDateTime(item.updated_at) },
      ]}
    />
  </div>
);

const AnalysisList: FC<any> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();

  // Derive the selected analysis id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/analysis-report\/([^/]+)/);
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
  } = useAnalysisPageQuery(
    {},
    {
      initialPageSize: 20,
    }
  );

  const handleDelete = async (analysis: AnalysisItem) => {
    await deleteAnalysisApi(analysis.id);
    message.success("Deleted successfully");
    refetch();
  };

  const columns = useMemo<ColumnsType<AnalysisItem>>(
    () => [
      {
        title: "Analysis Name",
        dataIndex: "analysis_name",
        key: "analysis_name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = name || record.analysis_id || `Analysis-${record.id}`;
          const meta = [
        
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <FileSearchOutlined className="project-report-item-icon" />
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
      //   dataIndex: "job_status",
      //   key: "job_status",
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
            title="Delete selected analysis?"
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
              <FileSearchOutlined />
              {record.analysis_name || record.analysis_id || `Analysis-${record.id}`}
            </span>
          }
          content={<AnalysisDetailCard item={record} />}
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
        <span className="project-report-panel-title">Analysis</span>
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
            description="No analysis"
          />
        ) : (
          <Table<AnalysisItem>
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
              onClick: () => navigate(`/analysis-report/${record.id}`),
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
          showTotal={(t) => `${t} analyses`}
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

export default AnalysisList;

import { deleteAnalysisApi, type AnalysisItem } from "@/api/analysis";
import { useAnalysisPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, FileSearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";

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
        { key: "workflow_id", label: "Workflow ID", children: item.workflow_id || "-" },
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

export interface AnalysisListProps {
  title?: string;
  onOk?: (analysis: AnalysisItem) => void;
  onCancel?: () => void;
  close?: () => void;
  // multiple 为 true 时支持一次选择多条，确认时 onOk 收到选中条目数组。
  multiple?: boolean;
}

const AnalysisList: FC<AnalysisListProps> = ({ title, onOk, onCancel, close, multiple = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();

  // Derive the selected analysis id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    const match = location.pathname.match(/\/analysis-report\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);
  const { projectId } = useSelector((state: any) => state.user);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, AnalysisItem>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string) => picked.has(String(id));
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: AnalysisItem) => {
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
  } = useAnalysisPageQuery(
    {},
    {
      initialPageSize: 20,
      scopeKey: projectId,
    }
  );

  const handleDelete = async (analysis: AnalysisItem) => {
    await deleteAnalysisApi(analysis.id);
    message.success("Deleted successfully");
    refetch();
  };

  const handleConfirm = () => {
    if (!onOk || pickedItems.length === 0) {
      return;
    }
    // 多选时回传数组，单选时回传单个对象，保持既有调用方兼容。
    const payload = multiple ? pickedItems : pickedItems[0];
    (onOk as (value: AnalysisItem | AnalysisItem[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
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

  const selectColumn: ColumnsType<AnalysisItem>[number] = {
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
        <span className="project-report-panel-title">{title || "Analysis"}</span>
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
                  : navigate(`/analysis-report/${record.id}`),
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

export default AnalysisList;

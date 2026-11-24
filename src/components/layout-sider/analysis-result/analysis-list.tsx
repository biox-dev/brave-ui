import { deleteAnalysisApi, pageAnalysisByProjectApi, type AnalysisItem, type AnalysisPageQuery } from "@/api/analysis";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, FileSearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Popconfirm, Popover, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import SiderPanelLayout from "../common/sider-panel-layout";

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

const AnalysisDetailCard = ({ item, locale }: { item: AnalysisItem; locale: string }) => (
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
        { key: "created_at", label: "Created At", children: formatRelativeTime(item.created_at, locale) },
        { key: "updated_at", label: "Updated At", children: formatRelativeTime(item.updated_at, locale) },
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
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const AnalysisList: FC<AnalysisListProps> = ({ title, onOk, onCancel, close, multiple = false, collapsed = false, onToggleCollapse }) => {
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
    items: data,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    reload,
    sentinelRef,
  } = useLazyList<AnalysisItem, AnalysisPageQuery>({
    fetcher: (payload) => {
      const { page, page_size, keyword: kw, ...rest } = payload;
      return pageAnalysisByProjectApi({
        page,
        page_size,
        ...(kw ? { keyword: kw } : {}),
        query: rest,
      }).then((response) => response.data);
    },
    pageSize: 20,
    scopeKey: projectId,
    // 纵向堆叠折叠时只保留标题栏：停止列表请求，展开后自动恢复。
    enabled: !collapsed,
  });
  const refetch = reload;
  const isLoading = loading;
  const isFetching = loading || loadingMore;

  // 选择列（checkbox / radio）的回调：onChange 只包含当前页的选中项，
  // 因此多选时要把本页被取消勾选的条目从 prev 里移除、再合入本页勾选项，
  // 这样才能保留跨分页的选择。
  const handleSelectRows = (ids: string[], rows: AnalysisItem[]) => {
    setPicked((prev) => {
      if (!multiple) {
        const first = rows[0] ?? (ids[0] ? prev.get(String(ids[0])) : undefined);
        return first ? new Map([[String(first.id), first]]) : new Map();
      }
      const next = new Map(prev);
      data.forEach((item) => {
        const id = String(item.id);
        if (!ids.includes(id)) {
          next.delete(id);
        }
      });
      rows.forEach((row) => next.set(String(row.id), row));
      return next;
    });
  };

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
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <FileSearchOutlined />
                      {title}
                    </span>
                  }
                  content={<AnalysisDetailCard item={record} locale={locale} />}
                >
                  <span className="project-report-item-title">{title}</span>
                </Popover>
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

  return (
    <SiderPanelLayout
      title={title || "Analysis"}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search analyses"
            className="project-report-panel-search"
          />
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          />
        </>
      }
      footer={
        selectable ? (
          <>
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
          </>
        ) : undefined
      }
    >
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
          rowClassName={(record) =>
            isPicked(record.id) || String(record.id) === String(selectedId)
              ? "project-report-row-selected"
              : ""
          }
          rowSelection={
            selectable
              ? {
                  type: multiple ? "checkbox" : "radio",
                  selectedRowKeys: pickedItems.map((item) => item.id),
                  onChange: (keys, rows) =>
                    handleSelectRows(
                      keys.map(String),
                      rows as AnalysisItem[]
                    ),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: (event) => {
              // 勾选交给选择列，避免点 checkbox 时又触发一次行点击切换。
              if ((event.target as HTMLElement | null)?.closest?.(".ant-table-selection-column")) {
                return;
              }
              selectable ? handleSelect(record) : navigate(`/analysis-report/${record.id}`);
            },
          })}
        />
      )}
      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={data.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more analyses", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default AnalysisList;

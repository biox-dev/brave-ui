import {
  deleteProjectReportApi,
  getProjectReportDetailApi,
  pageProjectReportApi,
  publishProjectReportToDocApi,
  type ProjectReport,
} from "@/api/project";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import SiderPanelLayout from "../common/sider-panel-layout";

export interface ProjectReportListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
  /** 选择器模式：确认时回传选中的报告（multiple 为 true 时回传数组）。 */
  onOk?: (report: ProjectReport | ProjectReport[]) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 多选模式（仅在选择器模式下生效）。 */
  multiple?: boolean;
}

const ProjectReportList: FC<ProjectReportListProps> = ({
  collapsed = false,
  onToggleCollapse,
  onOk,
  onCancel,
  close,
  multiple = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;
  const [publishingReportId, setPublishingReportId] = useState<string>();

  // Derive the selected report id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    // 同时匹配 /report/:id 与 /report-file/:id，两种路由下对应行都保持高亮。
    const match = location.pathname.match(/\/(?:report-file|report)\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, ProjectReport>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string) => picked.has(String(id));
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: ProjectReport) => {
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
  } = useLazyList<ProjectReport>({
    fetcher: (payload) => pageProjectReportApi(payload).then((response) => response.data),
    pageSize: 10,
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
  const handleSelectRows = (ids: string[], rows: ProjectReport[]) => {
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

  const handleConfirm = () => {
    if (!onOk || pickedItems.length === 0) {
      return;
    }
    // 多选时回传数组，单选时回传单个对象，保持既有调用方兼容。
    const payload = multiple ? pickedItems : pickedItems[0];
    (onOk as (value: ProjectReport | ProjectReport[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const openCreate = async () => {
    if (!projectId) {
      message.warning("Please select a project first");
      return;
    }

    try {
      const created = await invoke.projectReportItemForm.openAsync(
        {
          mode: "create",
        },
        {
          title: "Create Project Report",
          footer: null,
          width: 560,
        }
      );
      await refetch();
      if (created?.id) {
        navigate(`/report/${created.id}`);
      }
    } catch {
      // User canceled the create modal.
    }
  };

  const openUpdate = async (report: ProjectReport) => {
    try {
      const detailResp = await getProjectReportDetailApi(report.id);
      await invoke.projectReportItemForm.openAsync(
        {
          mode: "update",
          report: detailResp.data,
        },
        {
          title: "Update Project Report",
          footer: null,
          width: 560,
        }
      );
      await refetch();
    } catch {
      // User canceled the update modal.
    }
  };

  const handleDelete = async (report: ProjectReport) => {
    await deleteProjectReportApi({ id: report.id });
    message.success("Deleted successfully");
    await refetch();
  };

  // handlePublishReport 一次发布报告下所有条目。
  const handlePublishReport = async (report: ProjectReport) => {
    setPublishingReportId(report.id);
    try {
      await publishProjectReportToDocApi(report.id);
      message.success("Report published to project doc");
    } finally {
      setPublishingReportId(undefined);
    }
  };

  const columns = useMemo<ColumnsType<ProjectReport>>(
    () => [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        // 与 ScriptPageList 的 Title 列一致：单元格内省略号截断，悬浮显示全称。
        ellipsis: { showTitle: false },
        render: (title: string, record) => {
          const name = title || `Untitled-${record.id}`;

          return (
            <div className="project-report-item">
              <FileTextOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip placement="topLeft" title={name}>
                  <span className="project-report-item-title">{name}</span>
                </Tooltip>
                {record.updated_at && (
                  <span className="project-report-item-meta">
                    {formatRelativeTime(record.updated_at, locale)}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 148,
        align: "right",
      render: (_, record) => (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 原先由 onRow 点击触发的跳转，改为列表内显式按钮。 */}
          <Tooltip title="Open report">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/report/${record.id}`)}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<SendOutlined />}
            title="Publish to doc"
            loading={publishingReportId === record.id}
            onClick={() => handlePublishReport(record)}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openUpdate(record)}
          />
          <Popconfirm
            title="Delete selected report item?"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ],
    [locale, publishingReportId, navigate]
  );

  return (
    <SiderPanelLayout
      title="Project Reports"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search reports"
            className="project-report-panel-search"
          />
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={openCreate} />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
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
          description="No project report item"
        />
      ) : (
        <Table<ProjectReport>
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
                    handleSelectRows(keys.map(String), rows as ProjectReport[]),
                }
              : undefined
          }
          // 点击行打开报告文件页（正文 output.md）；选择器模式下改为本地选中。
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: (event) => {
              if (
                (event.target as HTMLElement | null)
                  ?.closest?.(".ant-table-selection-column")
              ) {
                return;
              }
              selectable
                ? handleSelect(record)
                : navigate(`/report-file/${record.id}`);
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
        labels={{ loading: "Loading more…", noMore: "No more reports", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default ProjectReportList;

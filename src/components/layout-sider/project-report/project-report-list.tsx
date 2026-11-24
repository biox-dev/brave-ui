import {
  deleteProjectReportApi,
  pageProjectReportApi,
  type ProjectReport,
} from "@/api/project";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import {
  PROJECT_REPORT_TAB_KEY_PREFIX,
  useActiveWorkspaceResourceId,
  useWorkspaceOpener,
  type WorkspaceOpenTarget,
} from "@/layout/workspace-navigation";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import SiderPanelLayout from "../common/sider-panel-layout";

/** 报告的人类可读名称。 */
const reportDisplayName = (report: ProjectReport) => report.title || `Untitled-${report.id}`;

/** 报告正文页（output.md）的路由。 */
const reportFileRoutePath = (report: ProjectReport) => `/report-file/${report.id}`;

/** 报告总览页（发布 / 编辑入口所在页）的路由。 */
const reportDocRoutePath = (report: ProjectReport) => `/report/${report.id}`;

/**
 * 报告的「打开方式」统一描述：
 * - Agent 会话页：在右侧 MainTabs 用 projectReportFile 视图打开标签（与会话结果分区的 project_report 映射一致）；
 * - 其它页面：路由跳转到报告正文页 /report-file/:id。
 */
const buildReportTarget = (report: ProjectReport): WorkspaceOpenTarget => ({
  view: "projectReportFile",
  title: reportDisplayName(report),
  tabKeyPrefix: PROJECT_REPORT_TAB_KEY_PREFIX,
  resourceId: String(report.id),
  params: { reportId: String(report.id), defaultMode: "view" },
  routePath: reportFileRoutePath(report),
});

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

  // 当前是否在 Agent 会话页：是则行点击在右侧 MainTabs 打开标签，否则路由跳转。
  const openTarget = useWorkspaceOpener();
  // 会话页右侧正在显示的报告也算选中（行高亮与右侧标签保持一致）。
  const workspaceSelectedId = useActiveWorkspaceResourceId(PROJECT_REPORT_TAB_KEY_PREFIX);

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
  // 选择器模式用本地选中态；普通模式优先看路由（详情页），会话页回退到右侧激活标签。
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId ?? workspaceSelectedId;

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

  const handleDelete = async (report: ProjectReport) => {
    await deleteProjectReportApi({ id: report.id });
    message.success("Deleted successfully");
    await refetch();
  };

  /**
   * 打开报告正文：
   * - Agent 会话页 → 右侧 MainTabs 打开 / 聚焦标签（不跳路由，聊天不丢）；
   * - 其它页面 → 路由跳转到 /report-file/:id。
   */
  const handleOpen = useCallback(
    (report: ProjectReport) => {
      openTarget(buildReportTarget(report));
    },
    [openTarget]
  );

  /** Actions 里的「眼睛」始终路由跳转到报告总览页（发布 / 编辑都在那里）。 */
  const openReportRoute = useCallback(
    (report: ProjectReport) => {
      navigate(reportDocRoutePath(report));
    },
    [navigate]
  );

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
        width: 96,
        align: "right",
      render: (_, record) => (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 发布 / 编辑已搬到报告详情页（/report/:id），列表只保留查看与删除。 */}
          <Tooltip title="Open report">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openReportRoute(record)}
            />
          </Tooltip>
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
    [locale, openReportRoute]
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
                : handleOpen(record);
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

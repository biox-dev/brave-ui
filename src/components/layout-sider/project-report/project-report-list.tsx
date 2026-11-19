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
import { useLeftMiddlePane } from "@/hooks/useLeftMiddlePane";
import { useOpenMainTab } from "@/hooks/useMainTabTitle";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import SiderPanelLayout from "../common/sider-panel-layout";

export interface ProjectReportListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const ProjectReportList: FC<ProjectReportListProps> = ({ collapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();
  // 跳转 + 登记标签页名称一步完成（报告实体有 title 字段，默认标题规则即可）。
  const openMainTab = useOpenMainTab();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;
  const [publishingReportId, setPublishingReportId] = useState<string>();

  // Derive the selected report id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    // 同时匹配 /report/:id 与 /report-file/:id，两种路由下对应行都保持高亮。
    const match = location.pathname.match(/\/(?:report-file|report)\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 选中报告后，把「报告条目树」声明到布局的 leftMiddle 面板（列表右侧的二级详情）。
  // 选中状态来自路由，刷新 / 从标签页回到报告时面板可以自动恢复；
  // 卸载（切换活动栏视图）或折叠本面板时自动关闭。
  useLeftMiddlePane(
    "projectReportItems",
    collapsed || !selectedId ? null : { reportId: selectedId },
  );

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
        openMainTab(`/report/${created.id}`, created);
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
              onClick={() => openMainTab(`/report/${record.id}`, record)}
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
    [locale, publishingReportId, openMainTab]
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
          // 点击行打开报告文件页；报告下的条目树由 leftMiddle 面板展示，
          // 不再以「展开行」的形式嵌在列表里。
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: () => openMainTab(`/report-file/${record.id}`, record),
          })}
          rowClassName={(record) =>
            record.id === selectedId ? "project-report-row-selected" : ""
          }
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

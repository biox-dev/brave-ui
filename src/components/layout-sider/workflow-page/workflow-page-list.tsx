import type { WorkflowItem, WorkflowPageQuery } from "@/api/workflow";
import { pageWorkflowApi } from "@/api/workflow";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { ApartmentOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import SiderPanelLayout from "../common/sider-panel-layout";

// const splitTags = (tags?: string) =>
//   (tags ?? "")
//     .split(/[,;|\s]+/)
//     .map((tag) => tag.trim())
//     .filter(Boolean);

/** 工作流的人类可读名称：优先 name，其次 workflow_id，最后回退到 id。 */
const workflowDisplayName = (workflow: WorkflowItem) =>
  workflow.name || workflow.workflow_id || `Workflow-${workflow.id}`;

const WorkflowDetailCard = ({ item, locale }: { item: WorkflowItem; locale: string }) => {
  // const tags = splitTags(item.tags);

  return (
    <div style={{ width: 380 }}>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: "name", label: "Workflow Name", children: item.name || item.workflow_id || "-" },
          { key: "id", label: "ID", children: item.id ?? "-" },
          { key: "workflow_id", label: "Workflow ID", children: item.workflow_id || "-" },
          { key: "relation_type", label: "Relation Type", children: item.relation_type || "-" },
          { key: "component_id", label: "Component ID", children: item.component_id || "-" },
          { key: "container_id", label: "Container ID", children: item.container_id || "-" },
          { key: "category", label: "Category", children: item.category || "-" },
          { key: "install_key", label: "Install Key", children: item.install_key || "-" },
          { key: "version", label: "Version", children: item.version || "-" },
          { key: "order_index", label: "Order Index", children: item.order_index ?? "-" },
          // {
          //   key: "tags",
          //   label: "Tags",
          //   children: tags.length > 0 ? (
          //     <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
          //       {tags.map((tag) => (
          //         <Tag key={tag} color="blue" style={{ marginInlineEnd: 0 }}>
          //           {tag}
          //         </Tag>
          //       ))}
          //     </span>
          //   ) : (
          //     "-"
          //   ),
          // },
          {
            key: "description",
            label: "Description",
            children: item.description ? (
              <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.description}</span>
            ) : (
              "-"
            ),
          },
          {
            key: "created_at",
            label: "Created At",
            children: formatRelativeTime(item.created_at, locale),
          },
          {
            key: "updated_at",
            label: "Updated At",
            children: formatRelativeTime(item.updated_at, locale),
          },
        ]}
      />
    </div>
  );
};

export interface WorkflowPageListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const WorkflowPageList: FC<WorkflowPageListProps> = ({ collapsed = false, onToggleCollapse }) => {
  const message = useGlobalMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useI18n();

  // Derive the selected workflow id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/tools\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);
  const { projectId } = useSelector((state: any) => state.user);

  // 统一懒加载 + 服务端关键字搜索：滚动到底部自动加载下一页。
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
  } = useLazyList<WorkflowItem, WorkflowPageQuery>({
    fetcher: (payload) => {
      const { page, page_size, keyword: kw, ...rest } = payload;
      return pageWorkflowApi({
        page,
        page_size,
        query: { ...rest, ...(kw ? { keywords: kw } : {}) },
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

  /** 跳转到工作流详情页（普通路由跳转）。 */
  const handleOpen = (workflow: WorkflowItem) => {
    if (!workflow?.workflow_id) {
      return;
    }
    navigate(`/c/tools/${encodeURIComponent(String(workflow.id))}`);
  };

  const columns = useMemo<ColumnsType<WorkflowItem>>(
    () => [
      {
        title: "Workflow Name",
        dataIndex: "name",
        key: "name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = workflowDisplayName(record);
          const meta = [
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
            record.tags,
            // record.relation_type,
            // record.category,

          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <ApartmentOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ApartmentOutlined />
                      {title}
                    </span>
                  }
                  content={<WorkflowDetailCard item={record} locale={locale} />}
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
      //   title: "Relation Type",
      //   dataIndex: "relation_type",
      //   key: "relation_type",
      //   width: 110,
      //   render: (value: string) =>
      //     value ? <Tag color="blue">{value}</Tag> : "-",
      // },
    ],
    [locale]
  );

  const actionsColumn: ColumnsType<WorkflowItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 130,
    align: "right",
    render: (_: unknown, record) => {
      const title = workflowDisplayName(record);
      // Every action opens the same views the workflow-panel tabs use, but as a
      // drawer via `invoke` — edit, workflow visualization/DAG, and README.md.
      const drawerProps = { width: 960, title, footer: null };

      return (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                invoke.createOrUpdateWorkflow.drawer(
                  { workflow_id: record.id, callback: () => refetch() },
                  { ...drawerProps, title: `Edit Workflow: ${title}` }
                );
              }}
            />
          </Tooltip>
          <Tooltip title="Workflow">
            <Button
              type="text"
              size="small"
              icon={<ApartmentOutlined />}
              onClick={() => {
                invoke.workflowVisCard.drawer(
                  { workflow_id: record.id },
                  { ...drawerProps, title: `Workflow: ${title}` }
                );
              }}
            />
          </Tooltip>
          <Tooltip title="README">
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => {
                invoke.workflowReadme.drawer(
                  { workflow_id: record.id },
                  { ...drawerProps, title: `README: ${title}` }
                );
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this workflow?"
            description="This workflow cannot be deleted if there are associated analysis records."
            onConfirm={async () => {
              await http.post(`/workflow/delete/${encodeURIComponent(String(record.id))}`);
              message.success("Workflow deleted successfully");
              refetch();
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      );
    },
  };

  return (
    <SiderPanelLayout
      title="Workflows"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search workflows"
            className="project-report-panel-search"
          />
          <Tooltip title="Install Workflow">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={async () => {
                await invoke.installComponentsV2.openAsync(
                  {
                    storeType: "workflow",
                  },
                  {
                    width: "80%",
                    title: `Install Workflow`,
                    footer: null,
                  }
                );
              }}
            />
          </Tooltip>
          <Tooltip title="Create Workflow">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                invoke.createOrUpdateWorkflow.open(
                  { callback: () => refetch() },
                  { title: "Create Workflow", width: "60%", footer: null }
                );
              }}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          />
        </>
      }
    >
      {data.length === 0 && !isLoading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No workflow"
        />
      ) : (
        <Table<WorkflowItem>
          rowKey="id"
          size="small"
          columns={[...columns, actionsColumn]}
          dataSource={data}
          loading={isLoading || isFetching}
          pagination={false}
          showHeader={false}
          rowClassName={(record) =>
            String(record.id) === selectedId ? "project-report-row-selected" : ""
          }
          onRow={(record) => ({
            onClick: () => handleOpen(record),
          })}
        />
      )}
      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={data.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more workflows", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default WorkflowPageList;

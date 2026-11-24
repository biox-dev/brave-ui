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
import { FC, useMemo, useState } from "react";
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
  /** 选择器模式：确认时回传选中的工作流（multiple 为 true 时回传数组）。 */
  onOk?: (workflow: WorkflowItem | WorkflowItem[]) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 多选模式（仅在选择器模式下生效）。 */
  multiple?: boolean;
}

const WorkflowPageList: FC<WorkflowPageListProps> = ({
  collapsed = false,
  onToggleCollapse,
  onOk,
  onCancel,
  close,
  multiple = false,
}) => {
  const message = useGlobalMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const { locale } = useI18n();

  // Derive the selected workflow id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/tools\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, WorkflowItem>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string | number) => picked.has(String(id));
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: WorkflowItem) => {
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

  // 选择列（checkbox / radio）的回调：onChange 只包含当前页的选中项，
  // 因此多选时要把本页被取消勾选的条目从 prev 里移除、再合入本页勾选项，
  // 这样才能保留跨分页的选择。
  const handleSelectRows = (ids: string[], rows: WorkflowItem[]) => {
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
    (onOk as (value: WorkflowItem | WorkflowItem[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

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
                    handleSelectRows(keys.map(String), rows as WorkflowItem[]),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: (event) => {
              // 勾选交给选择列，避免点 checkbox 时又触发一次行点击切换。
              if (
                (event.target as HTMLElement | null)
                  ?.closest?.(".ant-table-selection-column")
              ) {
                return;
              }
              selectable ? handleSelect(record) : handleOpen(record);
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
        labels={{ loading: "Loading more…", noMore: "No more workflows", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default WorkflowPageList;

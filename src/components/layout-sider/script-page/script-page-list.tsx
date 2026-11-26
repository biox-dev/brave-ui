import type { ScriptItem, ScriptPageQuery } from "@/api/workflow";
import { pageScriptApi } from "@/api/workflow";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import {
  SCRIPT_TAB_KEY_PREFIX,
  useActiveWorkspaceResourceId,
  useWorkspaceOpener,
  type WorkspaceOpenTarget,
} from "@/layout/workspace-navigation";
import { formatRelativeTime } from "@/utils/time";
import { CodeOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import AskAgentButton from "../common/ask-agent-button";
import SiderPanelLayout from "../common/sider-panel-layout";

// const splitTags = (tags?: string) =>
//   (tags ?? "")
//     .split(/[,;|\s]+/)
//     .map((tag) => tag.trim())
//     .filter(Boolean);

/** 脚本的人类可读名称：优先 name，其次 component_id，最后回退到 id。 */
const scriptDisplayName = (script: ScriptItem) =>
  script.name || script.component_id || `Script-${script.id}`;

/**
 * 脚本的「打开方式」统一描述：
 * - Agent 会话页：在右侧 MainTabs 用 scriptPanelDetail 视图打开标签；
 * - 其它页面：路由跳转到 /c/scripts/:script_id。
 */
const buildScriptTarget = (script: ScriptItem): WorkspaceOpenTarget => ({
  view: "scriptPanelDetail",
  title: scriptDisplayName(script),
  tabKeyPrefix: SCRIPT_TAB_KEY_PREFIX,
  resourceId: String(script.id),
  // 标签视图没有 /c/scripts 路由，component_type 需显式传入；script_id 用 DB 主键。
  params: { component_type: "script", script_id: String(script.id) },
  routePath: `/c/scripts/${encodeURIComponent(script.id)}`,
});

const ScriptDetailCard = ({ item, locale }: { item: ScriptItem; locale: string }) => {
  // const tags = splitTags(item.tags);

  return (
    <div style={{ width: 380 }}>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: "name", label: "Script Name", children: item.name || item.component_id || "-" },
          { key: "id", label: "Script ID", children: item.id || "-" },
          { key: "component_id", label: "Component ID", children: item.component_id || "-" },
          { key: "script_type", label: "Script Type", children: item.script_type || "-" },
          { key: "category", label: "Category", children: item.category || "-" },
          { key: "install_key", label: "Install Key", children: item.install_key || "-" },
          { key: "container_template_id", label: "Container Template", children: item.container_template_id || "-" },
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

export interface ScriptPageListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
  /** 选择器模式：确认时回传选中的脚本（multiple 为 true 时回传数组）。 */
  onOk?: (script: ScriptItem | ScriptItem[]) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 多选模式（仅在选择器模式下生效）。 */
  multiple?: boolean;
}

const ScriptPageList: FC<ScriptPageListProps> = ({
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

  // Derive the selected script id from the current route so the selection
  // survives a full page refresh.
  const routeSelectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/scripts\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  // 当前是否在 Agent 会话页：是则行点击在右侧 MainTabs 打开标签，否则路由跳转。
  const openTarget = useWorkspaceOpener();
  // 会话页右侧正在显示的脚本也算选中（行高亮与右侧标签保持一致）。
  const workspaceSelectedId = useActiveWorkspaceResourceId(SCRIPT_TAB_KEY_PREFIX);

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式沿用路由选中态。
  const selectable = Boolean(onOk || onCancel);
  // 本地选中结果用 Map 按点击顺序保存：既能跨分页保留选择，又能保持添加顺序。
  const [picked, setPicked] = useState<Map<string, ScriptItem>>(new Map());
  const pickedItems = useMemo(() => Array.from(picked.values()), [picked]);
  const isPicked = (id: string | number) => picked.has(String(id));
  const selectedId = selectable ? pickedItems[0]?.id : routeSelectedId ?? workspaceSelectedId;

  // handleSelect 在多选模式下切换选中状态，单选模式下直接替换选中项。
  const handleSelect = (record: ScriptItem) => {
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
  } = useLazyList<ScriptItem, ScriptPageQuery>({
    fetcher: (payload) => {
      const { page, page_size, keyword: kw, ...rest } = payload;
      return pageScriptApi({
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
  const handleSelectRows = (ids: string[], rows: ScriptItem[]) => {
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
    (onOk as (value: ScriptItem | ScriptItem[]) => void)(payload);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  /** 打开脚本详情：会话页开右侧标签，其它页面路由跳转。 */
  const handleOpen = useCallback(
    (script: ScriptItem) => {
      if (!script?.id) {
        return;
      }
      openTarget(buildScriptTarget(script));
    },
    [openTarget]
  );

  /** Actions 里的「眼睛」始终路由跳转（与行点击的区别：不依赖当前页面）。 */
  const openScriptRoute = useCallback(
    (script: ScriptItem) => {
      navigate(buildScriptTarget(script).routePath);
    },
    [navigate]
  );

  const columns = useMemo<ColumnsType<ScriptItem>>(
    () => [
      {
        title: "Script Name",
        dataIndex: "name",
        key: "name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = scriptDisplayName(record);
          const meta = [
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
            record.script_type,
            // record.category,
            // record.tags
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <CodeOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CodeOutlined />
                      {title}
                    </span>
                  }
                  content={<ScriptDetailCard item={record} locale={locale} />}
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
      //   title: "Script Type",
      //   dataIndex: "script_type",
      //   key: "script_type",
      //   width: 110,
      //   render: (value: string) =>
      //     value ? <Tag color="blue">{value}</Tag> : "-",
      // },
    ],
    [locale]
  );

  const actionsColumn: ColumnsType<ScriptItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 120,
    align: "right",
    render: (_: unknown, record) => {
      return (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 把脚本作为 @script:<id> 引用插进 Agent 输入框（Agent 侧用 get_script 解析）。 */}
          <AskAgentButton
            kind="script"
            id={record.id}
            label={scriptDisplayName(record)}
          />
          {/* 详情（编辑 / 代码 / README / 发布）全部在详情页里，列表只保留查看与删除。 */}
          <Tooltip title="Open script">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openScriptRoute(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this script?"
            description="Cannot delete if analysis nodes exist or this script is referenced in a workflow."
            onConfirm={async () => {
              await http.post(`/script/delete/${encodeURIComponent(record.id)}`);
              message.success("Script deleted successfully");
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
      title="Scripts"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search scripts"
            className="project-report-panel-search"
          />
          <Tooltip title="Install Script">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={async () => {
                await invoke.installComponentsV2.openAsync(
                  {
                    storeType: "script",
                  },
                  {
                    width: "80%",
                    title: `Install script`,
                    footer: null,
                  }
                );
                refetch();
              }}
            />
          </Tooltip>
          <Tooltip title="Create Script">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                invoke.createOrUpdateScript.open(
                  { callback: () => refetch() },
                  { footer: null, width: "60%", title: `Create Script` }
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
          description="No script"
        />
      ) : (
        <Table<ScriptItem>
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
                    handleSelectRows(keys.map(String), rows as ScriptItem[]),
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
        labels={{ loading: "Loading more…", noMore: "No more scripts", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default ScriptPageList;

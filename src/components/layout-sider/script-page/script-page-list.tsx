import type { ScriptItem, ScriptPageQuery } from "@/api/workflow";
import { pageScriptApi } from "@/api/workflow";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { useOpenMainTab } from "@/hooks/useMainTabTitle";
import { formatRelativeTime } from "@/utils/time";
import { CodeOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Popconfirm, Popover, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import SiderPanelLayout from "../common/sider-panel-layout";

// const splitTags = (tags?: string) =>
//   (tags ?? "")
//     .split(/[,;|\s]+/)
//     .map((tag) => tag.trim())
//     .filter(Boolean);

/** 脚本的人类可读名称：优先 name，其次 component_id，最后回退到 id。 */
const scriptDisplayName = (script: ScriptItem) =>
  script.name || script.component_id || `Script-${script.id}`;

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
}

const ScriptPageList: FC<ScriptPageListProps> = ({ collapsed = false, onToggleCollapse }) => {
  const message = useGlobalMessage();
  const location = useLocation();
  const { locale } = useI18n();
  // 跳转 + 登记标签页名称一步完成；名称最终以详情页登记的真实数据为准。
  const openMainTab = useOpenMainTab();

  // Derive the selected script id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/scripts\/([^/]+)/);
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

  /**
   * 打开脚本详情标签页。
   * 统一通过 MainTabs 的标题通道登记脚本名：标签页直接显示脚本名称，
   * 而不是静态规则生成的「脚本 · <id>」。
   */
  const handleOpen = (script: ScriptItem) => {
    if (!script?.id) {
      return;
    }
    openMainTab(`/c/scripts/${encodeURIComponent(script.id)}`, scriptDisplayName(script));
  };

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
    width: 130,
    align: "right",
    render: (_: unknown, record) => {
      const title = scriptDisplayName(record);
      // Every action opens the same views the script-panel tabs use, but as a
      // drawer via `invoke` — edit/create, main file code, and README.md.
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
                invoke.createOrUpdateScript.drawer(
                  { script_id: record.id, callback: () => refetch() },
                  { ...drawerProps, title: `Edit Script: ${title}` }
                );
              }}
            />
          </Tooltip>
          <Tooltip title="Code">
            <Button
              type="text"
              size="small"
              icon={<CodeOutlined />}
              onClick={() => {
                invoke.scriptCode.drawer(
                  { script_id: record.id },
                  { ...drawerProps, title: `Code: ${title}` }
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
                invoke.scriptReadme.drawer(
                  { script_id: record.id },
                  { ...drawerProps, title: `README: ${title}` }
                );
              }}
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
        labels={{ loading: "Loading more…", noMore: "No more scripts", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default ScriptPageList;

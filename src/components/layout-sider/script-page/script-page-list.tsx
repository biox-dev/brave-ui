import { useScriptPageQuery } from "@/hooks/usePaginationV2";
import type { ScriptItem } from "@/api/workflow";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { useOpenMainTab } from "@/hooks/useMainTabTitle";
import { formatRelativeTime } from "@/utils/time";
import { CaretDownOutlined, CaretRightOutlined, CodeOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";

// const splitTags = (tags?: string) =>
//   (tags ?? "")
//     .split(/[,;|\s]+/)
//     .map((tag) => tag.trim())
//     .filter(Boolean);

/** 脚本的人类可读名称：优先 name，其次 component_id，最后回退到 id。 */
const scriptDisplayName = (script: ScriptItem) =>
  script.name || script.component_id || `Script-${script.id}`;

const ScriptDetailCard = ({ item }: { item: ScriptItem }) => {
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
            children: item.created_at ? new Date(item.created_at).toLocaleString() : "-",
          },
          {
            key: "updated_at",
            label: "Updated At",
            children: item.updated_at ? new Date(item.updated_at).toLocaleString() : "-",
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
  } = useScriptPageQuery(
    {},
    {
      initialPageSize: 20,
      scopeKey: projectId,
    }
  );

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
            ,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <CodeOutlined className="project-report-item-icon" />
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
              <CodeOutlined />
              {scriptDisplayName(record)}
            </span>
          }
          content={<ScriptDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

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
    <div className={`project-report-panel${collapsed ? " is-collapsed" : ""}`}>
      <div className="project-report-panel-header">
        {onToggleCollapse ? (
          <button
            type="button"
            className="project-report-panel-title project-report-panel-title-button"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <CaretRightOutlined className="project-report-panel-chevron" />
            ) : (
              <CaretDownOutlined className="project-report-panel-chevron" />
            )}
            <span>Scripts</span>
          </button>
        ) : (
          <span className="project-report-panel-title">Scripts</span>
        )}
        <div className="project-report-panel-actions">
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
        </div>
      </div>

      <div className="project-report-panel-body" style={collapsed ? { display: "none" } : undefined}>
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
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              String(record.id) === selectedId ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => handleOpen(record),
            })}
          />
        )}
      </div>

      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--sharp-divider)",
          ...(collapsed ? { display: "none" } : null),
        }}
      >
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `${t} scripts`}
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

export default ScriptPageList;

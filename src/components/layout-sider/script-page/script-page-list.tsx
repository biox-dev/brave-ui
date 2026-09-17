import { useScriptPageQuery } from "@/hooks/usePaginationV2";
import type { ScriptItem } from "@/api/workflow";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { CodeOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";

// const splitTags = (tags?: string) =>
//   (tags ?? "")
//     .split(/[,;|\s]+/)
//     .map((tag) => tag.trim())
//     .filter(Boolean);

const ScriptDetailCard = ({ item }: { item: ScriptItem }) => {
  // const tags = splitTags(item.tags);

  return (
    <div style={{ width: 380 }}>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: "component_name", label: "Script Name", children: item.component_name || item.component_id || "-" },
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

const ScriptPageList: FC<any> = () => {
  const message = useGlobalMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useI18n();

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

  const handleOpen = (script: ScriptItem) => {
    if (!script?.id) {
      return;
    }
    navigate(`/c/scripts/${encodeURIComponent(script.id)}`);
  };

  const columns = useMemo<ColumnsType<ScriptItem>>(
    () => [
      {
        title: "Script Name",
        dataIndex: "component_name",
        key: "component_name",
        ellipsis: { showTitle: false },
        render: (name: string, record) => {
          const title = name || record.component_id || `Script-${record.id}`;
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
              {record.component_name || record.component_id || `Script-${record.id}`}
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
    width: 80,
    align: "right",
    render: (_: unknown, record) => (
      <span
        className="project-report-item-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="Edit">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={async () => {
              try {
                await invoke.createOrUpdateScript.openDrawerAsync(
                  { data: record },
                  {
                    width: 960,
                    title: `Edit Script: ${record.component_name || record.component_id}`,
                  }
                );
                refetch();
              } catch {
                // user cancelled
              }
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
    ),
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Scripts</span>
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

      <div className="project-report-panel-body">
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

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
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

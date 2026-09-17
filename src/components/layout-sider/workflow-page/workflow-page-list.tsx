import { useWorkflowPageQuery } from "@/hooks/usePaginationV2";
import type { WorkflowItem } from "@/api/workflow";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { ApartmentOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Descriptions, Empty, Pagination, Popconfirm, Popover, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

const splitTags = (tags?: string) =>
  (tags ?? "")
    .split(/[,;|\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const WorkflowDetailCard = ({ item }: { item: WorkflowItem }) => {
  const tags = splitTags(item.tags);

  return (
    <div style={{ width: 380 }}>
      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: "name", label: "Workflow Name", children: item.name || item.relation_id || "-" },
          { key: "id", label: "ID", children: item.id ?? "-" },
          { key: "relation_id", label: "Relation ID", children: item.relation_id || "-" },
          { key: "relation_type", label: "Relation Type", children: item.relation_type || "-" },
          { key: "component_id", label: "Component ID", children: item.component_id || "-" },
          { key: "container_id", label: "Container ID", children: item.container_id || "-" },
          { key: "category", label: "Category", children: item.category || "-" },
          { key: "install_key", label: "Install Key", children: item.install_key || "-" },
          { key: "version", label: "Version", children: item.version || "-" },
          { key: "order_index", label: "Order Index", children: item.order_index ?? "-" },
          {
            key: "tags",
            label: "Tags",
            children: tags.length > 0 ? (
              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                {tags.map((tag) => (
                  <Tag key={tag} color="blue" style={{ marginInlineEnd: 0 }}>
                    {tag}
                  </Tag>
                ))}
              </span>
            ) : (
              "-"
            ),
          },
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

const WorkflowPageList: FC<any> = () => {
  const message = useGlobalMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useI18n();

  // Derive the selected workflow id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/tools\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

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
  } = useWorkflowPageQuery(
    {},
    {
      initialPageSize: 20,
    }
  );

  const handleOpen = (workflow: WorkflowItem) => {
    if (!workflow?.relation_id) {
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
          const title = name || record.relation_id || `Workflow-${record.id}`;
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
              <ApartmentOutlined />
              {record.name || record.relation_id || `Workflow-${record.id}`}
            </span>
          }
          content={<WorkflowDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  const actionsColumn: ColumnsType<WorkflowItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 100,
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
                await invoke.createOrUpdateWorkflow.openDrawerAsync(
                  { data: record },
                  {
                    width: 960,
                    title: `Edit Workflow: ${record.name || record.relation_id}`,
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
    ),
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Workflows</span>
        <div className="project-report-panel-actions">
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
        </div>
      </div>

      <div className="project-report-panel-body">
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
          showTotal={(t) => `${t} workflows`}
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

export default WorkflowPageList;

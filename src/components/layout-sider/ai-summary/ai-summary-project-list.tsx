import {
  deleteAISummaryApi,
  getAISummaryApi,
  regenerateAISummaryApi,
  type AISummaryListItem,
  type AISummaryStatus,
} from "@/api/ai-summary";
import { invoke } from "@/core/ui-system/invokeV2";
import { useAISummaryPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  RedoOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Empty,
  Pagination,
  Popconfirm,
  Popover,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";

const STATUS_COLOR_MAP: Record<AISummaryStatus, string> = {
  pending: "default",
  generating: "processing",
  success: "success",
  failed: "error",
};

const summaryTitle = (item: AISummaryListItem) =>
  item.title || `Summary-${item.id}`;

const ownerLabel = (item: AISummaryListItem) => {
  if (item.owner_type === "analysis_node") return "Node";
  if (item.owner_type === "analysis") return "Analysis";
  return item.owner_type || "Unknown";
};

const taskIdOf = (item: AISummaryListItem) =>
  item.task_id && item.task_id !== "0" ? item.task_id : undefined;

/** 行悬停时展示的摘要概览：列表不返回 content，正文在详情页渲染。 */
const AISummaryDetailCard = ({ item }: { item: AISummaryListItem }) => {
  const taskId = taskIdOf(item);

  return (
    <Descriptions
      size="small"
      column={1}
      bordered
      style={{ width: 340 }}
      items={[
        { key: "title", label: "Title", children: summaryTitle(item) },
        { key: "id", label: "Summary ID", children: item.id || "-" },
        {
          key: "owner",
          label: "Owner",
          children: `${ownerLabel(item)} #${item.owner_id}`,
        },
        {
          key: "status",
          label: "Status",
          children: (
            <Tag color={STATUS_COLOR_MAP[item.status] ?? "default"}>
              {item.status}
            </Tag>
          ),
        },
        {
          key: "profile",
          label: "Agent Profile",
          children: item.profile || "builtin summary",
        },
        { key: "task_id", label: "Task ID", children: taskId || "-" },
        { key: "created_at", label: "Created At", children: item.created_at || "-" },
        { key: "updated_at", label: "Updated At", children: item.updated_at || "-" },
      ]}
    />
  );
};

/**
 * 左侧活动栏「AI 摘要」面板：
 * - 通过分页接口（/ai-summary/list-by-project-page）拉取当前激活项目的摘要，列表不返回 content；
 * - 项目切换时自动回到第 1 页并重新请求；
 * - 点击 item 跳转详情页（/c/ai-summaries/:summary_id），正文在详情页渲染；
 * - 行内支持 Update / Regenerate / Delete，悬停显示摘要概览。
 */
const AISummaryProjectList: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useI18n();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  // 从当前路由解析已选中的摘要 ID，刷新后仍能保持选中态。
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/ai-summaries\/([^/]+)/);
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
  } = useAISummaryPageQuery({}, { initialPageSize: 10, scopeKey: projectId });

  const handleOpen = (item: AISummaryListItem) => {
    navigate(`/c/ai-summaries/${encodeURIComponent(item.id)}`);
  };

  const handleUpdate = async (item: AISummaryListItem) => {
    try {
      // 列表不返回 content，更新前先取详情，保证弹窗回填完整。
      const detail = (await getAISummaryApi(item.id)).data;
      await invoke.aiSummaryUpdate.openAsync(
        {
          id: detail.id,
          title: detail.title,
          content: detail.content,
          profile: detail.profile,
        },
        { title: "Update AI Summary", width: 520, footer: null }
      );
      await refetch();
    } catch {
      // 用户取消或提交失败，无需额外处理。
    }
  };

  const handleRegenerate = async (item: AISummaryListItem) => {
    await regenerateAISummaryApi(item.id);
    message.success("AI summary regenerated");
    await refetch();
  };

  const handleDelete = async (item: AISummaryListItem) => {
    await deleteAISummaryApi(item.id);
    message.success("AI summary deleted");
    await refetch();
  };

  const columns = useMemo<ColumnsType<AISummaryListItem>>(
    () => [
      {
        title: "Summary",
        dataIndex: "title",
        key: "title",
        ellipsis: { showTitle: false },
        render: (title: string, record) => {
          const text = title || summaryTitle(record);
          const meta = [
            record.updated_at
              ? formatRelativeTime(record.updated_at, locale)
              : undefined,
            `${ownerLabel(record)} #${record.owner_id}`,
            record.profile,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <RobotOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip placement="topLeft" title={text}>
                  <span className="project-report-item-title">{text}</span>
                </Tooltip>
                {meta && (
                  <span className="project-report-item-meta" title={meta}>
                    {meta}
                  </span>
                )}
              </div>
              <Tag
                color={STATUS_COLOR_MAP[record.status] ?? "default"}
                style={{ marginInlineEnd: 0 }}
              >
                {record.status}
              </Tag>
            </div>
          );
        },
      },
    ],
    [locale]
  );

  const actionsColumn: ColumnsType<AISummaryListItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 110,
    align: "right",
    render: (_: unknown, record) => {
      const taskId = taskIdOf(record);

      return (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {taskId && (
            <Tooltip title="Task">
              <Button
                type="text"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() =>
                  invoke.aiSummaryTask.open(
                    { taskId },
                    { width: 720, title: "AI Summary Task", footer: null }
                  )
                }
              />
            </Tooltip>
          )}
          <Tooltip title="Update">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleUpdate(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Regenerate this summary?"
            onConfirm={() => handleRegenerate(record)}
          >
            <Tooltip title="Regenerate">
              <Button type="text" size="small" icon={<RedoOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Popconfirm
            title="Delete this summary?"
            onConfirm={() => handleDelete(record)}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </span>
      );
    },
  };

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
              <RobotOutlined />
              {summaryTitle(record)}
            </span>
          }
          content={<AISummaryDetailCard item={record} />}
        >
          {rowElement}
        </Popover>
      );
    };

    return Row;
  }, [data]);

  const emptyText = projectId
    ? locale === "en_US"
      ? "No AI summary for active project"
      : "当前项目暂无 AI 摘要"
    : locale === "en_US"
      ? "Please select a project first"
      : "请先选择一个项目";

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">
          {locale === "en_US" ? "AI Summary" : "AI 摘要"}
        </span>
        <div className="project-report-panel-actions">
          <Tooltip title={locale === "en_US" ? "Refresh" : "刷新"}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isLoading || isFetching}
              onClick={() => refetch()}
            />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        ) : (
          <Table<AISummaryListItem>
            rowKey="id"
            size="small"
            columns={[...columns, actionsColumn]}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            components={{ body: { row: bodyRow } }}
            rowClassName={(record) =>
              String(record.id) === selectedId
                ? "project-report-row-selected"
                : ""
            }
            onRow={(record) => ({
              onClick: () => handleOpen(record),
            })}
          />
        )}
      </div>

      <div
        style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}
      >
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `${t} summaries`}
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

export default AISummaryProjectList;

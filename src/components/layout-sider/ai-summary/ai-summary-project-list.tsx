import {
  Button,
  Collapse,
  Empty,
  Flex,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  RedoOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { FC, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { useSelector } from "react-redux";
import { http } from "@/api/client/http";
import Markdown from "@/components/markdown";
import {
  type AISummaryItem,
  type AISummaryStatus,
} from "@/components/ai-summary/ai-summary-panel";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";

const STATUS_COLOR_MAP: Record<AISummaryStatus, string> = {
  pending: "default",
  generating: "processing",
  success: "success",
  failed: "error",
};

const formatTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ownerLabel = (item: AISummaryItem) => {
  if (item.owner_type === "analysis_node") return "Node";
  if (item.owner_type === "analysis") return "Analysis";
  return item.owner_type || "Unknown";
};

/**
 * 左侧活动栏「AI 摘要」面板：
 * - 通过 ListAISummaryByActiveProject（后端解析当前用户激活项目）拉取该项目下全部摘要；
 * - 项目切换时自动重新请求；
 * - 每个 item 支持 View Task / Update / Regenerate / Delete，content 用 Markdown 渲染。
 */
const AISummaryProjectList: FC<any> = () => {
  const { locale } = useI18n();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  const {
    data: items = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AISummaryItem[]>(
    ["ai-summary-project-list", projectId],
    async () => {
      const res = await http.get<AISummaryItem[]>("/ai-summary/list-by-project");
      return res.data ?? [];
    },
    { enabled: !!projectId, staleTime: 30_000 }
  );

  const itemKeys = useMemo(() => items.map((item) => item.id), [items]);

  const expandAll = () => setActiveKeys(itemKeys);
  const collapseAll = () => setActiveKeys([]);

  const handleRegenerate = async (id: string) => {
    try {
      await http.post("/ai-summary/regenerate", { id: String(id) });
      message.success("AI summary regenerated");
      await refetch();
    } catch {
      // 错误提示已由 http 响应拦截器统一处理。
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await http.post("/ai-summary/delete", { id: String(id) });
      message.success("AI summary deleted");
      await refetch();
    } catch {
      // ignore
    }
  };

  const handleUpdate = async (item: AISummaryItem) => {
    try {
      await invoke.aiSummaryUpdate.openAsync(
        {
          id: item.id,
          title: item.title,
          content: item.content,
          profile: item.profile,
        },
        { title: "Update AI Summary", width: 520, footer: null }
      );
      await refetch();
    } catch {
      // 用户取消或提交失败，无需额外处理。
    }
  };

  return (
    <div className="ai-summary-project-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">
          {locale === "en_US" ? "AI Summary" : "AI 摘要"}
        </span>
        <div className="project-report-panel-actions">
          <Tooltip title={locale === "en_US" ? "Expand all" : "全部展开"}>
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              disabled={itemKeys.length === 0}
              onClick={expandAll}
            />
          </Tooltip>
          <Tooltip title={locale === "en_US" ? "Collapse all" : "全部折叠"}>
            <Button
              type="text"
              size="small"
              disabled={itemKeys.length === 0}
              onClick={collapseAll}
            >
              <Typography.Text style={{ fontSize: 12 }}>–</Typography.Text>
            </Button>
          </Tooltip>
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
        <Spin spinning={isLoading && items.length === 0}>
          {items.length === 0 && !isLoading ? (
            <div style={{ padding: "16px 12px" }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  projectId
                    ? locale === "en_US"
                      ? "No AI summary for active project"
                      : "当前项目暂无 AI 摘要"
                    : locale === "en_US"
                      ? "Please select a project first"
                      : "请先选择一个项目"
                }
              />
            </div>
          ) : (
            <Collapse
              ghost
              activeKey={activeKeys}
              onChange={(keys) =>
                setActiveKeys(Array.isArray(keys) ? keys : [keys])
              }
              items={items.map((item) => {
                const generating =
                  item.status === "pending" || item.status === "generating";

                return {
                  key: item.id,
                  label: (
                    <Flex vertical gap={2} style={{ minWidth: 0 }}>
                      <Space size={6} wrap>
                        <Typography.Text strong style={{ fontSize: 13 }}>
                          {item.title || `Untitled-${item.id}`}
                        </Typography.Text>
                        <Tag color={STATUS_COLOR_MAP[item.status] ?? "default"}>
                          {item.status}
                        </Tag>
                      </Space>
                      <Space size={6} wrap>
                        <Tag color="blue">
                          {`${ownerLabel(item)} #${item.owner_id}`}
                        </Tag>
                        {item.profile && (
                          <Tooltip title="Agent Profile">
                            <Tag color="geekblue" icon={<RobotOutlined />}>
                              {item.profile}
                            </Tag>
                          </Tooltip>
                        )}
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 11 }}
                        >
                          {formatTime(item.updated_at)}
                        </Typography.Text>
                      </Space>
                    </Flex>
                  ),
                  extra: (
                    <Space
                      size={2}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.task_id && item.task_id !== "0" && (
                        <Tooltip title="Task">
                          <Button
                            size="small"
                            type="text"
                            icon={<HistoryOutlined />}
                            aria-label="Task"
                            onClick={() =>
                              invoke.aiSummaryTask.open(
                                { taskId: item.task_id },
                                {
                                  width: 720,
                                  title: "AI Summary Task",
                                  footer: null,
                                }
                              )
                            }
                          />
                        </Tooltip>
                      )}
                      <Tooltip title="Update">
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          aria-label="Update"
                          onClick={() => handleUpdate(item)}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Regenerate this summary?"
                        onConfirm={() => handleRegenerate(item.id)}
                      >
                        <Tooltip title="Regenerate">
                          <Button
                            size="small"
                            type="text"
                            icon={<RedoOutlined />}
                            aria-label="Regenerate"
                          />
                        </Tooltip>
                      </Popconfirm>
                      <Popconfirm
                        title="Delete this summary?"
                        onConfirm={() => handleDelete(item.id)}
                      >
                        <Tooltip title="Delete">
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label="Delete"
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  ),
                  children: generating ? (
                    <Typography.Text type="secondary">
                      Summary is being generated…
                    </Typography.Text>
                  ) : item.content ? (
                    <Markdown data={item.content} prefix={item.prefix || ""} />
                  ) : (
                    <Typography.Text type="secondary">
                      No content
                    </Typography.Text>
                  ),
                };
              })}
            />
          )}
        </Spin>
      </div>
    </div>
  );
};

export default AISummaryProjectList;

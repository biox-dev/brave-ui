import {
  deleteAISummaryApi,
  getAISummaryApi,
  regenerateAISummaryApi,
  type AISummaryItem,
  type AISummaryStatus,
} from "@/api/ai-summary";
import Markdown from "@/components/markdown";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
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
  Card,
  Empty,
  Popconfirm,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { FC, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import "./ai-summary-detail.css";

const STATUS_COLOR_MAP: Record<AISummaryStatus, string> = {
  pending: "default",
  generating: "processing",
  success: "success",
  failed: "error",
};

const ownerLabel = (ownerType: string) => {
  if (ownerType === "analysis_node") return "Node";
  if (ownerType === "analysis") return "Analysis";
  return ownerType || "Unknown";
};

/**
 * AI 摘要详情页（路由 /c/ai-summaries/:summary_id）：
 * - 左侧列表只返回概要，进入本页后按 ID 查询详情（含 content 与 prefix）；
 * - content 以 Markdown 渲染，prefix 用于解析其中的相对图片/链接；
 * - 支持 Update / Regenerate / Delete。
 */
const AISummaryDetail: FC = () => {
  const { summary_id } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const message = useGlobalMessage();
  const zh = locale !== "en_US";

  const [summary, setSummary] = useState<AISummaryItem>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const resp = await getAISummaryApi(id);
      setSummary(resp.data);
    } catch {
      // 错误提示已由 http 响应拦截器统一处理。
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!summary_id) {
      setSummary(undefined);
      return;
    }
    load(decodeURIComponent(summary_id));
  }, [summary_id, load]);

  const reload = () => {
    if (summary?.id) {
      load(String(summary.id));
    }
  };

  const handleUpdate = async () => {
    if (!summary) return;
    try {
      await invoke.aiSummaryUpdate.openAsync(
        {
          id: summary.id,
          title: summary.title,
          content: summary.content,
          profile: summary.profile,
        },
        { title: "Update AI Summary", width: 520, footer: null }
      );
      reload();
    } catch {
      // 用户取消或提交失败，无需额外处理。
    }
  };

  const handleRegenerate = async () => {
    if (!summary) return;
    await regenerateAISummaryApi(summary.id);
    message.success(zh ? "已重新生成摘要" : "AI summary regenerated");
    reload();
  };

  const handleDelete = async () => {
    if (!summary) return;
    await deleteAISummaryApi(summary.id);
    message.success(zh ? "摘要已删除" : "AI summary deleted");
    setSummary(undefined);
    navigate("/", { replace: true });
  };

  const generating =
    summary?.status === "pending" || summary?.status === "generating";
  const taskId =
    summary?.task_id && summary.task_id !== "0" ? summary.task_id : undefined;

  return (
    <div className="ai-summary-detail">
      <Card
        size="small"
        className="ai-summary-detail-card"
        styles={{ body: { padding: 0 } }}
      >
        {summary ? (
          <>
            <header className="ai-summary-detail-header">
              <div className="ai-summary-detail-heading">
                <div className="ai-summary-detail-title-row">
                  <RobotOutlined className="ai-summary-detail-icon" />
                  <Tooltip title={summary.title}>
                    <span className="ai-summary-detail-title">
                      {summary.title || `Summary-${summary.id}`}
                    </span>
                  </Tooltip>
                  <Tag color={STATUS_COLOR_MAP[summary.status] ?? "default"}>
                    {summary.status}
                  </Tag>
                </div>
                <div className="ai-summary-detail-meta">
                  <Tag color="blue">
                    {`${ownerLabel(summary.owner_type)} #${summary.owner_id}`}
                  </Tag>
                  {summary.profile && (
                    <Tooltip title="Agent Profile">
                      <Tag color="geekblue" icon={<RobotOutlined />}>
                        {summary.profile}
                      </Tag>
                    </Tooltip>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {summary.updated_at}
                  </Typography.Text>
                </div>
              </div>

              <div className="ai-summary-detail-actions">
                {taskId && (
                  <Tooltip title="Task">
                    <Button
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
                <Tooltip title={zh ? "刷新" : "Refresh"}>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={loading}
                    onClick={reload}
                  />
                </Tooltip>
                <Tooltip title={zh ? "编辑" : "Update"}>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<EditOutlined />}
                    onClick={handleUpdate}
                  />
                </Tooltip>
                <Popconfirm
                  title={zh ? "确定重新生成该摘要？" : "Regenerate this summary?"}
                  onConfirm={handleRegenerate}
                >
                  <Tooltip title={zh ? "重新生成" : "Regenerate"}>
                    <Button size="small" icon={<RedoOutlined />} />
                  </Tooltip>
                </Popconfirm>
                <Popconfirm
                  title={zh ? "确定删除该摘要？" : "Delete this summary?"}
                  onConfirm={handleDelete}
                >
                  <Tooltip title={zh ? "删除" : "Delete"}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </div>
            </header>

            <div className="ai-summary-detail-body">
              {generating ? (
                <Typography.Text type="secondary">
                  {zh ? "摘要生成中……" : "Summary is being generated…"}
                </Typography.Text>
              ) : summary.content ? (
                <Markdown data={summary.content} prefix={summary.prefix || ""} />
              ) : (
                <Typography.Text type="secondary">
                  {zh ? "暂无内容" : "No content"}
                </Typography.Text>
              )}
            </div>
          </>
        ) : (
          <div className="ai-summary-detail-placeholder">
            {loading ? (
              <Skeleton active />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  zh ? "请在左侧选择一个 AI 摘要" : "Select an AI summary from the left"
                }
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AISummaryDetail;

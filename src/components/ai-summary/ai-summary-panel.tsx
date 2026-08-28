import {
  Button,
  Card,
  Empty,
  Flex,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  RedoOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { FC, useCallback, useEffect, useState } from "react";
import { http } from "@/api/client/http";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import Markdown from "@/components/markdown";

/** AI 摘要生成状态。 */
export type AISummaryStatus = "pending" | "generating" | "success" | "failed";

/** AI 摘要所属对象类型。 */
export type AISummaryOwnerType = "analysis" | "analysis_node";

/** 后端 types.AISummary 对应的前端模型。 */
export interface AISummaryItem {
  id: string;
  owner_id: string;
  owner_type: string;
  content: string;
  status: AISummaryStatus;
  created_at: string;
  updated_at: string;
}

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

export interface AISummaryPanelProps {
  /** 摘要所属对象类型：analysis 或 analysis_node。 */
  ownerType: AISummaryOwnerType;
  /** 摘要所属对象 ID（Analysis.ID 或 AnalysisNode.ID）。 */
  ownerId?: string | number;
  /** 变化时重新拉取列表，用于外部创建/重新生成后刷新。 */
  refreshKey?: number;
  /** 摘要中相对图片/链接的前缀。 */
  prefix?: string;
}

/**
 * 独立的 AI 摘要列表组件：
 * - 通过 ListAISummary 按 OwnerType/OwnerID 拉取摘要列表；
 * - 每个 item 支持 Regenerate / Delete；
 * - content 使用 Markdown 渲染。
 */
const AISummaryPanel: FC<AISummaryPanelProps> = ({
  ownerType,
  ownerId,
  refreshKey = 0,
  prefix = "",
}) => {
  const [items, setItems] = useState<AISummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const message = useGlobalMessage();

  const load = useCallback(async () => {
    if (ownerId === undefined || ownerId === null || ownerId === "") {
      return;
    }

    setLoading(true);
    try {
      const res = await http.get<AISummaryItem[]>("/ai-summary/list", {
        params: { owner_type: ownerType, owner_id: ownerId },
      });
      setItems(res.data ?? []);
    } catch {
      // 错误提示已由 http 响应拦截器统一处理。
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleRegenerate = async (id: string) => {
    try {
      await http.post("/ai-summary/regenerate", { id: String(id) });
      message.success("AI summary regenerated");
      await load();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await http.post("/ai-summary/delete", { id: String(id) });
      message.success("AI summary deleted");
      await load();
    } catch {
      // ignore
    }
  };

  return (
    <Card
      size="small"
      title="AI Summary"
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={load}
        >
          Refresh
        </Button>
      }
    >
      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No AI summary yet"
          />
        ) : (
          <Flex vertical gap={12}>
            {items.map((item) => {
              const generating =
                item.status === "pending" || item.status === "generating";

              return (
                <Card
                  key={item.id}
                  size="small"
                  title={
                    <Space size={8}>
                      <Typography.Text code>#{item.id}</Typography.Text>
                      <Tag color={STATUS_COLOR_MAP[item.status] ?? "default"}>
                        {item.status}
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Space size={8}>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {formatTime(item.updated_at)}
                      </Typography.Text>
                      <Popconfirm
                        title="Regenerate this summary?"
                        onConfirm={() => handleRegenerate(item.id)}
                      >
                        <Button size="small" icon={<RedoOutlined />}>
                          Regenerate
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title="Delete this summary?"
                        onConfirm={() => handleDelete(item.id)}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  }
                >
                  {generating ? (
                    <Typography.Text type="secondary">
                      Summary is being generated…
                    </Typography.Text>
                  ) : item.content ? (
                    <Markdown data={item.content} prefix={prefix} />
                  ) : (
                    <Typography.Text type="secondary">
                      No content
                    </Typography.Text>
                  )}
                </Card>
              );
            })}
          </Flex>
        )}
      </Spin>
    </Card>
  );
};

export default AISummaryPanel;

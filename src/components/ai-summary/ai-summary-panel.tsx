import {
  Button,
  Collapse,
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
  EyeOutlined,
  HistoryOutlined,
  RedoOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { FC, useCallback, useEffect, useState } from "react";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useComponentStore } from "@/event-bus/stores/components";
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
  task_id?: string;
  title: string;
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
  const [creating, setCreating] = useState(false);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const message = useGlobalMessage();
  const { register, unregister } = useComponentStore();

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

  useEffect(() => {
    if (ownerId === undefined || ownerId === null || ownerId === "") {
      return;
    }
    const id = String(ownerId);
    const instance = { refresh: load };
    register("ai-summary", id, instance);
    return () => {
      unregister("ai-summary", id, instance);
    };
  }, [ownerType, ownerId, load, register, unregister]);

  const handleCreate = async () => {
    if (ownerId === undefined || ownerId === null || ownerId === "") {
      return;
    }

    setCreating(true);
    try {
      await http.post("/ai-summary/create", {
        owner_id: String(ownerId),
        owner_type: ownerType,
      });
      message.success("AI summary created");
      await load();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

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

  const handleViewInput = () => {
    invoke.aiSummaryInput.open(
      { ownerType, ownerId },
      { title: "AI Summary Input", width: 720, footer: null }
    );
  };

  return (
    <Flex vertical gap={4}>
      <Flex justify="space-between" align="center" gap={8} wrap>
        <Space size={8}>
          <Typography.Text strong>AI Summary</Typography.Text>
          {!loading && items.length === 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              No AI summary yet
            </Typography.Text>
          )}
        </Space>
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<RobotOutlined />}
            loading={creating}
            disabled={ownerId === undefined || ownerId === null || ownerId === ""}
            onClick={handleCreate}
          >
            Create
          </Button>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            disabled={ownerId === undefined || ownerId === null || ownerId === ""}
            onClick={handleViewInput}
          >
            Input
          </Button>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={load}
          >
            Refresh
          </Button>
        </Space>
      </Flex>
      <Spin spinning={loading}>
        {items.length === 0 ? null : (
          <Collapse
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
                  <Flex justify="space-between" align="center" gap={8} wrap>
                    <Space size={8}>
                      {/* <Typography.Text code>#{item.id}</Typography.Text> */}
                      {item.title && (
                        <Tooltip title={item.id}>
                          <Typography.Text strong>{item.title}</Typography.Text>
                        </Tooltip>
                      )}
                      <Tag color={STATUS_COLOR_MAP[item.status] ?? "default"}>
                        {item.status}
                      </Tag>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {formatTime(item.updated_at)}
                      </Typography.Text>
                    </Space>
                    <Space size={8} onClick={(e) => e.stopPropagation()}>
                      {item.task_id && item.task_id != "0" && (
                        <Button
                          size="small"
                          icon={<HistoryOutlined />}
                          onClick={() =>
                            invoke.aiSummaryTask.open({ taskId: item.task_id }, { width: 720, title: "AI Summary Task", footer: null })
                          }
                        >
                          Task
                        </Button>
                      )}
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
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Flex>
                ),
                children: generating ? (
                  <Typography.Text type="secondary">
                    Summary is being generated…
                  </Typography.Text>
                ) : item.content ? (
                  <Markdown data={item.content} prefix={prefix} />
                ) : (
                  <Typography.Text type="secondary">No content</Typography.Text>
                ),
              };
            })}
          />
        )}
      </Spin>
    </Flex>
  );
};

export default AISummaryPanel;

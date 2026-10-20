import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
  getAgentAnalysisLogApi,
  isAgentAnalysisActive,
} from "@/api/agent-analysis";

const { Text } = Typography;

export interface AgentAnalysisLogProps {
  /** AgentAnalysis id。 */
  id: string;
  /** 任务名称，仅用于标题展示。 */
  name?: string;
  /** 日志绝对路径（AgentAnalysis.LogPath），仅用于展示。 */
  log_path?: string;
  /** 任务状态：pending / running 时默认开启自动刷新。 */
  status?: string;
  /** UIContainer 注入。 */
  close?: () => void;
}

/** 自动刷新间隔（毫秒）。 */
const POLL_INTERVAL = 3000;

/**
 * AgentAnalysis 命令日志查看器。
 *
 * 通过 `invoke.agentAnalysisLog.open(...)` 以弹窗方式打开；
 * 日志内容来自 `GET /container/agent-analysis/log?id=...`（text/plain）。
 */
const AgentAnalysisLog = ({
  id,
  name,
  log_path,
  status,
  close,
}: AgentAnalysisLogProps) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(() =>
    isAgentAnalysisActive(status),
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // silent：轮询刷新时不显示 loading 遮罩，避免日志区域闪烁。
  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) {
        setLoading(true);
      }
      try {
        const resp = await getAgentAnalysisLogApi(id);
        const text = typeof resp.data === "string" ? resp.data : "";
        setContent(text);
        setError(text.trim() ? null : "日志文件为空");
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          "读取日志失败";
        setError(message);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 任务进行中时轮询，结束后自动停止。
  useEffect(() => {
    if (!autoRefresh || !id) return;
    const timer = window.setInterval(() => load(true), POLL_INTERVAL);
    return () => window.clearInterval(timer);
  }, [autoRefresh, id, load]);

  // 内容更新后滚动到底部，方便跟随最新输出。
  useEffect(() => {
    if (!autoScroll) return;
    const element = bodyRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [content, autoScroll]);

  const hasLog = content.trim().length > 0;

  return (
    <Card
      size="small"
      title={
        <Flex gap="small" wrap="wrap" align="center">
          <Text strong>{name || id}</Text>
          <Tag color="purple">id: {id}</Tag>
          <Tag color="blue" style={{ maxWidth: 420 }}>
            <span style={{ wordBreak: "break-all" }}>{log_path || "command.log"}</span>
          </Tag>
        </Flex>
      }
      extra={
        <Space size="small" wrap>
          <Text type="secondary">Auto refresh</Text>
          <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
          <Text type="secondary">Auto scroll</Text>
          <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
          <Button
            size="small"
            type="primary"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => load()}
          >
            Refresh
          </Button>
          {close && (
            <Button size="small" onClick={close}>
              Close
            </Button>
          )}
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={loading}>
        {hasLog ? (
          <div
            ref={bodyRef}
            style={{
              height: "65vh",
              overflow: "auto",
              padding: "8px 12px",
              background: "#1e1e1e",
              borderRadius: 6,
              fontFamily:
                'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: "#d4d4d4",
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                color: "inherit",
                fontFamily: "inherit",
              }}
            >
              {content}
            </pre>
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            {error ? (
              <Alert
                type="warning"
                showIcon
                message="日志暂不可用"
                description={error}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Log is empty"
              />
            )}
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default AgentAnalysisLog;

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { getAgentProjectContextApi } from "@/api/agent";

const { Text, Paragraph } = Typography;

const AgentProjectContextPage = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAgentProjectContextApi();
      setContent(res.data?.project_context ?? "");
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card
      size="small"
      title="Agent Project Context"
      extra={
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Space direction="vertical" size="small" style={{ width: "100%" }}>
        <Text type="secondary">
          Project context injected into the agent system prompt for the current
          user&apos;s active project (e.g. completed analysis nodes).
        </Text>
        {content ? (
          <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
            {content}
          </Paragraph>
        ) : !loading ? (
          <Empty description="No project context available" />
        ) : null}
      </Space>
    </Card>
  );
};

export default AgentProjectContextPage;

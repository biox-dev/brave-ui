import { useCallback, useEffect, useState } from "react";
import { Button, Card, Flex, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { listAgentSkillApi, type AgentSkillItem } from "@/api/agent";

const { Text, Paragraph } = Typography;

const formatSchema = (schema?: Record<string, unknown> | null) => {
  if (!schema) return "-";
  try {
    return JSON.stringify(schema);
  } catch {
    return String(schema);
  }
};

const columns: ColumnsType<AgentSkillItem> = [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (value: string) => <Text strong>{value || "-"}</Text>,
  },
  {
    title: "Version",
    dataIndex: "version",
    key: "version",
    width: 110,
    render: (value?: string) =>
      value ? <Tag color="blue">{value}</Tag> : "-",
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    render: (value?: string) => value || "-",
  },
  {
    title: "Input Schema",
    dataIndex: "input_schema",
    key: "input_schema",
    width: 300,
    ellipsis: true,
    render: (value?: Record<string, unknown> | null) => formatSchema(value),
  },
];

const AgentSkillPage = () => {
  const [data, setData] = useState<AgentSkillItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAgentSkillApi();
      setData(res.data ?? []);
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
      title="Agent Skill List"
      extra={
        <Space>
          <Text type="secondary">Total: {data.length}</Text>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">
          Skills available to the agent (built-in + user-defined under the
          &quot;.skills&quot; directory).
        </Text>
      </Flex>

      <Table<AgentSkillItem>
        rowKey="name"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <Text strong>Instructions</Text>
              <Paragraph
                style={{ marginTop: 8, whiteSpace: "pre-wrap", marginBottom: 0 }}
              >
                {record.instructions || "-"}
              </Paragraph>
            </div>
          ),
          rowExpandable: (record) => Boolean(record.instructions),
        }}
      />
    </Card>
  );
};

export default AgentSkillPage;

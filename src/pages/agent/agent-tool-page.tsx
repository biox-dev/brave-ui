import { useCallback, useEffect, useState, type FC } from "react";
import {
  Button,
  Card,
  Empty,
  Flex,
  Space,
  Table,
  Tag,
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined, ReloadOutlined, ToolOutlined } from "@ant-design/icons";
import { listAgentToolApi, type AgentToolItem } from "@/api/agent";
import { invoke } from "@/core/ui-system/invokeV2";

const { Text } = Typography;

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** 取工具入参 schema 的 properties（非对象时返回空表）。 */
const schemaProperties = (schema?: Record<string, unknown>): Record<string, unknown> => {
  const properties = schema?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }
  return properties as Record<string, unknown>;
};

/** 取工具入参 schema 的 required 字段名列表。 */
const schemaRequired = (schema?: Record<string, unknown>): string[] => {
  const required = schema?.required;
  if (!Array.isArray(required)) return [];
  return required.filter((item): item is string => typeof item === "string");
};

/** 把单个参数 schema 摘要为 "type · description"，用于参数 Tag 的 tooltip。 */
const describeProperty = (property: unknown): string => {
  if (!property || typeof property !== "object") return "";
  const record = property as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  const description = typeof record.description === "string" ? record.description : "";
  return [type, description].filter(Boolean).join(" · ");
};

const createColumns = (): ColumnsType<AgentToolItem> => [
  {
    title: "Tool",
    dataIndex: "name",
    key: "name",
    width: 300,
    render: (value: string, record) => (
      <Flex vertical gap={2}>
        <Space size={6} align="center">
          <ToolOutlined style={{ color: "#1677ff" }} />
          <Text strong style={{ fontSize: 13 }}>
            {value || "-"}
          </Text>
        </Space>
        <Text
          type="secondary"
          style={{ fontSize: 12, maxWidth: 280 }}
          ellipsis={{ tooltip: record.description }}
        >
          {record.description || "No description"}
        </Text>
      </Flex>
    ),
  },
  {
    title: "Parameters",
    key: "parameters",
    render: (_: unknown, record) => {
      const properties = schemaProperties(record.input_schema);
      const required = new Set(schemaRequired(record.input_schema));
      const names = Object.keys(properties);
      if (names.length === 0) {
        return <Text type="secondary">No parameters</Text>;
      }
      // 参数可能很多：只展示前 4 个，其余折叠为 +N；必填参数用蓝色 Tag 标识。
      const shown = names.slice(0, 4);
      return (
        <Space size={[6, 6]} wrap>
          {shown.map((name) => (
            <Tooltip key={name} title={describeProperty(properties[name])}>
              <Tag color={required.has(name) ? "blue" : "default"}>
                {required.has(name) ? `${name} *` : name}
              </Tag>
            </Tooltip>
          ))}
          {names.length > shown.length && <Tag>+{names.length - shown.length}</Tag>}
        </Space>
      );
    },
  },
  {
    title: "Actions",
    key: "actions",
    width: 110,
    align: "center",
    fixed: "right",
    render: (_: unknown, record) => (
      <Button
        size="small"
        icon={<EyeOutlined />}
        title={`View tool · ${record.name}`}
        onClick={() =>
          invoke.agentToolDetailModal.open(
            { name: record.name },
            { title: `Tool · ${record.name}`, width: 720, footer: null }
          )
        }
      >
        Details
      </Button>
    ),
  },
];

/** ToolSchemaPanel 是展开行内容：只读展示完整的入参 JSON Schema。 */
const ToolSchemaPanel: FC<{ record: AgentToolItem }> = ({ record }) => {
  const { token } = antdTheme.useToken();
  const hasSchema = !!record.input_schema && Object.keys(record.input_schema).length > 0;

  return (
    <Flex vertical gap={8} style={{ padding: "4px 4px 8px" }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Input Schema (read-only)
      </Text>
      {hasSchema ? (
        <pre
          style={{
            margin: 0,
            maxHeight: "50vh",
            overflow: "auto",
            padding: "12px 16px",
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            background: token.colorBgContainer,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            lineHeight: 1.6,
            color: token.colorTextSecondary,
            fontFamily: MONO_FONT,
          }}
        >
          {JSON.stringify(record.input_schema, null, 2)}
        </pre>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No input schema" />
      )}
    </Flex>
  );
};

/**
 * AgentToolPage 是「Agent 工具」只读列表页（参考 Agent Skills 页）。
 *
 * 工具由后端进程内的 tool.Registry 提供（内置 + coder + 外部 MCP），前端只能查看
 * 名称 / 描述 / 入参 JSON Schema，不支持新增、编辑或删除。
 */
const AgentToolPage = () => {
  const [data, setData] = useState<AgentToolItem[]>([]);
  const { token } = antdTheme.useToken();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAgentToolApi();
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

  const columns = createColumns();

  return (
    <Card
      size="small"
      styles={{ body: { paddingTop: 12 } }}
      title={
        <Space size={8}>
          <Text strong style={{ fontSize: 15 }}>
            Agent Tools
          </Text>
          <Tag color="blue">{data.length} total</Tag>
        </Space>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Flex
        gap="small"
        align="center"
        wrap
        style={{
          marginBottom: 12,
          padding: "8px 12px",
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          borderInlineStart: `3px solid ${token.colorPrimaryBorder}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Tools are registered in the server tool registry (builtin, coder and
          external MCP tools). They are read-only here: expand a row to inspect
          the input JSON Schema, or open Details for a modal view. Which tools a
          profile can use is configured on the Agent Profile page.
        </Text>
      </Flex>

      <Table<AgentToolItem>
        rowKey="name"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="middle"
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No tools registered in the server tool registry"
            />
          ),
        }}
        expandable={{
          expandedRowRender: (record) => <ToolSchemaPanel record={record} />,
          rowExpandable: () => true,
        }}
      />
    </Card>
  );
};

export default AgentToolPage;

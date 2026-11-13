import { useCallback, useEffect, useState, type FC } from "react";
import {
  Button,
  Card,
  Empty,
  Flex,
  Popconfirm,
  Segmented,
  Skeleton,
  Space,
  Table,
  Tag,
  theme as antdTheme,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  deleteAgentSkillApi,
  getAgentSkillApi,
  listAgentSkillApi,
  saveAgentSkillApi,
  type AgentSkillItem,
} from "@/api/agent";
import Markdown from "@/components/markdown";
import { MonacoEditor } from "@/components/react-monaco-editor";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";

const { Text } = Typography;

const MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

interface ActionHandlers {
  onDelete: (name: string) => void;
  deletingName?: string;
}

const createColumns = ({
  onDelete,
  deletingName,
}: ActionHandlers): ColumnsType<AgentSkillItem> => [
  {
    title: "Skill",
    dataIndex: "name",
    key: "name",
    width: 260,
    render: (value: string, record) => (
      <Flex vertical gap={2}>
        <Space size={6} align="center">
          <FileTextOutlined style={{ color: "#1677ff" }} />
          <Text strong style={{ fontSize: 13 }}>
            {value || "-"}
          </Text>
        </Space>
        <Text
          type="secondary"
          style={{ fontSize: 12, maxWidth: 240 }}
          ellipsis={{ tooltip: record.description }}
        >
          {record.description || "No description"}
        </Text>
      </Flex>
    ),
  },
  {
    title: "Capabilities",
    key: "capabilities",
    width: 320,
    render: (_: unknown, record) => (
      <Space size={[6, 6]} wrap>
        <Tooltip title="Whether the user can invoke this skill explicitly">
          <Tag color={record.user_invocable ? "green" : "default"}>
            user {record.user_invocable ? "on" : "off"}
          </Tag>
        </Tooltip>
        <Tooltip title="Whether the skill is exposed to the model in the system prompt">
          <Tag color={record.disable_model_invocation ? "default" : "blue"}>
            model {record.disable_model_invocation ? "off" : "on"}
          </Tag>
        </Tooltip>
        <Tooltip title="Whether {{ var }} placeholders are rendered with runtime context">
          <Tag color={record.disable_render ? "default" : "geekblue"}>
            render {record.disable_render ? "off" : "on"}
          </Tag>
        </Tooltip>
      </Space>
    ),
  },
  {
    title: "Location",
    dataIndex: "skill_file_path",
    key: "skill_file_path",
    ellipsis: true,
    render: (value?: string) =>
      value ? (
        <Tooltip title={value}>
          <Text
            type="secondary"
            style={{ fontFamily: MONO_FONT, fontSize: 12 }}
          >
            {value}
          </Text>
        </Tooltip>
      ) : (
        <Text type="secondary">-</Text>
      ),
  },
  {
    title: "Actions",
    key: "actions",
    width: 110,
    align: "center",
    fixed: "right",
    render: (_: unknown, record) => (
      <Popconfirm
        title="Delete this skill?"
        description="The SKILL.md file will be removed from disk."
        onConfirm={() => onDelete(record.name)}
      >
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          loading={deletingName === record.name}
        >
          Delete
        </Button>
      </Popconfirm>
    ),
  },
];

type PanelMode = "preview" | "edit";

interface SkillDetailPanelProps {
  record: AgentSkillItem;
  /** 保存成功后回调，用于刷新列表。 */
  onSaved: () => void;
}

// SkillDetailPanel 在展开行时才拉取技能详情（含指令正文），
// 支持 Markdown 预览与 Monaco 编辑两种模式切换。
const SkillDetailPanel: FC<SkillDetailPanelProps> = ({ record, onSaved }) => {
  const { token } = antdTheme.useToken();
  const [mode, setMode] = useState<PanelMode>("preview");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<AgentSkillItem | null>(null);
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await getAgentSkillApi(record.name);
      const instructions = res.data?.instructions ?? "";
      setDetail(res.data ?? null);
      setSaved(instructions);
      setDraft(instructions);
    } catch {
      // API errors are shown globally by the http interceptor.
      setError("Failed to load skill instructions.");
    } finally {
      setLoading(false);
    }
  }, [record.name]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const dirty = draft !== saved;

  const handleSave = async () => {
    setSaving(true);
    const source = detail ?? record;
    try {
      await saveAgentSkillApi({
        id: source.name,
        name: source.name,
        description: source.description ?? "",
        user_invocable: source.user_invocable ?? false,
        disable_model_invocation: source.disable_model_invocation ?? false,
        disable_render: source.disable_render ?? false,
        instructions: draft,
      });
      setSaved(draft);
      setMode("preview");
      getGlobalMessage()?.success("Skill instructions saved");
      onSaved();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 6 }} />;
    }
    if (error) {
      return (
        <Flex vertical gap={8} align="flex-start">
          <Text type="danger">{error}</Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadDetail}>
            Retry
          </Button>
        </Flex>
      );
    }
    if (mode === "edit") {
      return (
        <MonacoEditor
          height="60vh"
          value={draft}
          language="markdown"
          path={`skill-instructions-${record.name}.md`}
          onChange={(value?: string) => setDraft(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      );
    }
    return (
      <div
        style={{
          height: "60vh",
          minHeight: 420,
          overflow: "auto",
          padding: "12px 16px",
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
        }}
      >
        {draft.trim() ? (
          <Markdown data={draft} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No instructions yet"
          />
        )}
      </div>
    );
  };

  return (
    <Flex vertical gap={12} style={{ padding: "4px 4px 8px" }}>
      <Flex justify="space-between" align="center" gap={8} wrap>
        <Space size={8}>
          <Segmented
            size="small"
            value={mode}
            onChange={(value) => setMode(value as PanelMode)}
            options={[
              { label: "Preview", value: "preview", icon: <EyeOutlined /> },
              { label: "Edit", value: "edit", icon: <EditOutlined /> },
            ]}
          />
          {dirty && <Tag color="orange">unsaved</Tag>}
        </Space>
        {mode === "edit" && (
          <Space size="small">
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={saving || !dirty}
              onClick={() => setDraft(saved)}
            >
              Reset
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!dirty}
              onClick={handleSave}
            >
              Save
            </Button>
          </Space>
        )}
      </Flex>
      {renderBody()}
      <Text type="secondary" style={{ fontSize: 12, fontFamily: MONO_FONT }}>
        {record.skill_file_path || record.path || record.name}
      </Text>
    </Flex>
  );
};

const AgentSkillPage = () => {
  const [data, setData] = useState<AgentSkillItem[]>([]);
  const { token } = antdTheme.useToken();
  const [loading, setLoading] = useState(false);
  const [deletingName, setDeletingName] = useState<string>();

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

  const handleCreate = async () => {
    try {
      await invoke.agentSkillEditModal.openAsync(
        { skill: null },
        {
          title: "New Skill",
          width: 720,
          footer: null,
        }
      );
      await load();
    } catch {
      // User canceled the create / edit modal.
    }
  };

  const handleDelete = async (name: string) => {
    setDeletingName(name);
    try {
      await deleteAgentSkillApi(name);
      getGlobalMessage()?.success("Skill deleted");
      load();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setDeletingName(undefined);
    }
  };

  const columns = createColumns({
    onDelete: handleDelete,
    deletingName,
  });

  return (
    <Card
      size="small"
      styles={{ body: { paddingTop: 12 } }}
      title={
        <Space size={8}>
          <Text strong style={{ fontSize: 15 }}>
            Agent Skills
          </Text>
          <Tag color="blue">{data.length} total</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            New Skill
          </Button>
        </Space>
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
          Skills are SKILL.md documents under the &quot;.skills&quot; directory.
          Expand a row to preview or edit its instructions;{" "}
          <Text code style={{ fontSize: 12 }}>
            {"{{ var }}"}
          </Text>{" "}
          placeholders are rendered with the current runtime variables. Changes
          take effect immediately while the server is running.
        </Text>
      </Flex>

      <Table<AgentSkillItem>
        rowKey="name"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="middle"
        scroll={{ x: 1000 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No skills yet, create one to get started"
            />
          ),
        }}
        expandable={{
          expandedRowRender: (record) => (
            <SkillDetailPanel record={record} onSaved={load} />
          ),
          rowExpandable: () => true,
        }}
      />
    </Card>
  );
};

export default AgentSkillPage;

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  deleteAgentSkillApi,
  listAgentSkillApi,
  type AgentSkillItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";

const { Text, Paragraph } = Typography;

interface ActionHandlers {
  onEdit: (record: AgentSkillItem) => void;
  onDelete: (name: string) => void;
  deletingName?: string;
}

const createColumns = ({
  onEdit,
  onDelete,
  deletingName,
}: ActionHandlers): ColumnsType<AgentSkillItem> => [
  {
    title: "Name",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (value: string) => <Text strong>{value || "-"}</Text>,
  },
  {
    title: "Description",
    dataIndex: "description",
    key: "description",
    ellipsis: true,
    render: (value?: string) => value || "-",
  },
  {
    title: "User Invocable",
    dataIndex: "user_invocable",
    key: "user_invocable",
    width: 130,
    align: "center",
    render: (value?: boolean) =>
      value ? <Tag color="green">yes</Tag> : <Tag>no</Tag>,
  },
  {
    title: "Model Invocation",
    dataIndex: "disable_model_invocation",
    key: "disable_model_invocation",
    width: 150,
    align: "center",
    render: (value?: boolean) =>
      value ? <Tag color="red">disabled</Tag> : <Tag color="blue">enabled</Tag>,
  },
  {
    title: "Template Render",
    dataIndex: "disable_render",
    key: "disable_render",
    width: 150,
    align: "center",
    render: (value?: boolean) =>
      value ? <Tag color="orange">disabled</Tag> : <Tag color="blue">enabled</Tag>,
  },
  {
    title: "Location",
    dataIndex: "skill_file_path",
    key: "skill_file_path",
    width: 280,
    ellipsis: true,
    render: (value?: string) =>
      value ? (
        <Tooltip title={value}>
          <Text type="secondary">{value}</Text>
        </Tooltip>
      ) : (
        "-"
      ),
  },
  {
    title: "Actions",
    key: "actions",
    width: 170,
    fixed: "right",
    render: (_: unknown, record) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>
          Edit
        </Button>
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
      </Space>
    ),
  },
];

const AgentSkillPage = () => {
  const [data, setData] = useState<AgentSkillItem[]>([]);
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

  const handleEdit = async (record: AgentSkillItem) => {
    try {
      await invoke.agentSkillEditModal.openAsync(
        { skill: record },
        {
          title: `Edit Skill · ${record.name}`,
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
    onEdit: handleEdit,
    onDelete: handleDelete,
    deletingName,
  });

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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            New Skill
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">
          Skills available to the agent, defined as SKILL.md documents under the
          &quot;.skills&quot; directory. Template rendering substitutes{" "}
          <Text code>{"{{ var }}"}</Text> in instructions and resources with the
          current runtime variables. Changes take effect immediately while the
          server is running.
        </Text>
      </Flex>

      <Table<AgentSkillItem>
        rowKey="name"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 1250 }}
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

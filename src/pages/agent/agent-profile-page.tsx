import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  deleteAgentProfileApi,
  listAgentProfileApi,
  listAgentSkillApi,
  saveAgentProfileApi,
  type AgentProfileContext,
  type AgentProfileItem,
  type AgentProfileSaveRequest,
  type AgentSkillItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;
const { TextArea } = Input;

interface ProfileFormValues {
  name: string;
  display_name?: string;
  description?: string;
  system_prompt?: string;
  skills?: string[];
  inject_memory?: boolean;
  inject_project?: boolean;
  is_default?: boolean;
}

const contextTags = (context?: AgentProfileContext) => (
  <Space size={4} wrap>
    <Tag color={context?.inject_memory ? "green" : "default"}>
      Memory {context?.inject_memory ? "ON" : "OFF"}
    </Tag>
    <Tag color={context?.inject_project ? "blue" : "default"}>
      Project {context?.inject_project ? "ON" : "OFF"}
    </Tag>
  </Space>
);

const AgentProfilePage = () => {
  const [data, setData] = useState<AgentProfileItem[]>([]);
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgentProfileItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ProfileFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, skillsRes] = await Promise.all([
        listAgentProfileApi(),
        listAgentSkillApi(),
      ]);
      setData(profilesRes.data ?? []);
      setSkills(skillsRes.data ?? []);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      inject_memory: true,
      inject_project: false,
      is_default: false,
    });
    setModalOpen(true);
  };

  const openEdit = (record: AgentProfileItem) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      display_name: record.display_name,
      description: record.description,
      system_prompt: record.system_prompt,
      skills: record.skills ?? [],
      inject_memory: record.context?.inject_memory ?? true,
      inject_project: record.context?.inject_project ?? false,
      is_default: record.is_default ?? false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: ProfileFormValues) => {
    const payload: AgentProfileSaveRequest = {
      id: editing?.id,
      name: values.name,
      display_name: values.display_name,
      description: values.description,
      system_prompt: values.system_prompt,
      skills: values.skills ?? [],
      context: {
        inject_memory: values.inject_memory ?? true,
        inject_project: values.inject_project ?? false,
      },
      is_default: values.is_default ?? false,
    };

    setSaving(true);
    try {
      await saveAgentProfileApi(payload);
      getGlobalMessage()?.success(
        editing ? "Profile updated successfully" : "Profile created successfully"
      );
      setModalOpen(false);
      load();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: AgentProfileItem) => {
    try {
      await deleteAgentProfileApi(record.id);
      getGlobalMessage()?.success("Profile deleted successfully");
      load();
    } catch {
      // API errors are shown globally by the http interceptor.
    }
  };

  const columns: ColumnsType<AgentProfileItem> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (value: string, record) => (
        <Space size={4}>
          <Text strong>{value || "-"}</Text>
          {record.is_default && <Tag color="gold">default</Tag>}
        </Space>
      ),
    },
    {
      title: "Display Name",
      dataIndex: "display_name",
      key: "display_name",
      width: 160,
      render: (value?: string) => value || "-",
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (value?: string) => value || "-",
    },
    {
      title: "Skills",
      dataIndex: "skills",
      key: "skills",
      width: 220,
      render: (value?: string[]) =>
        value && value.length > 0
          ? value.map((s) => (
              <Tag key={s} color="geekblue">
                {s}
              </Tag>
            ))
          : "-",
    },
    {
      title: "Context",
      dataIndex: "context",
      key: "context",
      width: 180,
      render: (value?: AgentProfileContext) => contextTags(value),
    },
    {
      title: "Type",
      dataIndex: "is_builtin",
      key: "is_builtin",
      width: 100,
      render: (value?: boolean) =>
        value ? <Tag color="purple">builtin</Tag> : <Tag>custom</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, record) =>
        record.is_builtin ? (
          <Text type="secondary">read-only</Text>
        ) : (
          <Space size={4}>
            <Button size="small" onClick={() => openEdit(record)}>
              Edit
            </Button>
            <Popconfirm
              title="Delete this profile?"
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Button size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ];

  return (
    <Card
      size="small"
      title="Agent Profile"
      extra={
        <Space>
          <Text type="secondary">Total: {data.length}</Text>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New Profile
          </Button>
        </Space>
      }
    >
      <Flex gap="small" style={{ marginBottom: 12 }} wrap>
        <Text type="secondary">
          Each profile bundles a system prompt, a set of skills and context
          injection switches. Builtin profiles are read-only; custom profiles
          are per-user.
        </Text>
      </Flex>

      <Table<AgentProfileItem>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <Text strong>System Prompt</Text>
              <pre
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                }}
              >
                {record.system_prompt || "-"}
              </pre>
            </div>
          ),
          rowExpandable: (record) => Boolean(record.system_prompt),
        }}
      />

      <Modal
        title={editing ? "Edit Profile" : "New Profile"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Save"
        destroyOnClose
      >
        <Form<ProfileFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. article_writer" />
          </Form.Item>

          <Form.Item name="display_name" label="Display Name">
            <Input placeholder="Human readable name (optional)" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input placeholder="Short description (optional)" />
          </Form.Item>

          <Form.Item name="system_prompt" label="System Prompt">
            <TextArea rows={4} placeholder="Base system prompt (optional)" />
          </Form.Item>

          <Form.Item name="skills" label="Skills">
            <Select
              mode="multiple"
              allowClear
              placeholder="Select skills to enable (empty = all)"
              options={skills.map((s) => ({ label: s.name, value: s.name }))}
            />
          </Form.Item>

          <Space size="large" wrap>
            <Form.Item
              name="inject_memory"
              label="Inject Memory"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="inject_project"
              label="Inject Project Context"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="is_default"
              label="Set as Default"
              valuePropName="checked"
              style={{ marginBottom: 8 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
};

export default AgentProfilePage;

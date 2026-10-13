import { FC, useEffect, useState } from "react";
import { Button, Flex, Form, Input, Select, Skeleton, Space, Switch } from "antd";
import {
  getAgentProfileApi,
  listAgentSkillApi,
  saveAgentProfileApi,
  type AgentProfileItem,
  type AgentProfileSaveRequest,
  type AgentSkillItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;

interface ProfileFormValues {
  name: string;
  display_name?: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  skills?: string[];
  inject_memory?: boolean;
  inject_project?: boolean;
  is_default?: boolean;
}

export interface AgentProfileEditModalProps {
  /** 待编辑的 Profile ID；为空表示新建。组件会按该 ID 查询 Profile 并回填表单。 */
  profileId?: string;
  /** 保存成功后回调（由 invoke.openAsync 注入，用于 resolve）。 */
  onOk?: (profile: AgentProfileItem) => void;
  /** 取消 / 关闭回调（由 invoke.openAsync 注入；未注入时回退到 close）。 */
  onCancel?: () => void;
  /** UIContainer 注入的关闭函数。 */
  close?: () => void;
}

/**
 * AgentProfileEditModal 是「新建 / 编辑 Agent Profile」的独立表单组件。
 *
 * 只接收 profileId：
 *   - 传入时按 ID 查询 Profile（后端 /agent/profile/get）并回填表单；
 *   - 为空时视为新建。
 *
 * 可通过 invoke.agentProfileEditModal.openAsync({ profileId }, { footer: null }) 弹出，
 * 供 Agent Profile 管理页与 AgentChat 复用。
 */
const AgentProfileEditModal: FC<AgentProfileEditModalProps> = ({
  profileId,
  onOk,
  onCancel,
  close,
}) => {
  const [form] = Form.useForm<ProfileFormValues>();
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AgentProfileItem | null>(null);

  const isEdit = Boolean(profileId);

  // handleClose 兼容两种打开方式：openAsync（注入 onCancel）与 UIContainer（注入 close）。
  const handleClose = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        // 技能列表用于 Skills 下拉；编辑时并发查询目标 Profile。
        const [skillsRes, profileRes] = await Promise.all([
          listAgentSkillApi(),
          profileId ? getAgentProfileApi(profileId) : Promise.resolve(null),
        ]);
        if (cancelled) return;

        setSkills(skillsRes.data ?? []);

        const record = profileRes?.data ?? null;
        setEditing(record);
        if (record) {
          form.setFieldsValue({
            name: record.name,
            display_name: record.display_name,
            description: record.description,
            system_prompt: record.system_prompt,
            model: record.model,
            skills: record.skills ?? [],
            inject_memory: record.context?.inject_memory ?? true,
            inject_project: record.context?.inject_project ?? false,
            is_default: record.is_default ?? false,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            inject_memory: true,
            inject_project: false,
            is_default: false,
          });
        }
      } catch {
        // API errors are shown globally by the http interceptor.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const handleFinish = async (values: ProfileFormValues) => {
    const payload: AgentProfileSaveRequest = {
      id: editing?.id,
      name: values.name,
      display_name: values.display_name,
      description: values.description,
      system_prompt: values.system_prompt,
      model: values.model,
      skills: values.skills ?? [],
      context: {
        inject_memory: values.inject_memory ?? true,
        inject_project: values.inject_project ?? false,
      },
      is_default: values.is_default ?? false,
    };

    setSaving(true);
    try {
      const res = await saveAgentProfileApi(payload);
      getGlobalMessage()?.success(
        isEdit ? "Profile updated successfully" : "Profile created successfully"
      );
      onOk?.(res.data);
      if (!onOk) handleClose();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <Form<ProfileFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
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

      <Form.Item name="model" label="Model">
        <Input placeholder="Model name, e.g. deepseek-v4-flash (optional)" />
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

      <Flex justify="end" gap="small">
        <Button onClick={handleClose}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={saving}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </Form>
  );
};

export default AgentProfileEditModal;

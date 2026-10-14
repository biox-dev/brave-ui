import { FC, useEffect, useState } from "react";
import { Button, Flex, Form, Input, Select, Skeleton, Space, Switch, Typography } from "antd";
import {
  getAgentProfileApi,
  listAgentSkillApi,
  saveAgentProfileApi,
  type AgentEnvInfo,
  type AgentProfileItem,
  type AgentProfileSaveRequest,
  type AgentSkillItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;
const { Text } = Typography;

interface ProfileFormValues {
  name: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  skills?: string[];
  inject_memory?: boolean;
  is_default?: boolean;
}

export interface AgentProfileEditModalProps {
  /** 待编辑的 Profile ID；为空表示新建。组件会按该 ID 查询 Profile 并回填表单。 */
  profileId?: string;
  /** 当前业务上下文（由 AgentChat 解析）：展示渲染系统提示词所用 vars 与渲染后的 system_prompt。 */
  envInfo?: AgentEnvInfo | null;
  /** 重新解析业务上下文；保存 system_prompt 后调用以刷新 vars / system_prompt 展示。 */
  loadEnvInfo?: () => Promise<AgentEnvInfo | null> | void;
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
 * 接收参数：
 *   - profileId：传入时按 ID 查询 Profile（后端 /agent/profile/get）并回填表单；为空时视为新建；
 *   - envInfo：AgentChat 解析出的业务上下文，用于展示渲染系统提示词所用 vars 与渲染后的 system_prompt；
 *   - loadEnvInfo：重新解析业务上下文，供预览区 Refresh，以及保存 system_prompt 后刷新展示。
 *
 * 可通过 invoke.agentProfileEditModal.openAsync({ profileId, envInfo, loadEnvInfo }, { footer: null }) 弹出，
 * 供 Agent Profile 管理页与 AgentChat 复用。
 */
const AgentProfileEditModal: FC<AgentProfileEditModalProps> = ({
  profileId,
  envInfo,
  loadEnvInfo,
  onOk,
  onCancel,
  close,
}) => {
  const [form] = Form.useForm<ProfileFormValues>();
  const [skills, setSkills] = useState<AgentSkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 仅保存 system_prompt 的加载态（Save Prompt 按钮）。
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [editing, setEditing] = useState<AgentProfileItem | null>(null);
  // 用于预览展示的上下文信息（initial 取自 envInfo prop，保存后由 loadEnvInfo 刷新）。
  const [renderInfo, setRenderInfo] = useState<AgentEnvInfo | null>(envInfo ?? null);
  // 预览区 Refresh 按钮加载态。
  const [refreshingEnv, setRefreshingEnv] = useState(false);

  const isEdit = Boolean(profileId);

  // 外部 envInfo 变化时同步到本地预览状态（如 AgentChat 在弹窗打开前重新解析）。
  useEffect(() => {
    setRenderInfo(envInfo ?? null);
  }, [envInfo]);

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
            description: record.description,
            system_prompt: record.system_prompt,
            model: record.model,
            skills: record.skills ?? [],
            inject_memory: record.context?.inject_memory ?? true,
            is_default: record.is_default ?? false,
          });
        } else {
          form.resetFields();
          form.setFieldsValue({
            inject_memory: true,
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

  // 把表单值组装为保存请求（新建 / 更新共用）。
  const buildPayload = (values: ProfileFormValues): AgentProfileSaveRequest => ({
    id: editing?.id,
    name: values.name,
    description: values.description,
    system_prompt: values.system_prompt,
    model: values.model,
    skills: values.skills ?? [],
    context: {
      inject_memory: values.inject_memory ?? true,
    },
    is_default: values.is_default ?? false,
  });

  const handleFinish = async (values: ProfileFormValues) => {
    const payload = buildPayload(values);

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

  // 手动刷新上下文预览（不保存，仅重新解析 envInfo 的 vars / system_prompt）。
  const handleRefreshEnv = async () => {
    setRefreshingEnv(true);
    try {
      const fresh = await loadEnvInfo?.();
      if (fresh) setRenderInfo(fresh);
    } finally {
      setRefreshingEnv(false);
    }
  };

  // 仅保存 system_prompt（连同当前表单其它字段），保存后刷新业务上下文，
  // 让预览区实时展示用新模板渲染出的 system_prompt 与 vars。
  const handleSavePrompt = async () => {
    if (!editing?.id) {
      getGlobalMessage()?.warning("Save the profile first");
      return;
    }
    let values: ProfileFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败，错误已展示在表单上。
    }

    setSavingPrompt(true);
    try {
      const res = await saveAgentProfileApi(buildPayload(values));
      setEditing(res.data);
      getGlobalMessage()?.success("System prompt saved");
      // 刷新业务上下文，更新渲染后的 system_prompt 与 vars 展示。
      const fresh = await loadEnvInfo?.();
      if (fresh) setRenderInfo(fresh);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSavingPrompt(false);
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  // 预览区是否有可见内容（渲染后的 system_prompt 或 vars）。
  const hasPreview =
    !!renderInfo?.system_prompt ||
    (!!renderInfo?.vars && Object.keys(renderInfo.vars).length > 0);

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
        <Input placeholder="e.g. 科研文章撰写" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input placeholder="Short description (optional)" />
      </Form.Item>

      <Form.Item name="model" label="Model">
        <Input placeholder="Model name, e.g. deepseek-v4-flash (optional)" />
      </Form.Item>

      <Form.Item
        name="system_prompt"
        label="System Prompt"
        tooltip={{
          title: (
            <span>
              pongo2 模板，可用变量如 <code>{"{{ workspace_directory }}"}</code>、
              <code>{"{{ workspace_label }}"}</code>；下方预览为渲染后的真实提示词。
            </span>
          ),
        }}
        style={{ marginBottom: 28 }}
      >
        <TextArea
          placeholder={"Base system prompt (pongo2 template, optional)\ne.g. 当前工作目录：{{ workspace_directory }}"}
          autoSize={{ minRows: 6, maxRows: 18 }}
          showCount
          spellCheck={false}
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        />
      </Form.Item>

      {/* 业务上下文预览（只读）：展示渲染系统提示词所用的 vars 与渲染后的 system_prompt。 */}
      {hasPreview && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <Flex align="center" justify="space-between">
            <Text strong style={{ fontSize: 13 }}>
              Context Preview
            </Text>
            <Space size="small">
              {/* 仅保存 system_prompt 并刷新上下文预览，不关闭弹窗。 */}
              <Button
                size="small"
                type="link"
                onClick={handleSavePrompt}
                loading={savingPrompt}
                disabled={!editing?.id}
              >
                Save Prompt
              </Button>
              <Button size="small" type="link" onClick={handleRefreshEnv} loading={refreshingEnv}>
                Refresh
              </Button>
            </Space>
          </Flex>

          {!!renderInfo?.vars && Object.keys(renderInfo.vars).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Vars
              </Text>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 160,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  color: "#595959",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
              >
                {JSON.stringify(renderInfo.vars, null, 2)}
              </pre>
            </div>
          )}

          {renderInfo?.system_prompt && (
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Rendered system prompt
              </Text>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 200,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {renderInfo.system_prompt}
              </pre>
            </div>
          )}
        </div>
      )}

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

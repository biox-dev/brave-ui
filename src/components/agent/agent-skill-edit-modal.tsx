import { Button, Flex, Form, Input, Switch, Typography } from "antd";
import { FC, useState } from "react";
import { saveAgentSkillApi, type AgentEnvInfo, type AgentSkillItem } from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;
const { Text } = Typography;

interface AgentSkillEditModalProps {
  /** 待编辑的技能；为 null / undefined 时表示新建。 */
  skill?: AgentSkillItem | null;
  /**
   * 当前业务上下文（可选）：由入口（如 Agent Profile 编辑弹窗）传入，
   * 用于展示渲染技能指令所用的模板变量，便于编写 pongo2 模板。
   */
  renderInfo?: AgentEnvInfo | null;
  onOk?: (skill: AgentSkillItem) => void;
  onCancel?: () => void;
}

interface AgentSkillFormValues {
  name: string;
  description: string;
  user_invocable: boolean;
  disable_model_invocation: boolean;
  disable_render: boolean;
  instructions?: string;
}

const AgentSkillEditModal: FC<AgentSkillEditModalProps> = ({
  skill,
  renderInfo,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm<AgentSkillFormValues>();
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(skill?.name);

  // 当前上下文的模板变量（仅展示，供编写指令正文时引用）。
  const contextVars = renderInfo?.vars ?? null;
  const hasVars = !!contextVars && Object.keys(contextVars).length > 0;

  const handleFinish = async (values: AgentSkillFormValues) => {
    setLoading(true);
    try {
      const saved = await saveAgentSkillApi({
        // 编辑时 name 作为标识不可变；新建时省略 id。
        id: isEdit ? skill?.name : undefined,
        name: values.name.trim(),
        description: values.description.trim(),
        user_invocable: values.user_invocable,
        disable_model_invocation: values.disable_model_invocation,
        disable_render: values.disable_render,
        instructions: values.instructions ?? "",
      });

      getGlobalMessage()?.success(isEdit ? "Skill updated" : "Skill created");
      if (onOk) onOk(saved.data);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<AgentSkillFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        name: skill?.name ?? "",
        description: skill?.description ?? "",
        user_invocable: skill?.user_invocable ?? false,
        disable_model_invocation: skill?.disable_model_invocation ?? false,
        disable_render: skill?.disable_render ?? false,
        instructions: skill?.instructions ?? "",
      }}
    >
      <Form.Item
        name="name"
        label="Name"
        tooltip="Alphanumeric with hyphens only; also used as the skill directory name."
        rules={[
          { required: true, message: "Please input a name" },
          {
            pattern: /^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$/,
            message: "Only letters, digits and single hyphens, e.g. code-review",
          },
          { max: 64, message: "Name must be at most 64 characters" },
        ]}
      >
        <Input placeholder="code-review" disabled={isEdit} autoFocus={!isEdit} />
      </Form.Item>

      <Form.Item
        name="description"
        label="Description"
        tooltip="Shown to the model so it can decide when to use this skill."
        rules={[
          { required: true, message: "Please input a description" },
          { max: 1024, message: "Description must be at most 1024 characters" },
        ]}
      >
        <TextArea rows={3} placeholder="What this skill does and when to use it" />
      </Form.Item>

      <Flex gap="large" wrap style={{ marginBottom: 8 }}>
        <Form.Item
          name="user_invocable"
          label="User Invocable"
          valuePropName="checked"
          style={{ marginBottom: 8 }}
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="disable_model_invocation"
          label="Disable Model Invocation"
          valuePropName="checked"
          tooltip="When on, the skill is hidden from the system prompt."
          style={{ marginBottom: 8 }}
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="disable_render"
          label="Disable Template Render"
          valuePropName="checked"
          tooltip="When on, the skill instructions and bundled resources are returned verbatim; {{ var }} placeholders are not rendered."
          style={{ marginBottom: 8 }}
        >
          <Switch />
        </Form.Item>
      </Flex>

      {/* 上下文字段（只读）：展示渲染指令正文可用的模板变量。 */}
      {hasVars && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <Text strong style={{ fontSize: 13 }}>
            Context Vars
          </Text>
          <pre
            style={{
              margin: 0,
              marginTop: 6,
              maxHeight: 160,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              color: "#595959",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            {JSON.stringify(contextVars, null, 2)}
          </pre>
        </div>
      )}

      <Form.Item
        name="instructions"
        label="Instructions (SKILL.md body)"
        tooltip={
          hasVars
            ? "pongo2 模板：可用变量见上方 Context Vars（Disable Template Render 开启时不渲染）。"
            : undefined
        }
      >
        <TextArea
          rows={12}
          placeholder="Markdown instructions the model should follow."
          style={{ fontFamily: "monospace" }}
        />
      </Form.Item>

      <Flex justify="end" gap="small">
        <Button onClick={() => onCancel?.()}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </Form>
  );
};

export default AgentSkillEditModal;

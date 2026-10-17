import { Button, Flex, Form, Input, Switch } from "antd";
import { FC, useState } from "react";
import { saveAgentSkillApi, type AgentSkillItem } from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;

interface AgentSkillEditModalProps {
  /** 待编辑的技能；为 null / undefined 时表示新建。 */
  skill?: AgentSkillItem | null;
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

const AgentSkillEditModal: FC<AgentSkillEditModalProps> = ({ skill, onOk, onCancel }) => {
  const [form] = Form.useForm<AgentSkillFormValues>();
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(skill?.name);

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

      <Form.Item name="instructions" label="Instructions (SKILL.md body)">
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

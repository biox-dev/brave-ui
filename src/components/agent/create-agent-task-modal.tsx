import { Button, Flex, Form, Input, Select, Switch } from "antd";
import { FC, useState } from "react";
import { createAgentTaskApi, type AgentTaskItem } from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;

const PROVIDER_OPTIONS = [
  { label: "Mock", value: "mock" },
  { label: "Claude Code", value: "claude_code" },
  { label: "Codex", value: "codex" },
  { label: "Copilot", value: "copilot" },
  { label: "Custom", value: "custom" },
];

interface CreateAgentTaskModalProps {
  onOk?: (task: AgentTaskItem) => void;
  onCancel?: () => void;
}

interface CreateAgentTaskFormValues {
  provider?: string;
  model?: string;
  system_prompt?: string;
  user_prompt?: string;
  working_dir?: string;
  stream?: boolean;
  env?: { key: string; value: string }[];
}

const CreateAgentTaskModal: FC<CreateAgentTaskModalProps> = ({ onOk, onCancel }) => {
  const [form] = Form.useForm<CreateAgentTaskFormValues>();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: CreateAgentTaskFormValues) => {
    setLoading(true);
    try {
      const messages = values.user_prompt?.trim()
        ? [{ role: "user", content: values.user_prompt.trim() }]
        : [];

      const env: Record<string, string> | undefined = values.env?.reduce(
        (acc, item) => {
          if (item.key?.trim()) {
            acc[item.key.trim()] = item.value ?? "";
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const task = await createAgentTaskApi({
        provider: values.provider,
        model: values.model || undefined,
        system_prompt: values.system_prompt || undefined,
        messages,
        working_dir: values.working_dir || undefined,
        stream: values.stream,
        env: env && Object.keys(env).length > 0 ? env : undefined,
      });

      getGlobalMessage()?.success("Agent task created successfully");
      onOk && onOk(task.data);
    } catch (error) {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<CreateAgentTaskFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{ provider: "copilot", stream: true ,working_dir: "/home/admin/workspace/go-project/test",
         env: [{ key: "MOCK_PERMISSION_DEMO", value: "true" }]}}
    >
      <Form.Item name="provider" label="Provider">
        <Select options={PROVIDER_OPTIONS} allowClear placeholder="Select provider" />
      </Form.Item>

      <Form.Item name="model" label="Model">
        <Input placeholder="Model name (optional)" />
      </Form.Item>

      <Form.Item name="system_prompt" label="System Prompt">
        <TextArea rows={3} placeholder="System prompt (optional)" />
      </Form.Item>

      <Form.Item name="user_prompt" label="User Prompt">
        <TextArea rows={4} placeholder="What should the agent do?" autoFocus />
      </Form.Item>

      <Form.Item name="working_dir" label="Working Dir">
        <Input placeholder="Working directory (optional)" />
      </Form.Item>

      <Form.Item name="stream" label="Stream" valuePropName="checked">
        <Switch />
      </Form.Item>

{/* MOCK_PERMISSION_DEMO:true */}
      <Form.List name="env" >
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Flex key={key} gap="small" align="baseline">
                <Form.Item
                  {...restField}
                  name={[name, "key"]}
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <Input placeholder="Env key" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, "value"]}
                  style={{ flex: 2, marginBottom: 0 }}
                >
                  <Input placeholder="Env value" />
                </Form.Item>
                <Button type="text" danger onClick={() => remove(name)}>
                  Remove
                </Button>
              </Flex>
            ))}
            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="dashed" onClick={() => add()} block>
                Add Env
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>

      <Flex justify="end" gap="small">
        <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          Create
        </Button>
      </Flex>
    </Form>
  );
};

export default CreateAgentTaskModal;

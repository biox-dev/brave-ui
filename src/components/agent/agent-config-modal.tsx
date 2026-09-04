import { Button, Flex, Form, Select, Typography } from "antd";
import { FC, useState } from "react";
import { updateAgentConfigApi, type AgentUserConfig } from "@/api/auth";
import { type AgentProfileItem } from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

// 操作类型（对应后端 agent.OperationType）。
const OPERATION_TYPES = ["read", "write", "delete", "move", "execute", "network"];

// 默认决策（对应后端 defaultPermissionPolicy）。
const DEFAULT_DECISIONS: Record<string, string> = {
  read: "ask",
  write: "ask",
  delete: "ask",
  move: "ask",
  execute: "ask",
  network: "allow",
};

const DECISION_OPTIONS = [
  { label: "Allow", value: "allow" },
  { label: "Ask", value: "ask" },
  { label: "Deny", value: "deny" },
];

interface AgentConfigModalProps {
  /** 当前用户的 Agent 配置（Profile + Permissions）。 */
  config?: AgentUserConfig | null;
  /** 可选 AgentProfile 列表。 */
  profiles?: AgentProfileItem[];
  onOk?: (config: AgentUserConfig) => void;
  onCancel?: () => void;
}

interface AgentConfigFormValues {
  profile?: string;
  permissions: Record<string, string>;
}

const AgentConfigModal: FC<AgentConfigModalProps> = ({ config, profiles, onOk, onCancel }) => {
  const [form] = Form.useForm<AgentConfigFormValues>();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: AgentConfigFormValues) => {
    setLoading(true);
    try {
      const res = await updateAgentConfigApi({
        profile: values.profile || "",
        permissions: values.permissions,
      });
      getGlobalMessage()?.success("Agent config updated");
      onOk &&
        onOk(
          res.data.user?.agent_config ?? {
            profile: values.profile,
            permissions: values.permissions,
          }
        );
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<AgentConfigFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        profile: config?.profile ?? "",
        permissions: OPERATION_TYPES.reduce((acc, op) => {
          acc[op] = config?.permissions?.[op] ?? DEFAULT_DECISIONS[op] ?? "ask";
          return acc;
        }, {} as Record<string, string>),
      }}
    >
      <Form.Item name="profile" label="Profile">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Select agent profile (default)"
          options={(profiles ?? []).map((p) => ({
            value: p.name,
            label: `${p.display_name || p.name}${p.is_default ? " (default)" : ""}`,
          }))}
        />
      </Form.Item>

      <Text type="secondary" style={{ fontSize: 12 }}>
        Permissions
      </Text>
      {OPERATION_TYPES.map((op) => (
        <Form.Item
          key={op}
          name={["permissions", op]}
          label={op}
          style={{ marginBottom: 8 }}
        >
          <Select options={DECISION_OPTIONS} style={{ width: "100%" }} />
        </Form.Item>
      ))}

      <Flex justify="end" gap="small">
        <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          Save
        </Button>
      </Flex>
    </Form>
  );
};

export default AgentConfigModal;

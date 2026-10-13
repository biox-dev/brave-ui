import { Button, Flex, Form, Select, Typography } from "antd";
import { FC, useEffect, useState } from "react";
import { updateAgentConfigApi, type AgentUserConfig } from "@/api/auth";
import { listAgentProfileApi, type AgentProfileItem } from "@/api/agent";
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
  onOk?: (config: AgentUserConfig) => void;
  onCancel?: () => void;
}

interface AgentConfigFormValues {
  profile_id?: string;
  permissions: Record<string, string>;
}

const AgentConfigModal: FC<AgentConfigModalProps> = ({ config, onOk, onCancel }) => {
  const [form] = Form.useForm<AgentConfigFormValues>();
  const [loading, setLoading] = useState(false);
  // AgentProfile 列表由弹窗在打开时按需查询（调用方无需再传 profiles）。
  const [profiles, setProfiles] = useState<AgentProfileItem[]>([]);

  useEffect(() => {
    listAgentProfileApi()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => setProfiles([]));
  }, []);

  const handleFinish = async (values: AgentConfigFormValues) => {
    setLoading(true);
    try {
      const res = await updateAgentConfigApi({
        profile_id: values.profile_id || "",
        permissions: values.permissions,
      });
      getGlobalMessage()?.success("Agent config updated");
      onOk &&
        onOk(
          res.data.user?.agent_config ?? {
            profile_id: values.profile_id,
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
        profile_id: config?.profile_id ?? "",
        permissions: OPERATION_TYPES.reduce((acc, op) => {
          acc[op] = config?.permissions?.[op] ?? DEFAULT_DECISIONS[op] ?? "ask";
          return acc;
        }, {} as Record<string, string>),
      }}
    >
      <Form.Item name="profile_id" label="Profile">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Select agent profile (default)"
          options={profiles.map((p) => ({
            value: p.id,
            label: `${p.name}${p.is_default ? " (default)" : ""}`,
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

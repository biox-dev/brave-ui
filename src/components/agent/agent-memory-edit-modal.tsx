import { Button, Flex, Form, Input, InputNumber, Select } from "antd";
import { FC, useState } from "react";
import {
  AgentMemoryKind,
  saveAgentMemoryApi,
  type AgentMemoryItem,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { TextArea } = Input;

const KIND_OPTIONS = [
  { label: "Fact", value: AgentMemoryKind.Fact },
  { label: "Summary", value: AgentMemoryKind.Summary },
  { label: "Note", value: AgentMemoryKind.Note },
  { label: "Event", value: AgentMemoryKind.Event },
];

interface AgentMemoryEditModalProps {
  /** 待编辑的记忆；为 null / undefined 时表示新建。 */
  memory?: AgentMemoryItem | null;
  onOk?: (memory: AgentMemoryItem) => void;
  onCancel?: () => void;
}

interface AgentMemoryFormValues {
  kind: string;
  content: string;
  importance: number;
  session_id?: string;
  metadata?: string;
}

const AgentMemoryEditModal: FC<AgentMemoryEditModalProps> = ({ memory, onOk, onCancel }) => {
  const [form] = Form.useForm<AgentMemoryFormValues>();
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(memory?.id);

  const handleFinish = async (values: AgentMemoryFormValues) => {
    let metadata: Record<string, unknown> | null = null;
    const rawMetadata = (values.metadata ?? "").trim();
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata);
      } catch {
        getGlobalMessage()?.error("Metadata 不是合法的 JSON");
        return;
      }
    }

    setLoading(true);
    try {
      const saved = await saveAgentMemoryApi({
        id: memory?.id,
        session_id: values.session_id?.trim() || undefined,
        kind: values.kind,
        content: values.content,
        importance: values.importance ?? 0,
        metadata,
      });

      getGlobalMessage()?.success(isEdit ? "Memory updated" : "Memory created");
      onOk && onOk(saved.data);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<AgentMemoryFormValues>
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        kind: memory?.kind ?? AgentMemoryKind.Fact,
        content: memory?.content ?? "",
        importance: memory?.importance ?? 0,
        session_id: memory?.session_id ?? "",
        metadata: memory?.metadata ? JSON.stringify(memory.metadata, null, 2) : "",
      }}
    >
      <Form.Item name="kind" label="Kind" rules={[{ required: true, message: "Please select a kind" }]}>
        <Select options={KIND_OPTIONS} />
      </Form.Item>

      <Form.Item name="content" label="Content" rules={[{ required: true, message: "Please input content" }]}>
        <TextArea rows={4} placeholder="Memory content" autoFocus={!isEdit} />
      </Form.Item>

      <Form.Item name="importance" label="Importance (0-10)">
        <InputNumber min={0} max={10} style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item name="session_id" label="Session ID (optional)">
        <Input placeholder="Associate with a session" />
      </Form.Item>

      <Form.Item
        name="metadata"
        label="Metadata (optional JSON)"
        tooltip='A JSON object, e.g. {"source": "manual"}'
      >
        <TextArea rows={3} placeholder='{"source": "manual"}' />
      </Form.Item>

      <Flex justify="end" gap="small">
        <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </Form>
  );
};

export default AgentMemoryEditModal;

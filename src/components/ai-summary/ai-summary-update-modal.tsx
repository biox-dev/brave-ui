import { Button, Flex, Form, Input, Space } from "antd";
import { FC, useState } from "react";
import { http } from "@/api/client/http";
import type { AgentProfileItem } from "@/api/agent";
import { invoke } from "@/core/ui-system/invokeV2";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import type { AISummaryItem } from "./ai-summary-panel";

interface AISummaryUpdateModalProps {
  /** 摘要 ID。 */
  id: string;
  /** 初始标题。 */
  title?: string;
  /** 初始内容。 */
  content?: string;
  /** 初始 Agent Profile 名称（为空表示使用内置 summary Profile）。 */
  profile?: string;
  onOk?: (value?: AISummaryItem) => void;
  onCancel?: () => void;
}

interface AISummaryUpdateFormValues {
  title: string;
  content: string;
  profile?: string;
}

/**
 * 更新 AI 摘要弹窗：
 * - 编辑标题与内容；
 * - 选择生成摘要使用的 Agent Profile（弹出 agentProfileSelect）；
 * - 提交时调用后端 UpdateAISummary（/ai-summary/update）。
 */
const AISummaryUpdateModal: FC<AISummaryUpdateModalProps> = ({
  id,
  title = "",
  content = "",
  profile = "",
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm<AISummaryUpdateFormValues>();
  const [loading, setLoading] = useState(false);

  const handleSelectProfile = async () => {
    try {
      const selected = (await invoke.agentProfileSelect.openAsync(
        { selectable: true },
        { title: "Select Agent Profile", width: 1100, footer: null }
      )) as AgentProfileItem | undefined;
      if (selected?.name) {
        form.setFieldValue("profile", selected.name);
      }
    } catch {
      // 用户取消选择，保留原值。
    }
  };

  const handleFinish = async (values: AISummaryUpdateFormValues) => {
    setLoading(true);
    try {
      const resp = await http.post<AISummaryItem>("/ai-summary/update", {
        id: String(id),
        title: values.title,
        content: values.content,
        profile: values.profile ?? "",
      });
      getGlobalMessage()?.success("AI summary updated");
      onOk && onOk(resp.data);
    } catch {
      // API errors handled by http interceptor.
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<AISummaryUpdateFormValues>
      form={form}
      layout="vertical"
      initialValues={{ title, content, profile }}
      onFinish={handleFinish}
    >
      <Form.Item name="title" label="Title">
        <Input placeholder="Title" autoFocus />
      </Form.Item>
      <Form.Item label="Agent Profile">
        <Space.Compact style={{ width: "100%" }}>
          <Form.Item name="profile" noStyle>
            <Input
              readOnly
              placeholder="Agent profile (empty = builtin summary)"
            />
          </Form.Item>
          <Button onClick={handleSelectProfile}>Select</Button>
          <Button onClick={() => form.setFieldValue("profile", "")}>
            Clear
          </Button>
        </Space.Compact>
      </Form.Item>
      <Form.Item name="content" label="Content">
        <Input.TextArea rows={8} placeholder="Content" />
      </Form.Item>
      <Flex justify="end" gap="small">
        <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          Update
        </Button>
      </Flex>
    </Form>
  );
};

export default AISummaryUpdateModal;

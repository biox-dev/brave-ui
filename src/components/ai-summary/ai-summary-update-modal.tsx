import { Button, Flex, Form, Input } from "antd";
import { FC, useState } from "react";
import { http } from "@/api/client/http";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import type { AISummaryItem } from "./ai-summary-panel";

interface AISummaryUpdateModalProps {
  /** 摘要 ID。 */
  id: string;
  /** 初始标题。 */
  title?: string;
  /** 初始内容。 */
  content?: string;
  onOk?: (value?: AISummaryItem) => void;
  onCancel?: () => void;
}

interface AISummaryUpdateFormValues {
  title: string;
  content: string;
}

/**
 * 更新 AI 摘要弹窗：
 * - 编辑标题与内容；
 * - 提交时调用后端 UpdateAISummary（/ai-summary/update）。
 */
const AISummaryUpdateModal: FC<AISummaryUpdateModalProps> = ({
  id,
  title = "",
  content = "",
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm<AISummaryUpdateFormValues>();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: AISummaryUpdateFormValues) => {
    setLoading(true);
    try {
      const resp = await http.post<AISummaryItem>("/ai-summary/update", {
        id: String(id),
        title: values.title,
        content: values.content,
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
      initialValues={{ title, content }}
      onFinish={handleFinish}
    >
      <Form.Item name="title" label="Title">
        <Input placeholder="Title" autoFocus />
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

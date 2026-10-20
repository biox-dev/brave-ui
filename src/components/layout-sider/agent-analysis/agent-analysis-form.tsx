import { useEffect, useState } from "react";
import { Alert, Button, Flex, Form, Input, Space, Spin } from "antd";
import { SelectOutlined } from "@ant-design/icons";
import {
  createAgentAnalysisApi,
  getAgentAnalysisApi,
  isAgentAnalysisRunning,
  updateAgentAnalysisApi,
  type AgentAnalysisItem,
} from "@/api/agent-analysis";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface AgentAnalysisFormProps {
  /** AgentAnalysis id；有值 = 编辑，无值 = 创建。 */
  id?: string;
  /** 保存成功后回调（例如刷新列表）。 */
  callback?: (item?: AgentAnalysisItem) => void;
  /** openAsync 注入。 */
  onOk?: (item?: AgentAnalysisItem) => void;
  /** openAsync 注入。 */
  onCancel?: () => void;
  /** UIContainer 注入。 */
  close?: () => void;
}

/**
 * AgentAnalysis 创建 / 编辑表单。
 *
 * 通过 `invoke.agentAnalysisForm.open(...)` 以弹窗方式打开；
 * 编辑时只传 `id`，组件会调用 `GET /container/agent-analysis/get` 回填。
 * 任务处于 running / pending 时只允许修改 Name。
 */
const AgentAnalysisForm = ({
  id,
  callback,
  onOk,
  onCancel,
  close,
}: AgentAnalysisFormProps) => {
  const message = useGlobalMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState<AgentAnalysisItem | null>(null);

  const isEdit = Boolean(id);
  const locked = Boolean(item && isAgentAnalysisRunning(item.status));

  useEffect(() => {
    let active = true;
    if (!id) {
      setItem(null);
      form.resetFields();
      return;
    }
    setLoading(true);
    getAgentAnalysisApi(id)
      .then((resp) => {
        if (!active) return;
        const data = resp.data;
        setItem(data);
        form.setFieldsValue({
          name: data.name || "",
          template_id: data.template_id ? String(data.template_id) : "",
          command: data.command || "",
          workspace_dir: data.workspace_dir || "",
        });
      })
      .catch((error) => {
        console.warn("load agent analysis failed", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, form]);

  const handleSelectTemplate = async () => {
    try {
      const selected = await invoke.containerTemplatePage.openAsync(
        { title: "选择容器模板" },
        { width: "80%", footer: null, title: "选择容器模板" },
      );
      if (selected?.id) {
        form.setFieldValue("template_id", String(selected.id));
        await form.validateFields(["template_id"]);
      }
    } catch (error) {
      console.warn("select container template cancelled", error);
    }
  };

  const handleSubmit = async () => {
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd 会展示校验信息
    }

    setSaving(true);
    try {
      let saved: AgentAnalysisItem | undefined;
      if (isEdit && id) {
        const resp = await updateAgentAnalysisApi({
          id,
          name: String(values.name || "").trim(),
          ...(locked
            ? {}
            : {
                template_id: String(values.template_id || "").trim(),
                command: values.command || "",
                workspace_dir: String(values.workspace_dir || "").trim(),
              }),
        });
        saved = resp.data;
        message.success("AgentAnalysis 已更新");
      } else {
        const resp = await createAgentAnalysisApi({
          name: String(values.name || "").trim(),
          template_id: String(values.template_id || "").trim(),
          command: values.command || "",
          workspace_dir: String(values.workspace_dir || "").trim(),
        });
        saved = resp.data;
        message.success("AgentAnalysis 已创建");
      }

      callback?.(saved);
      if (typeof onOk === "function") {
        onOk(saved);
      } else {
        close?.();
      }
    } catch (error) {
      console.warn("save agent analysis failed", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    close?.();
  };

  return (
    <Spin spinning={loading}>
      <Form form={form} layout="vertical" size="small">
        {locked ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="运行中只能修改 Name；Template / Command / WorkspaceDir 需要任务结束后再改。"
          />
        ) : null}

        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, whitespace: true, message: "Name 不能为空" }]}
        >
          <Input placeholder="agent-analysis-name" disabled={saving} />
        </Form.Item>

        <Form.Item label="TemplateID" required>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item
              name="template_id"
              noStyle
              rules={[{ required: true, whitespace: true, message: "TemplateID 不能为空" }]}
            >
              <Input placeholder="container template id" disabled={locked || saving} />
            </Form.Item>
            <Button
              icon={<SelectOutlined />}
              disabled={locked || saving}
              onClick={handleSelectTemplate}
            >
              选择
            </Button>
          </Space.Compact>
        </Form.Item>

        <Form.Item
          label="Command"
          name="command"
          rules={[{ required: true, whitespace: true, message: "Command 不能为空" }]}
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 10 }}
            placeholder="bash commands..."
            disabled={locked || saving}
          />
        </Form.Item>

        <Form.Item
          label="WorkspaceDir"
          name="workspace_dir"
          extra="可选：storage.base_dir 下的路径，留空则使用默认工作目录。"
        >
          <Input placeholder="可选：storage.base_dir 下的路径" disabled={locked || saving} />
        </Form.Item>

        <Flex justify="flex-end" gap={8}>
          <Button onClick={handleCancel} disabled={saving}>
            取消
          </Button>
          <Button type="primary" loading={saving} onClick={handleSubmit}>
            {isEdit ? "保存" : "创建"}
          </Button>
        </Flex>
      </Form>
    </Spin>
  );
};

export default AgentAnalysisForm;

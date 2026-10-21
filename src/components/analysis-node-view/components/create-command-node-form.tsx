import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Flex, Form, Input, Select, Switch, Tag } from "antd";
import TextArea from "antd/es/input/TextArea";
import { createCommandNodeApi, type AnalysisNodeItem } from "@/api/analysis";
import { pageContainerTemplateApi, type ContainerTemplateItem } from "@/api/container";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface CreateCommandNodeFormProps {
  onOk?: (node: AnalysisNodeItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

/**
 * 手动创建命令型分析节点（无脚本）。
 *
 * 等价于 Agent 工具 run_agent_analysis：节点自带容器模板与 shell 命令，
 * run.sh 由 command 生成；创建后与普通分析节点共用运行 / 停止 / 日志链路。
 * 通过 `invoke.createCommandNode.openAsync(...)` 以弹窗方式打开。
 */
const CreateCommandNodeForm = ({ onOk, onCancel, close }: CreateCommandNodeFormProps) => {
  const message = useGlobalMessage();
  const [name, setName] = useState("");
  const [templateID, setTemplateID] = useState<string>();
  const [command, setCommand] = useState("");
  const [run, setRun] = useState(true);
  const [templates, setTemplates] = useState<ContainerTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pageContainerTemplateApi({ page: 1, page_size: 200 })
      .then((resp) => {
        if (cancelled) {
          return;
        }
        const items = resp.data?.data ?? [];
        setTemplates(items);
        const preferred = items.find((item) => item.is_default) || items[0];
        if (preferred) {
          setTemplateID(String(preferred.id));
        }
      })
      .catch(() => {
        // 全局 http 拦截器已提示错误；这里只保证表单仍可手动填写。
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const templateOptions = useMemo(
    () =>
      templates.map((item) => ({
        value: String(item.id),
        label: `${item.display_name || item.name || item.id}${item.is_default ? " (default)" : ""}`,
      })),
    [templates]
  );

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedCommand = command.trim();
    if (!trimmedName) {
      message.warning("Name is required");
      return;
    }
    if (!templateID) {
      message.warning("Container template is required");
      return;
    }
    if (!trimmedCommand) {
      message.warning("Command is required");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await createCommandNodeApi({
        name: trimmedName,
        container_template_id: String(templateID),
        command: trimmedCommand,
        run,
      });
      message.success(run ? "Command analysis node created and submitted" : "Command analysis node created");
      if (onOk) {
        onOk(resp.data);
      } else {
        close?.();
      }
    } catch {
      // 错误已由全局 http 拦截器提示。
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="命令型分析节点没有脚本：容器模板与 run.sh 正文都由节点自身承载。"
      />
      <Form layout="vertical">
        <Form.Item label="Name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="agent-analysis-name"
            disabled={submitting}
          />
        </Form.Item>
        <Form.Item label="Container Template" required>
          <Select
            showSearch
            loading={loading}
            value={templateID}
            onChange={(value) => setTemplateID(value)}
            options={templateOptions}
            optionFilterProp="label"
            placeholder="Select a container template"
            disabled={submitting}
          />
        </Form.Item>
        <Form.Item label="Command" required extra="命令会写入节点工作目录的 run.sh 后执行。">
          <TextArea
            rows={8}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={"set -euo pipefail\npython analysis.py \"$PARAMS_PATH\" \"$OUTPUT_DIR\""}
            disabled={submitting}
            style={{ fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", monospace' }}
          />
        </Form.Item>
        <Form.Item label="Run after create">
          <Switch checked={run} onChange={setRun} disabled={submitting} />
          {run && <Tag style={{ marginLeft: 8 }}>created node will be submitted immediately</Tag>}
        </Form.Item>
      </Form>
      <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
        <Button onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="primary" loading={submitting} onClick={handleSubmit}>
          Create
        </Button>
      </Flex>
    </div>
  );
};

export default CreateCommandNodeForm;

// src/components/script/create-or-update-script.tsx
// Standalone Script component create/update view (migrated from the old
// CreateOrUpdatePipelineV2 + create-or-update-component wrapper).
//
// Usage:
//  - As a registered view "createOrUpdateScript" (see ./index.ts), opened via
//    `invoke.createOrUpdateScript.open/openAsync` (e.g. "Create Script",
//    "Update Script", node edit drawers ...).
//  - Rendered inline by <ViewResolver view="createOrUpdateScript" ... /> (e.g.
//    script-panel "structure"). In that case the full script object is passed
//    in as `component`/`data`, so NO extra fetch API is needed — the form is
//    prefilled from the passed data and "Update" saves it back.

import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Spin, Typography, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { FC, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { http } from "@/api/client/http";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

// ---------- small helpers ----------

const normalizeTags = (value: any): string[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : value ? [value] : [];
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
};

const toJSONString = (value: any): string | undefined => {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return undefined;
  }
};

const toFormValues = (script: any) => ({
  component_name: script?.component_name,
  container_template_id: script?.container_template_id,
  // backend /find-script returns the display name under "continername"
  container_name:
    script?.continername ?? script?.container_template_name ?? script?.container_name,
  script_type: script?.script_type,
  io_schema: toJSONString(script?.io_schema),
  content:
    script?.content && typeof script?.content !== "string"
      ? JSON.stringify(script?.content, null, 2)
      : script?.content,
  tags: normalizeTags(script?.tags),
  category: script?.category,
  img: script?.img,
  order_index: script?.order_index ?? 0,
  description: script?.description,
});

const isNumeric = (value: any) =>
  value != null && value !== "" && /^\d+$/.test(String(value));

const serializeJSON = (value: any, fallback = "{}") => {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

// ---------- script image upload ----------

const ScriptImageUpload: FC<any> = ({ value, onChange, component_id }) => {
  const { baseURL } = useSelector((state: any) => state.user);
  const [fileList, setFileList] = useState<any[]>([]);

  useEffect(() => {
    if (value) {
      setFileList([
        {
          uid: "-1",
          name: "image.png",
          status: "done",
          url: `${baseURL}${value}`,
        },
      ]);
    }
  }, [value, baseURL]);

  return (
    <Upload
      fileList={fileList}
      listType="picture-card"
      action={`${baseURL}/brave-api/component/upload/${component_id}`}
      onChange={({ file, fileList: list }) => {
        setFileList([file]);
        if (file.status === "done") {
          onChange(file.response?.url);
        }
      }}
    >
      <button type="button" style={{ border: 0, background: "none", cursor: "pointer" }}>
        <PlusOutlined />
        <div style={{ marginTop: 8 }}>Upload</div>
      </button>
    </Upload>
  );
};

// ---------- component ----------

export type CreateOrUpdateScriptProps = {
  /** existing script object (used when rendered by script-panel via ViewResolver) */
  data?: any;
  /** alias used when rendered through a <ViewResolver> that passes `component` */
  component?: any;
  /** numeric db id of the script (script-panel passes script.id here) */
  script_id?: any;
  /** uuid or numeric id used by other flows (workflow-page / analysis nodes) */
  component_id?: any;
  structure?: any;
  namespace?: string;
  callback?: (...args: any[]) => void;
  onOk?: (data?: any) => void;
  close?: () => void;
  openModal?: any;
};

const CreateOrUpdateScript: FC<CreateOrUpdateScriptProps> = (params) => {
  const {
    data,
    component,
    script_id,
    component_id,
    callback,
    onOk,
    close,
  } = params;

  const message = useGlobalMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // stores data loaded from the server when only a numeric id is given
  const [loaded, setLoaded] = useState<any>();

  const incoming = data ?? component;
  // script-panel and workflow-page pass numeric db ids; node flows may pass uuid
  const numericId = useMemo(
    () =>
      isNumeric(incoming?.id)
        ? String(incoming.id)
        : isNumeric(script_id)
          ? String(script_id)
          : isNumeric(component_id)
            ? String(component_id)
            : undefined,
    [incoming?.id, script_id, component_id]
  );

  const record = useMemo(() => {
    if (incoming && typeof incoming === "object" && Object.keys(incoming).length > 0) {
      return incoming;
    }
    return loaded;
  }, [incoming, loaded]);

  const isEdit = Boolean(numericId);
  // upload needs an existing component uuid
  const uploadComponentId = record?.component_id ?? component_id;

  // prefill: from passed data when available, otherwise fetch by numeric id
  useEffect(() => {
    let active = true;
    if (incoming && typeof incoming === "object" && Object.keys(incoming).length > 0) {
      form.setFieldsValue(toFormValues(incoming));
    } else if (numericId) {
      setLoading(true);
      http
        .get(`/find-script/${numericId}`)
        .then((resp: any) => {
          if (!active) return;
          setLoaded(resp.data);
          form.setFieldsValue(toFormValues(resp.data));
        })
        .catch((error: any) => {
          if (!active) return;
          console.log(error);
          message.error(error?.response?.data?.detail ?? error?.message ?? "Failed to load script!");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      form.resetFields();
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericId, incoming ? (incoming as any)?.id : undefined]);

  const getParams = (values: any) => {
    const payload: any = { ...values, component_type: "script" };
    if (Array.isArray(payload.tags)) {
      payload.tags = JSON.stringify(payload.tags);
    }
    if (payload.content && typeof payload.content !== "string") {
      payload.content = serializeJSON(payload.content);
    }
    if (payload.io_schema && typeof payload.io_schema !== "string") {
      payload.io_schema = serializeJSON(payload.io_schema, "");
    }
    if (numericId) {
      payload.id = numericId;
    }
    if (record?.component_id && !payload.component_id) {
      payload.component_id = record.component_id;
    }
    return payload;
  };

  const savePipeline = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd renders the validation messages
    }
    if (
      values?.io_schema &&
      typeof values.io_schema === "string" &&
      values.io_schema.trim()
    ) {
      try {
        JSON.parse(values.io_schema);
      } catch {
        message.error("io_schema must be valid JSON!");
        return;
      }
    }
    setLoading(true);
    try {
      const payload = getParams(values);
      const resp = await http.post("/workflow/save-script", payload);
      message.success(isEdit ? "Update success!" : "Create success!");
      callback?.();
      if (typeof onOk === "function") {
        onOk(resp?.data ?? payload);
      } else if (typeof close === "function") {
        close();
      }
    } catch (error: any) {
      console.log(error);
      message.error(
        error?.response?.data?.detail ?? error?.message ?? "Save script failed!"
      );
    } finally {
      setLoading(false);
    }
  };

  const selectContainerTemplate = async () => {
    const selected = await invoke.containerTemplatePage
      .openAsync({}, { title: "Select Container Template", width: "80%", footer: false })
      .catch(() => undefined);
    if (selected?.id) {
      form.setFieldsValue({
        container_template_id: selected.id,
        container_name: selected.name,
      });
      await form.validateFields(["container_template_id"]);
    }
  };

  return (
    <Spin spinning={loading}>
      <Card
        size="small"
        style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}
        styles={{ body: { flex: 1 } }}
        extra={
          <Space>
            <Button size="small" color="cyan" variant="solid" loading={loading} onClick={savePipeline}>
              {isEdit ? "Update" : "Create"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="component_name"
            label="Component Name"
            rules={[{ required: true, message: "Please input component name!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="container_template_id"
            label="Container"
            rules={[{ required: true, message: "Please select container!" }]}
            dependencies={["container_name"]}
            getValueProps={(value) => ({
              value: form.getFieldValue("container_name") || value,
            })}
          >
            <Input
              readOnly
              placeholder="Click to select container template"
              onClick={selectContainerTemplate}
            />
          </Form.Item>

          <Form.Item name="script_type" label="Script Type">
            <Select
              options={[
                { label: "python", value: "python" },
                { label: "jupyter", value: "jupyter" },
                { label: "shell", value: "shell" },
                { label: "qmd", value: "qmd" },
                { label: "R", value: "r" },
              ]}
            />
          </Form.Item>

          <Form.Item name="io_schema" label="io_schema">
            <Input.TextArea rows={5} spellCheck={false} />
          </Form.Item>

          <Form.Item name="content" label="Content">
            <Input.TextArea rows={6} spellCheck={false} />
          </Form.Item>

          <Form.Item name="tags" label="Tags">
            <Select mode="tags" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Input />
          </Form.Item>

          {uploadComponentId && (
            <Form.Item name="img" label="Upload">
              <ScriptImageUpload component_id={uploadComponentId} />
            </Form.Item>
          )}

          <Form.Item name="order_index" label="Order" initialValue={0}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} />
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: "1",
                label: "More",
                children: (
                  <Form.Item noStyle shouldUpdate>
                    {() => (
                      <Typography>
                        <pre>{JSON.stringify(getParams(form.getFieldsValue()), null, 2)}</pre>
                      </Typography>
                    )}
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Card>
    </Spin>
  );
};

export default CreateOrUpdateScript;

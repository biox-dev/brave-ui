// src/components/script/create-or-update-script.tsx
// Standalone Script component create/update view (migrated from the old
// CreateOrUpdatePipelineV2 + create-or-update-component wrapper).
//
// Usage:
//  - As a registered view "createOrUpdateScript" (see ./index.ts), opened via
//    `invoke.createOrUpdateScript.open/openAsync` (e.g. "Create Script",
//    "Update Script", node edit drawers ...).
//  - Rendered inline by <ViewResolver view="createOrUpdateScript" ... /> (e.g.
//    script-panel "Edit" tab).
//
// Edit vs. create is decided solely by `script_id`:
//  - `script_id` set  -> edit mode; the form is ALWAYS (re)loaded from
//    `GET /find-script/:id`, so callers never pass a full object around.
//  - `script_id` unset -> create mode; blank form.

import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Spin, Typography } from "antd";
import { FC, useEffect, useState } from "react";
import { http } from "@/api/client/http";
import { ComponentImageUpload } from "@/components/common/component-image";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import IOSchemaEditor, { normalizeIOSchema } from "../io-schema-editor";

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

const toFormValues = (script: any) => ({
  name: script?.name,
  container_template_id: script?.container_template_id,
  // backend /find-script returns the display name under "continername"
  container_name:
    script?.continername ?? script?.container_template_name ?? script?.container_name,
  script_type: script?.script_type,
  // normalized to an object so <IOSchemaEditor /> can edit it visually;
  // getParams() re-serializes it back to a JSON string on save.
  io_schema: normalizeIOSchema(script?.io_schema),
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

// ---------- component ----------

export type CreateOrUpdateScriptProps = {
  /** numeric script (db) id — present = edit mode, absent = create mode. */
  script_id?: string | number;
  /** re-invoked after a successful save (e.g. to refetch the list / panel) */
  callback?: (...args: any[]) => void;
  onOk?: (data?: any) => void;
  close?: () => void;
};

const CreateOrUpdateScript: FC<CreateOrUpdateScriptProps> = ({
  script_id,
  callback,
  onOk,
  close,
}) => {
  const message = useGlobalMessage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // gates the "More" debug preview so it does not re-render on every keystroke
  const [showDebug, setShowDebug] = useState(false);

  // `script_id` is the single source of truth: edit mode always reloads the
  // record from the server, create mode just renders an empty form.
  const numericId = isNumeric(script_id) ? String(script_id) : undefined;
  const isEdit = Boolean(numericId);

  useEffect(() => {
    let active = true;
    if (!numericId) {
      form.resetFields();
      return;
    }
    setLoading(true);
    http
      .get(`/find-script/${numericId}`)
      .then((resp: any) => {
        if (!active) return;
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
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericId]);

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
            name="name"
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

          <Form.Item name="io_schema" label="IO Schema (visual form builder)">
            <IOSchemaEditor />
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

          {numericId && (
            <Form.Item name="img" label="Upload">
              <ComponentImageUpload kind="script" id={numericId} />
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
            activeKey={showDebug ? ["1"] : []}
            onChange={(keys) =>
              setShowDebug((Array.isArray(keys) ? keys : [keys]).includes("1"))
            }
            items={[
              {
                key: "1",
                label: "More",
                // A `shouldUpdate` item re-runs on EVERY form change; mounting it
                // only while the panel is open keeps editing responsive.
                children: showDebug ? (
                  <Form.Item noStyle shouldUpdate>
                    {() => (
                      <Typography>
                        <pre>{JSON.stringify(getParams(form.getFieldsValue()), null, 2)}</pre>
                      </Typography>
                    )}
                  </Form.Item>
                ) : null,
              },
            ]}
          />
        </Form>
      </Card>
    </Spin>
  );
};

export default CreateOrUpdateScript;

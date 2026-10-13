// src/components/workflow/create-or-update-workflow.tsx
// Standalone workflow create/update component.
//
// Usage:
//  - As a registered view "createOrUpdateWorkflow" (see ./index.ts), opened via
//    `invoke.createOrUpdateWorkflow.open/openAsync` (e.g. "Create Workflow").
//  - Rendered inline by <ViewResolver view="createOrUpdateWorkflow" ... /> (e.g.
//    workflow-panel "Edit" tab).
//
// Edit vs. create is decided solely by `workflow_id`:
//  - `workflow_id` set   -> edit mode; the form is ALWAYS (re)loaded from
//    `GET /workflow/:workflow_id/get-workflow`, so callers never pass a full object.
//  - `workflow_id` unset -> create mode; blank form (`relation_type` defaults to "tools").

import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Spin, Typography } from "antd";
import { FC, useEffect, useState } from "react";
import { http } from "@/api/client/http";
import { ComponentImageUpload } from "@/components/common/component-image";
import IOSchemaEditor, { normalizeIOSchema } from "@/components/script/io-schema-editor";
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

const toPrettyString = (value: any): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toFormValues = (relation: any) => ({
  name: relation?.name,
  dag_definition: toPrettyString(relation?.dag_definition),
  // normalized to an object so <IOSchemaEditor /> can edit it visually;
  // getParams() re-serializes it back to a JSON string on save.
  io_schema: normalizeIOSchema(relation?.io_schema),
  tags: normalizeTags(relation?.tags),
  category: relation?.category,
  img: relation?.img,
  order_index: relation?.order_index ?? 0,
  description: relation?.description,
});

const serializeJSON = (value: any, fallback = "[]") => {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const isNumeric = (value: any) =>
  value != null && value !== "" && /^\d+$/.test(String(value));

// ---------- component ----------

export type CreateOrUpdateWorkflowProps = {
  /** numeric workflow (db) id — present = edit mode, absent = create mode. */
  workflow_id?: string | number;
  /** relation type used when creating; ignored in edit mode (comes from the record). */
  relation_type?: string;
  /** re-invoked after a successful save (e.g. to refetch the list / panel) */
  callback?: (...args: any[]) => void;
  onOk?: (data?: any) => void;
  close?: () => void;
};

/** relation_type of workflows created from the list panels. */
const DEFAULT_RELATION_TYPE = "tools";

const CreateOrUpdateWorkflow: FC<CreateOrUpdateWorkflowProps> = ({
  workflow_id,
  relation_type,
  callback,
  onOk,
  close,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [relationType, setRelationType] = useState(relation_type ?? DEFAULT_RELATION_TYPE);
  const message = useGlobalMessage();

  // `workflow_id` is the single source of truth: edit mode always reloads the
  // record from the server, create mode just renders an empty form.
  const numericId = isNumeric(workflow_id) ? String(workflow_id) : undefined;
  const isEdit = Boolean(numericId);

  useEffect(() => {
    let active = true;
    if (!numericId) {
      setRelationType(relation_type ?? DEFAULT_RELATION_TYPE);
      form.resetFields();
      return;
    }
    setLoading(true);
    http
      .get(`/workflow/${numericId}/get-workflow`)
      .then((resp: any) => {
        if (!active) return;
        form.setFieldsValue(toFormValues(resp.data));
        setRelationType(resp.data?.relation_type || relation_type || DEFAULT_RELATION_TYPE);
      })
      .catch((error: any) => {
        if (!active) return;
        console.log(error);
        message.error(error?.response?.data?.detail ?? error?.message ?? "Failed to load workflow!");
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
    const payload: any = { ...values };
    payload.relation_type = relationType;
    if (Array.isArray(payload.tags)) {
      payload.tags = serializeJSON(payload.tags);
    }
    if (payload.dag_definition && typeof payload.dag_definition !== "string") {
      payload.dag_definition = serializeJSON(payload.dag_definition);
    }
    if (payload.io_schema && typeof payload.io_schema !== "string") {
      payload.io_schema = serializeJSON(payload.io_schema, "");
    }
    if (numericId) {
      // the numeric id selects the DB row; the backend keeps the existing uuid
      // (relation_id) on update, so there is no need to send workflow_id.
      payload.id = numericId;
    }
    return payload;
  };

  const savePipeline = async () => {
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return; // validation error, antd shows the messages
    }
    setLoading(true);
    try {
      const payload = getParams(values);
      const resp = await http.post("/workflow/save-workflow", payload);
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
        error?.response?.data?.detail ?? error?.message ?? "Save workflow failed!"
      );
    } finally {
      setLoading(false);
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
            <Button
              size="small"
              color="cyan"
              variant="solid"
              loading={loading}
              onClick={savePipeline}
            >
              {isEdit ? "Update" : "Create"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Please input name!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="dag_definition" label="DAG Definition">
            <Input.TextArea rows={4} spellCheck={false} />
          </Form.Item>

          <Form.Item name="io_schema" label="IO Schema (workflow inputs)">
            <IOSchemaEditor />
          </Form.Item>

          <Form.Item name="tags" label="Tags">
            <Select mode="tags" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Input />
          </Form.Item>

          {numericId && (
            <Form.Item name="img" label="Upload">
              <ComponentImageUpload kind="workflow" id={numericId} />
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

export default CreateOrUpdateWorkflow;

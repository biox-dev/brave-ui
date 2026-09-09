// src/components/workflow/create-or-update-workflow.tsx
// Standalone workflow create/update component.
//
// Usage:
//  - As a registered view "createOrUpdateWorkflow" (see ./index.ts), opened via
//    `invoke.createOrUpdateWorkflow.open/openAsync` (e.g. "Create Workflow").
//  - Rendered inline by <ViewResolver view="createOrUpdateWorkflow" ... /> (e.g.
//    workflow-panel "Edit Tools"). In that case the full workflow object is
//    passed in as `component` (aliased to `data`) so NO extra fetch API is called;
//    the form is prefilled from the passed data and "Update" saves it back.

import { Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Spin, Typography, Upload } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { FC, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { http } from "@/api/client/http";
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

// ---------- relation image upload ----------

const RelationImageUpload: FC<any> = ({ value, onChange, relation_id }) => {
  const { baseURL } = useSelector((state: any) => state.user);
  const [fileList, setFileList] = useState<any[]>([]);

  useEffect(() => {
    if (value) {
      setFileList([
        {
          uid: "-1",
          name: "relation.png",
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
      action={`${baseURL}/brave-api/component/relation-img-upload/${relation_id}`}
      onChange={({ file, fileList: list }) => {
        setFileList([file]);
        if (file.status === "done") {
          onChange(file.response?.url);
        }
      }}
    >
      <button
        type="button"
        style={{ border: 0, background: "none", cursor: "pointer" }}
      >
        <PlusOutlined />
        <div style={{ marginTop: 8 }}>Upload</div>
      </button>
    </Upload>
  );
};

// ---------- component ----------

export type CreateOrUpdateWorkflowProps = {
  /** existing workflow object (used when opened as a modal view) */
  data?: any;
  /** alias used when rendered through workflow-panel's <ViewResolver> which passes `component` */
  component?: any;
  /** { relation_type: string } — passed by workflow-panel "Edit Tools" */
  structure?: any;
  pipelineStructure?: any;
  namespace?: string;
  callback?: (...args: any[]) => void;
  onOk?: (data?: any) => void;
  close?: () => void;
};

const CreateOrUpdateWorkflow: FC<CreateOrUpdateWorkflowProps> = (params) => {
  const {
    data,
    component,
    structure,
    pipelineStructure,
    callback,
    onOk,
    close,
  } = params;

  // Editing data may arrive under either prop name.
  const relation = data ?? component;
  const relationType =
    structure?.relation_type ??
    pipelineStructure?.relation_type ??
    relation?.relation_type ??
    "tools";

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const message = useGlobalMessage();

  const relationKey = relation?.id ?? relation?.relation_id;

  // Prefill directly from the passed data — no fetch API is needed.
  useEffect(() => {
    if (relation) {
      form.setFieldsValue(toFormValues(relation));
    } else {
      form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationKey]);

  const getParams = (values: any) => {
    const payload: any = { ...values };
    payload.relation_type = relationType;
    if (Array.isArray(payload.tags)) {
      payload.tags = serializeJSON(payload.tags);
    }
    if (payload.dag_definition && typeof payload.dag_definition !== "string") {
      payload.dag_definition = serializeJSON(payload.dag_definition);
    }
    if (relation) {
      // update existing workflow: id selects the DB row, relation_id keeps its uuid
      payload.id = relation?.id != null ? String(relation.id) : undefined;
      payload.relation_id =
        relation?.relation_id ??
        relation?.workflow_id ??
        (relation?.id != null ? String(relation.id) : undefined);
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
      message.success(relation ? "Update success!" : "Create success!");
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
              {relation ? "Update" : "Create"}
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

          <Form.Item name="tags" label="Tags">
            <Select mode="tags" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="category" label="Category">
            <Input />
          </Form.Item>

          {relation?.relation_id && (
            <Form.Item name="img" label="Upload">
              <RelationImageUpload relation_id={relation.relation_id} />
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

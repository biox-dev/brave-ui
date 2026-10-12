import { useEffect, useState } from "react";
import { Button, Flex, Form, Select } from "antd";
import { updateFileApi } from "@/api/data";
import type { DatasetFileItem } from "@/api/data";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface EditDatasetFileRoleProps {
  file?: DatasetFileItem;
  onOk?: (result: unknown) => void;
  onCancel?: () => void;
  close?: () => void;
}

const ROLE_OPTIONS = [
  { label: "DEFAULT", value: "DEFAULT" },
  { label: "TABLE", value: "TABLE" },
  { label: "EXP", value: "EXP" },
  { label: "PHENOTYPE", value: "PHENOTYPE" },
];

const EditDatasetFileRole = ({ file, onOk, onCancel, close }: EditDatasetFileRoleProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const message = useGlobalMessage();

  useEffect(() => {
    if (file) {
      form.setFieldsValue({ role: file.role || "DEFAULT" });
    }
  }, [file, form]);

  const handleSubmit = async () => {
    if (!file) return;
    try {
      const values = await form.validateFields();
      setLoading(true);
      // Role lives on the file itself (go_file.role), so persist it through the
      // file update API. The other fields are echoed back unchanged so the
      // backend's non-empty update convention keeps the rest of the row intact.
      const result = await updateFileApi({
        id: file.id,
        path: file.path,
        file_name: file.file_name,
        description: file.description,
        format: file.format,
        storage: file.storage,
        role: values.role,
      });
      message.success("Role updated successfully");
      onOk?.(result);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error("Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (close) {
      close();
    }
  };

  if (!file) {
    return <div style={{ padding: 24, textAlign: "center" }}>No file data provided.</div>;
  }

  return (
    <Form form={form} layout="vertical">
      <Form.Item label="File Name">
        <div style={{ padding: "4px 0" }}>{file.file_name || file.file_id}</div>
      </Form.Item>
      <Form.Item label="Dataset">
        <div style={{ padding: "4px 0" }}>{file.dataset_name || "-"}</div>
      </Form.Item>
      <Form.Item name="role" label="Role" rules={[{ required: true, message: "Please select a role" }]}>
        <Select options={ROLE_OPTIONS} />
      </Form.Item>
      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          Save
        </Button>
      </Flex>
    </Form>
  );
};

export default EditDatasetFileRole;

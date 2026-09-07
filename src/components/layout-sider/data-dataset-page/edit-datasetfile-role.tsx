import { useEffect, useState } from "react";
import { Button, Flex, Form, Select } from "antd";
import { updateDatasetFileApi } from "@/api/data";
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
      const result = await updateDatasetFileApi({
        dataset_id: file.dataset_id,
        file_id: file.id,
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

import { useEffect, useState } from "react";
import { Button, Flex, Form, Input } from "antd";
import { updateFileApi } from "@/api/data";
import type { DatasetFileItem } from "@/api/data";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface EditFilePageProps {
  file?: DatasetFileItem;
  onOk?: (result: unknown) => void;
  onCancel?: () => void;
  close?: () => void;
}

const EditFilePage = ({ file, onOk, onCancel, close }: EditFilePageProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const message = useGlobalMessage();

  useEffect(() => {
    if (file) {
      form.setFieldsValue({
        file_name: file.file_name,
        description: file.description,
        format: file.format,
        storage: file.storage,
      });
    }
  }, [file, form]);

  const handleSubmit = async () => {
    if (!file) return;
    try {
      const values = await form.validateFields();
      setLoading(true);
      const result = await updateFileApi({
        id: file.id,
        ...values,
      });
      message.success("File updated successfully");
      onOk?.(result);
    } catch (error: any) {
      if (error?.errorFields) return; // validation error
      message.error("Failed to update file");
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
      <Form.Item label="File ID">
        <Input value={file.file_id} disabled />
      </Form.Item>
      <Form.Item label="Path">
        <Input value={file.path} disabled />
      </Form.Item>
      <Form.Item name="file_name" label="File Name" rules={[{ required: true, message: "Please input file name" }]}>
        <Input placeholder="Enter file name" />
      </Form.Item>
      <Form.Item name="format" label="Format">
        <Input placeholder="Enter format" />
      </Form.Item>
      <Form.Item name="storage" label="Storage">
        <Input placeholder="Enter storage" />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Enter description" />
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

export default EditFilePage;

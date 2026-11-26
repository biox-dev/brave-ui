import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Select } from "antd";
import { listFileRolesApi, updateFileApi } from "@/api/data";
import type { DatasetFileItem, RoleOption } from "@/api/data";
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
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const message = useGlobalMessage();

  // The valid roles are owned by the backend (types.Roles → /data/file/roles).
  useEffect(() => {
    let cancelled = false;
    listFileRolesApi()
      .then((response) => {
        if (!cancelled) setRoleOptions((response.data ?? []) as RoleOption[]);
      })
      .catch(() => {
        if (!cancelled) message.error("Failed to load roles");
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [message]);

  useEffect(() => {
    if (file) {
      form.setFieldsValue({
        path: file.path,
        file_name: file.file_name,
        description: file.description,
        format: file.format,
        storage: file.storage,
        role: file.role || undefined,
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
      <Form.Item
        name="path"
        label="Path"
        rules={[{ required: true, message: "Please input the absolute file path" }]}
        tooltip="Absolute path on the storage server. Editing it re-points this record at another file."
      >
        <Input placeholder="e.g. /data2/brave_analysis_workspace/data/<project_id>/sample1.fastq.gz" />
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
      <Form.Item
        name="role"
        label="Role"
        tooltip="The file's own role (go_file.role), used as the analysis_result key in workflow forms (DEFAULT / TABLE / DATABASE). The stored value is kept when left empty."
      >
        <Select
          allowClear
          placeholder="Select a role"
          options={roleOptions}
          loading={rolesLoading}
        />
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

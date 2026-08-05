import { useState } from "react";
import { Button, Checkbox, Flex, Form, Input, Select } from "antd";

export interface SelectFileRoleResult {
  role: string;
  file_name: string;
  is_copy: boolean;
}

export interface SelectFileRoleProps {
  onOk?: (result: SelectFileRoleResult) => void;
  onCancel?: () => void;
  close?: () => void;
  title?: string;
  defaultFileName?: string;
}

const SelectFileRole = ({
  onOk,
  onCancel,
  close,
  title,
  defaultFileName,
}: SelectFileRoleProps) => {
  const [selectedRole, setSelectedRole] = useState<string>("DEFAULT");
  const [fileName, setFileName] = useState<string>(defaultFileName || "");
  const [isCopy, setIsCopy] = useState<boolean>(false);

  const handleConfirm = () => {
    if (onOk) {
      onOk({
        role: selectedRole,
        file_name: fileName.trim(),
        is_copy: isCopy,
      });
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

  return (
    <div>
      <Form layout="vertical">
        <Form.Item label="File Name (optional)">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder={defaultFileName || "Leave empty to use original name"}
          />
        </Form.Item>
        <Form.Item label="Role">
          <Select
            value={selectedRole}
            onChange={(val) => setSelectedRole(val)}
            options={[
              { label: "TABLE", value: "TABLE" },
              { label: "DEFAULT", value: "DEFAULT" },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Checkbox checked={isCopy} onChange={(e) => setIsCopy(e.target.checked)}>
            Copy file to dataset directory
          </Checkbox>
        </Form.Item>
      </Form>
      <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" onClick={handleConfirm}>
          Confirm
        </Button>
      </Flex>
    </div>
  );
};

export default SelectFileRole;

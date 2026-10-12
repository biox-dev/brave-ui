// src/components/collected-file-upload/collected-file-upload.tsx
// Upload dialog for the collected form-item data list (CollectedFileList):
// choose a target dataset (via invoke.datasetProjectPage), a role (the item's
// resolver.accept_formats) and a local file, then upload it into the dataset
// workspace while showing a progress bar. Opened from CollectedFileList via
// `invoke.collectedFileUpload.openDrawerAsync({ resolver, defaultDatasetId })`.
import { useMemo, useState } from "react";
import { Button, Flex, Form, Progress, Select, Upload } from "antd";
import type { UploadFile } from "antd";
import { FolderOpenOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadFileToDatasetApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface CollectedFileUploadProps {
  title?: string;
  // resolver.accept_formats are the roles this form item accepts; they become
  // the role options ("this input accepts TABLE or DEFAULT").
  resolver?: { accept_formats?: string[] };
  // Pre-selects the dataset (e.g. the dataset of the collected data rows).
  defaultDatasetId?: string;
  defaultRole?: string;
  onOk?: (result: unknown) => void;
  onCancel?: () => void;
  close?: () => void;
}

const DEFAULT_ROLES = ["DEFAULT", "TABLE"];

const CollectedFileUpload = ({
  resolver,
  defaultDatasetId,
  defaultRole,
  onOk,
  onCancel,
  close,
}: CollectedFileUploadProps) => {
  const message = useGlobalMessage();
  const [datasetId, setDatasetId] = useState<string>(
    defaultDatasetId != null ? String(defaultDatasetId) : ""
  );
  const [datasetName, setDatasetName] = useState<string>("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);

  const roleOptions = useMemo(() => {
    const formats = resolver?.accept_formats;
    const list = Array.isArray(formats)
      ? formats.filter((format) => typeof format === "string" && format.trim() !== "")
      : [];
    return (list.length > 0 ? list : DEFAULT_ROLES).map((role) => ({
      label: role,
      value: role,
    }));
  }, [resolver]);

  const [role, setRole] = useState<string | undefined>(defaultRole ?? roleOptions[0]?.value);

  const handleSelectDataset = async () => {
    try {
      const dataset = await invoke.datasetProjectPage.openDrawerAsync(
        {},
        { width: 600, title: "Select Dataset" }
      );
      if (dataset?.id != null) {
        setDatasetId(String(dataset.id));
        setDatasetName(String(dataset.dataset_name || `Dataset-${dataset.id}`));
      }
    } catch {
      // user cancelled
    }
  };

  const handleUpload = async () => {
    if (!datasetId) {
      message.warning("Please select a dataset");
      return;
    }
    if (!file) {
      message.warning("Please select a file");
      return;
    }

    setUploading(true);
    setPercent(0);
    try {
      const resp = await uploadFileToDatasetApi(
        { dataset_id: datasetId, role: role || undefined, file },
        (value) => setPercent(value)
      );
      setPercent(100);
      message.success("File uploaded successfully");
      onOk?.(resp?.data);
    } catch {
      // the global error interceptor already surfaced the failure; keep the
      // dialog open so the user can retry.
      setPercent(0);
    } finally {
      setUploading(false);
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
        <Form.Item label="Dataset" required>
          <Flex gap="small" align="center">
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectDataset} disabled={uploading}>
              Select Dataset
            </Button>
            <span style={{ color: "var(--sharp-text-soft)" }}>
              {datasetName || (datasetId ? `Dataset-${datasetId}` : "No dataset selected")}
            </span>
          </Flex>
        </Form.Item>

        <Form.Item label="Role">
          <Select
            value={role}
            onChange={(value) => setRole(value)}
            options={roleOptions}
            disabled={uploading}
            placeholder="Select role"
          />
        </Form.Item>

        <Form.Item label="File" required>
          <Upload
            maxCount={1}
            fileList={fileList}
            beforeUpload={(selected) => {
              setFile(selected as unknown as File);
              setFileList([selected as unknown as UploadFile]);
              return false;
            }}
            onRemove={() => {
              setFile(null);
              setFileList([]);
              return true;
            }}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} disabled={uploading}>
              Select File
            </Button>
          </Upload>
        </Form.Item>

        {(uploading || percent > 0) && (
          <Form.Item>
            <Progress percent={percent} status={uploading ? "active" : "success"} />
          </Form.Item>
        )}
      </Form>

      <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
        <Button onClick={handleCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={!datasetId || !file}
          onClick={handleUpload}
        >
          Upload
        </Button>
      </Flex>
    </div>
  );
};

export default CollectedFileUpload;

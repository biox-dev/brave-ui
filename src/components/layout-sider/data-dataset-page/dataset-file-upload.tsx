// Upload files straight into one dataset: opened via
// `invoke.datasetFileUpload.open({ dataset_id, dataset_name, files, onUploaded })`
// from the dataset files panel, where the toolbar Upload button opens the OS
// file picker (multi-select). There is no dataset / role picker here: the
// dataset comes from the caller and the role falls back to the backend default
// (DEFAULT).
//
// Uploads go through /data/dataset-file/upload one file per request (the API
// already streams `onUploadProgress`); a few requests run in parallel and their
// loaded bytes are summed into a single percentage.
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button, Flex, Progress, Tooltip, Typography } from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  DeleteOutlined,
  FileOutlined,
  LoadingOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { uploadFileToDatasetApi } from "@/api/data";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/** 同时在途的上传请求数，避免一次选中几十个文件时打爆浏览器/后端。 */
const UPLOAD_CONCURRENCY = 3;

type UploadStatus = "pending" | "uploading" | "done" | "error";

/** 同名同大小同修改时间视为同一个文件（重选时据此去重）。 */
const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

const formatBytes = (size: number) => {
  if (!Number.isFinite(size) || size < 0) {
    return "-";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export interface DatasetFileUploadProps {
  /** 目标数据集（go_dataset.id）。 */
  dataset_id: string;
  /** 数据集名称，仅用于展示。 */
  dataset_name?: string;
  /** 文件选择框里选中的文件（由调用方传入）。 */
  files?: File[];
  /** 至少有一个文件上传成功后回调（列表刷新）。 */
  onUploaded?: () => void;
  onOk?: (result: unknown) => void;
  onCancel?: () => void;
  close?: () => void;
}

const DatasetFileUpload = ({
  dataset_id,
  dataset_name,
  files: initialFiles,
  onUploaded,
  onOk,
  onCancel,
  close,
}: DatasetFileUploadProps) => {
  const message = useGlobalMessage();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>(initialFiles ?? []);
  const [statuses, setStatuses] = useState<Record<string, UploadStatus>>({});
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  const handleClose = () => {
    if (uploading) {
      return;
    }
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  // 弹窗里继续追加文件（系统文件选择框，可多选）。
  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // 允许下次选择同一个文件时仍然触发 change。
    event.target.value = "";
    if (picked.length === 0) {
      return;
    }
    setFiles((prev) => {
      const merged = [...prev];
      picked.forEach((file) => {
        if (!merged.some((item) => fileKey(item) === fileKey(file))) {
          merged.push(file);
        }
      });
      return merged;
    });
    setStatuses((prev) => {
      const next = { ...prev };
      picked.forEach((file) => {
        if (!(fileKey(file) in next)) {
          next[fileKey(file)] = "pending";
        }
      });
      return next;
    });
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((item) => fileKey(item) !== fileKey(file)));
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[fileKey(file)];
      return next;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0 || uploading) {
      return;
    }

    setUploading(true);
    setPercent(0);

    const total = files.reduce((sum, file) => sum + file.size, 0);
    const loaded: Record<string, number> = {};
    files.forEach((file) => {
      loaded[fileKey(file)] = 0;
    });
    const updatePercent = () => {
      const sum = Object.values(loaded).reduce((acc, value) => acc + value, 0);
      setPercent(total > 0 ? Math.min(99, Math.round((sum / total) * 100)) : 0);
    };

    setStatuses(Object.fromEntries(files.map((file) => [fileKey(file), "pending" as UploadStatus])));

    const queue = [...files];
    const failedKeys = new Set<string>();
    let succeeded = 0;

    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const key = fileKey(file);
        setStatuses((prev) => ({ ...prev, [key]: "uploading" }));
        try {
          await uploadFileToDatasetApi({ dataset_id, file }, (value) => {
            loaded[key] = Math.round((file.size * value) / 100);
            updatePercent();
          });
          loaded[key] = file.size;
          succeeded += 1;
          setStatuses((prev) => ({ ...prev, [key]: "done" }));
        } catch {
          // 全局错误拦截器已经提示过一次，这里只标记该行并保留以便重试。
          failedKeys.add(key);
          setStatuses((prev) => ({ ...prev, [key]: "error" }));
        } finally {
          updatePercent();
        }
      }
    };

    const workers = Math.min(UPLOAD_CONCURRENCY, queue.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));

    setUploading(false);

    if (failedKeys.size === 0) {
      setPercent(100);
      message.success(`Uploaded ${succeeded} file(s)`);
      onUploaded?.();
      onOk?.({ uploaded: succeeded });
      close?.();
      return;
    }

    // 部分失败：移除已成功的文件，保留失败行让用户重试。
    setFiles((prev) => prev.filter((file) => failedKeys.has(fileKey(file))));
    setStatuses(Object.fromEntries(Array.from(failedKeys, (key) => [key, "error" as UploadStatus])));
    setPercent(0);
    if (succeeded > 0) {
      onUploaded?.();
    }
    message.warning(`Uploaded ${succeeded}, failed ${failedKeys.size}`);
  };

  return (
    <Flex vertical gap="small">
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handlePick}
      />

      <Flex align="center" justify="space-between" gap="small">
        <Typography.Text type="secondary">
          {dataset_name || "Dataset"} · {files.length} file(s) · {formatBytes(totalBytes)} · role DEFAULT
        </Typography.Text>
        <Button
          size="small"
          icon={<PlusOutlined />}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Add files
        </Button>
      </Flex>

      {files.length === 0 ? (
        <Typography.Text type="secondary">No files selected.</Typography.Text>
      ) : (
        <Flex vertical gap={4} style={{ maxHeight: 280, overflowY: "auto" }}>
          {files.map((file) => {
            const key = fileKey(file);
            const status = statuses[key] ?? "pending";
            return (
              <Flex key={key} align="center" gap={8}>
                <FileOutlined />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Typography.Text ellipsis style={{ display: "block" }} title={file.name}>
                    {file.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatBytes(file.size)}
                  </Typography.Text>
                </div>
                {status === "done" ? <CheckCircleFilled style={{ color: "#52c41a" }} /> : null}
                {status === "error" ? <CloseCircleFilled style={{ color: "#ff4d4f" }} /> : null}
                {status === "uploading" ? <LoadingOutlined /> : null}
                {!uploading ? (
                  <Tooltip title="Remove">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeFile(file)}
                    />
                  </Tooltip>
                ) : null}
              </Flex>
            );
          })}
        </Flex>
      )}

      {uploading || percent > 0 ? (
        <Progress percent={percent} status={uploading ? "active" : "success"} />
      ) : null}

      <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={files.length === 0}
          onClick={() => void handleUpload()}
        >
          Upload
        </Button>
      </Flex>
    </Flex>
  );
};

export default DatasetFileUpload;

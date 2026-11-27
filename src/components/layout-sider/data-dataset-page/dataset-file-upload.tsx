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
//
// 上传状态存放在 `dataset-upload-store`（按 dataset_id 会话化）：上传中可以随时
// 关闭弹窗，上传在 UI 后台继续，用户可继续操作界面；工具栏 Upload 按钮显示进度，
// 点击即可重新打开本弹窗查看进度。上传中存在 beforeunload 拦截，刷新/关闭浏览器
// 时会弹浏览器自带的确认框（取消 = 继续上传，确认离开 = 上传终止）。
import { useEffect, useRef } from "react";
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
import {
  attachUploadDialog,
  detachUploadDialog,
  setUploadCallback,
  uploadFileKey,
  useDatasetUploadStore,
} from "./dataset-upload-store";
import "./dataset-file-upload.css";

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
  /** 文件选择框里选中的文件（由调用方传入；重新打开弹窗时为空）。 */
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
  const inputRef = useRef<HTMLInputElement>(null);

  const session = useDatasetUploadStore((state) => state.sessions[dataset_id]);
  const ensure = useDatasetUploadStore((state) => state.ensure);
  const addFiles = useDatasetUploadStore((state) => state.addFiles);
  const removeFile = useDatasetUploadStore((state) => state.removeFile);
  const start = useDatasetUploadStore((state) => state.start);

  const files = session?.files ?? [];
  const statuses = session?.statuses ?? {};
  const uploading = session?.uploading ?? false;
  const percent = session?.percent ?? 0;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  /** 关闭弹窗：上传中关闭不会中断上传（会话保留在 store 里后台继续）。 */
  const closeDialog = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  // 挂载：复用（或创建）该数据集的上传会话，登记完成回调与「弹窗打开中」计数。
  // 重新打开弹窗时 initialFiles 为空，不能清空进行中的会话。
  useEffect(() => {
    setUploadCallback(dataset_id, onUploaded);
    ensure(dataset_id, dataset_name);
    if (initialFiles?.length) {
      addFiles(dataset_id, initialFiles);
    }
    attachUploadDialog(dataset_id);
    return () => {
      detachUploadDialog(dataset_id);
      // 关闭弹窗时若没有在途上传，丢弃会话（只选了文件没上传 / 上传已完成）。
      const current = useDatasetUploadStore.getState().sessions[dataset_id];
      if (current && !current.uploading) {
        useDatasetUploadStore.getState().dismiss(dataset_id);
      }
    };
    // initialFiles 只在打开弹窗那一次生效；依赖只放 dataset_id 避免重开时误清会话。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset_id]);

  // 上传全部完成：关闭弹窗（会话随卸载清理移除）。
  useEffect(() => {
    if (!session?.completed) {
      return;
    }
    onOk?.({ uploaded: session.succeeded });
    closeDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.completed]);

  /** 关闭请求：上传中也直接关闭，上传在后台继续。 */
  const requestClose = () => {
    closeDialog();
  };

  // 弹窗里继续追加文件（系统文件选择框，可多选）。
  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // 允许下次选择同一个文件时仍然触发 change。
    event.target.value = "";
    if (picked.length === 0) {
      return;
    }
    addFiles(dataset_id, picked);
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

      {/* 标题行（弹窗自带 X / Esc 可直接关闭；上传中关闭后上传在后台继续）。 */}
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
        // 只纵向滚动（横向溢出由旋转中的 loading 图标产生，见 dataset-file-upload.css）。
        <Flex vertical gap={4} className="dataset-upload-list">
          {files.map((file) => {
            const key = uploadFileKey(file);
            const status = statuses[key] ?? "pending";
            return (
              <Flex key={key} align="center" gap={8}>
                <FileOutlined />
                <div className="dataset-upload-item-text">
                  <Typography.Text ellipsis style={{ display: "block" }} title={file.name}>
                    {file.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatBytes(file.size)}
                  </Typography.Text>
                </div>
                {/* 固定宽度的状态槽位：状态切换不改变行宽，避免列表重排。 */}
                <span className="dataset-upload-item-status">
                  {status === "done" ? <CheckCircleFilled style={{ color: "#52c41a" }} /> : null}
                  {status === "error" ? <CloseCircleFilled style={{ color: "#ff4d4f" }} /> : null}
                  {status === "uploading" ? <LoadingOutlined /> : null}
                </span>
                {!uploading ? (
                  <Tooltip title="Remove">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeFile(dataset_id, key)}
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
        {/* 上传中的次按钮是「Close」：只关闭弹窗，上传在后台继续。 */}
        <Button onClick={requestClose}>{uploading ? "Close" : "Cancel"}</Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={files.length === 0}
          onClick={() => start(dataset_id)}
        >
          Upload
        </Button>
      </Flex>
    </Flex>
  );
};

export default DatasetFileUpload;

// src/components/collected-file-list/collected-file-list.tsx
// Detail list of the collected `data` of a form item (upstream analysis result
// files / assays). Opened from CollectedAssaySelect via
// `invoke.collectedFileList.openDrawerAsync({ data })`: pick a row to resolve the
// drawer with that item, or act on it in place (open sheet / edit / delete).
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Flex, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { DatasetFileItem } from "@/api/data";
import { deleteFileApi, getFileApi } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useStoreRender } from "@/context/render/RenderProvider";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface CollectedFileListProps {
  data?: DatasetFileItem[];
  title?: string;
  // resolver.accept_formats drives the role options of the upload dialog
  // (the roles this form item accepts).
  resolver?: { accept_formats?: string[] };
  // Live source for the collected data. This drawer is rendered by the global
  // UIContainer from a params *snapshot* captured when it opens, so it keeps the
  // `data` it was opened with and never re-renders when the upstream form
  // refreshes (e.g. after `loadParams`). When provided, the list subscribes and
  // re-syncs on every parent update, so edit/delete/upload stay reflected.
  subscribeData?: (listener: (data?: DatasetFileItem[]) => void) => () => void;
  onOk?: (file: DatasetFileItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const normalizeFiles = (value?: DatasetFileItem[]) => (Array.isArray(value) ? [...value] : []);

const formatBytes = (size?: number) => {
  if (typeof size !== "number" || !Number.isFinite(size)) {
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

const isSpreadsheetFile = (item: DatasetFileItem) => {
  const format = String(item.format ?? "").toLowerCase();
  if (["xlsx", "xls", "csv", "tsv"].includes(format)) {
    return true;
  }

  const path = String(item.path ?? "").toLowerCase();
  return [".xlsx", ".xls", ".csv", ".tsv"].some((ext) => path.endsWith(ext));
};

const CollectedFileList = ({
  data,
  title,
  resolver,
  subscribeData,
  onOk,
  onCancel,
  close,
}: CollectedFileListProps) => {
  const message = useGlobalMessage();
  const { loadParams } = useStoreRender();
  const [files, setFiles] = useState<DatasetFileItem[]>(() => normalizeFiles(data));
  const [selectedId, setSelectedId] = useState<string>();
  // The virtual table needs a concrete body height; measuring the scroll
  // container lets the table fill it exactly, so we get a single scrollbar
  // (the table's own) instead of an inner + outer pair.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState(480);

  // The list is seeded from the caller's form data; keep it in sync when the
  // drawer reopens with a different payload.
  useEffect(() => {
    setFiles(normalizeFiles(data));
  }, [data]);

  // The `data` prop is a snapshot from open time and never changes here, so also
  // subscribe to the live source: upstream refreshes triggered by `loadParams`
  // (upload/edit/delete, or any external change) then push the fresh list in.
  useEffect(() => {
    if (!subscribeData) return;
    return subscribeData((next) => setFiles(normalizeFiles(next)));
  }, [subscribeData]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setBodyHeight(Math.max(120, el.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const selectedItem = useMemo(
    () => files.find((item) => String(item.id) === String(selectedId)),
    [files, selectedId]
  );

  const handleOpenSheet = (item: DatasetFileItem) => {
    if (!isSpreadsheetFile(item)) {
      message.warning("This file format is not supported for opening");
      return;
    }

    invoke.univerView.open(
      { file_id: item.file_id },
      { width: "90%", title: `Sheet: ${item.file_name || item.file_id}`, footer: null }
    );
  };

  const handleEdit = async (record: DatasetFileItem) => {
    try {
      await invoke.editFilePage.openDrawerAsync(
        { file: record },
        { width: 480, title: `Edit File: ${record.file_name || record.file_id}` }
      );
    } catch {
      // user cancelled
      return;
    }

    // editFilePage resolves without the updated entity, so re-read this row.
    try {
      const resp = await getFileApi(record.id);
      const updated = resp?.data as any;
      if (updated) {
        setFiles((prev) =>
          prev.map((item) =>
            String(item.id) === String(record.id) ? ({ ...item, ...updated } as DatasetFileItem) : item
          )
        );
      }
    } catch {
      // the edit itself already succeeded; a refresh failure is not fatal
    }

    // 编辑后同步刷新上游表单参数，避免表单中仍使用旧的 data。
    await loadParams?.(true);
  };

  // Upload a local file into a dataset: the dialog handles dataset/role/file
  // selection and the multipart upload; once it resolves (upload done) refresh
  // the upstream form params so this list and the form pick up the new file.
  const handleUpload = async () => {
    try {
      await invoke.collectedFileUpload.openDrawerAsync(
        {
          title: `${title || "Files"} Upload`,
          resolver,
          defaultDatasetId: data?.[0]?.dataset_id ? String(data[0].dataset_id) : undefined,
        },
        { width: 520, title: `Upload to ${title || "Files"}` }
      );
    } catch {
      // user cancelled
      return;
    }

    await loadParams?.(true);
  };

  const handleDelete = async (record: DatasetFileItem) => {
    await deleteFileApi({ id: record.id });
    message.success("File deleted successfully");
    setFiles((prev) => prev.filter((item) => String(item.id) !== String(record.id)));
    // 删除后同步刷新上游表单参数，避免表单中仍引用已删除的 data。
    await loadParams?.(true);
  };

  const columns: ColumnsType<DatasetFileItem> = [
    {
      title: "File Name",
      dataIndex: "file_name",
      key: "file_name",
      width: 240,
      ellipsis: { showTitle: false },
      render: (name: string, record) => {
        const label = name || record.file_id || `File-${record.id}`;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileOutlined />
            <Tooltip placement="topLeft" title={label}>
              <span>{label}</span>
            </Tooltip>
          </span>
        );
      },
    },
    {
      title: "File ID",
      dataIndex: "file_id",
      key: "file_id",
      width: 180,
      ellipsis: true,
      render: (value: string) => value || "-",
    },
    {
      title: "Format",
      dataIndex: "format",
      key: "format",
      width: 90,
      render: (value: string) => value || "-",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 100,
      render: (value: string) => value || "-",
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 90,
      align: "right",
      render: (value: number) => formatBytes(value),
    },
    {
      title: "Path",
      dataIndex: "path",
      key: "path",
      width: 280,
      ellipsis: true,
      render: (value: string) => <Tooltip placement="topLeft" title={value || "-"}>{value || "-"}</Tooltip>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      align: "right",
      fixed: "right",
      render: (_: unknown, record) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Open Sheet">
            <Button
              type="text"
              size="small"
              icon={<TableOutlined />}
              onClick={() => handleOpenSheet(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this file?"
            description="This will remove the file and its relations."
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const handleConfirm = () => {
    if (selectedItem) {
      onOk?.(selectedItem);
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

  // Leave room for the header row and the horizontal scrollbar so the virtual
  // body fills the container without overflowing it.
  const virtualBodyHeight = Math.max(120, bodyHeight - 56);

  return (
    <div className="project-report-panel">
      <div
        className="project-report-panel-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span className="project-report-panel-title">{title || "Files"}</span>
        <Button size="small" icon={<UploadOutlined />} onClick={handleUpload}>
          Upload
        </Button>
      </div>

{/* {JSON.stringify(data)} */}
      {/* The table body is the only scroll container here: keep the outer panel
          body from scrolling so we do not stack a second scrollbar. */}
      <div className="project-report-panel-body" ref={bodyRef} style={{ overflow: "hidden" }}>
        {files.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No files" />
        ) : (
          <Table<DatasetFileItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={files}
            pagination={false}
            virtual
            scroll={{ x: 1180, y: virtualBodyHeight }}
            rowSelection={{
              type: "radio",
              fixed: true,
              selectedRowKeys: selectedId ? [selectedId] : [],
              onChange: (selectedRowKeys) => setSelectedId(String(selectedRowKeys[0] || "")),
            }}
            rowClassName={(record) =>
              String(record.id) === String(selectedId) ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              style: { cursor: "pointer" },
              onClick: () => setSelectedId(String(record.id)),
            })}
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <span style={{ color: "var(--sharp-text-soft)" }}>{files.length} files</span>
          <Flex gap="small">
            <Button size="small" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="small" type="primary" disabled={!selectedItem} onClick={handleConfirm}>
              Select
            </Button>
          </Flex>
        </Flex>
      </div>
    </div>
  );
};

export default CollectedFileList;

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Breadcrumb, Button, Empty, Flex, Popconfirm, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  TableOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import {
  deleteDatasetApi,
  deleteFileApi,
  ensureDatasetDirApi,
  importDatasetDirFilesApi,
  listDatasetFilesApi,
  pageDatasetByProjectApi,
} from "@/api/data";
import type {
  DatasetFileItem,
  DatasetFilePageQuery,
  DatasetItem,
  DatasetPageQuery,
  PageRequest,
  PageResponse,
} from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useUI } from "@/core/ui-system/useUI";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import SiderPanelLayout from "../common/sider-panel-layout";
import "./dataset-project-page.css";

/** 多选模式（`multiple`）下 Confirm 回传的结果：数据集与数据集内的文件。 */
export interface DatasetPickResult {
  datasets: DatasetItem[];
  files: DatasetFileItem[];
}

export interface DatasetProjectPageProps {
  project_id?: string;
  dataset_name?: string;
  description?: string;
  metadata?: string;
  page_size?: number | string;
  title?: string;
  /**
   * 多选模式：数据集页勾选数据集、进入数据集后勾选文件，Confirm 回传
   * `DatasetPickResult`。默认（单选）Confirm 回传单个 `DatasetItem`，
   * 保持既有调用方（sys-file / assay / 文件上传等）的契约不变。
   */
  multiple?: boolean;
  onOk?: (picked: DatasetItem | DatasetPickResult) => void;
  onCancel?: () => void;
  close?: () => void;
}

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePageSize = (value: number | string | undefined, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const datasetLabel = (item: DatasetItem) => item.dataset_name || `Dataset-${item.id}`;
const fileLabel = (item: DatasetFileItem) => item.file_name || item.file_id || `File-${item.id}`;

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
  if (["xlsx", "xlsm", "xls", "csv", "tsv"].includes(format)) {
    return true;
  }
  return [".xlsx", ".xlsm", ".xls", ".csv", ".tsv"].some((ext) =>
    String(item.path ?? "").toLowerCase().endsWith(ext)
  );
};

/** 文件夹 / 文件行：图标 + 名称 + 一行摘要，样式沿用侧栏的 project-report-item。 */
const ItemRow = ({ icon, title, meta }: { icon: ReactNode; title: string; meta?: string }) => (
  <div className="project-report-item">
    {icon}
    <div className="project-report-item-text">
      <span className="project-report-item-title" title={title}>
        {title}
      </span>
      {meta ? (
        <span className="project-report-item-meta" title={meta}>
          {meta}
        </span>
      ) : null}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 数据集列表（第一级）
// ---------------------------------------------------------------------------

interface DatasetListPanelProps {
  projectId?: string;
  filters: DatasetPageQuery;
  pageSize: number;
  selectable: boolean;
  multiple: boolean;
  selectedIds: string[];
  onSelectRows: (ids: string[], rows: DatasetItem[]) => void;
  onOpen: (dataset: DatasetItem) => void;
}

const DatasetListPanel = ({
  projectId,
  filters,
  pageSize,
  selectable,
  multiple,
  selectedIds,
  onSelectRows,
  onOpen,
}: DatasetListPanelProps) => {
  const message = useGlobalMessage();
  // 正在导入目录文件的数据集：只有该行按钮显示 loading。
  const [importingId, setImportingId] = useState<string>();

  const {
    items: datasets,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    reload,
    error,
    sentinelRef,
  } = useLazyList<DatasetItem, DatasetPageQuery>({
    fetcher: (payload) => pageDatasetByProjectApi(payload).then((response) => response.data),
    query: { project_id: projectId, ...filters },
    pageSize,
    scopeKey: JSON.stringify([projectId, filters]),
  });

  const isFetching = loading || loadingMore;

  const handleCreate = async () => {
    try {
      await invoke.editDatasetPage.openDrawerAsync({}, { width: 480, title: "New Dataset" });
      await reload();
    } catch {
      // user cancelled
    }
  };

  const handleEdit = async (record: DatasetItem) => {
    try {
      await invoke.editDatasetPage.openDrawerAsync(
        { dataset: record },
        { width: 720, title: `Edit Dataset: ${datasetLabel(record)}` }
      );
      await reload();
    } catch {
      // user cancelled
    }
  };

  const handleDelete = async (record: DatasetItem) => {
    try {
      await deleteDatasetApi({ id: record.id });
      message.success("Dataset deleted successfully");
      await reload();
    } catch {
      message.error("Failed to delete dataset");
    }
  };

  const handleEnsureDir = async (record: DatasetItem) => {
    try {
      const response = await ensureDatasetDirApi({ id: record.id });
      const dirPath = response.data?.path;
      message.success(dirPath ? `Dataset dir ready: ${dirPath}` : "Dataset dir ready");
    } catch {
      message.error("Failed to create dataset dir");
    }
  };

  // 把数据集工作目录下尚未绑定的文件批量登记为 go_file / go_dataset_file，
  // 后端按 path + dataset_id 判重，重复执行是幂等的。
  const handleImportDirFiles = async (record: DatasetItem) => {
    setImportingId(record.id);
    try {
      const response = await importDatasetDirFilesApi({ dataset_id: record.id });
      const result = response.data;
      const imported = result?.imported ?? 0;
      const skipped = result?.skipped ?? 0;
      const failed = result?.failed ?? 0;
      const summary = `Imported ${imported}, skipped ${skipped}${failed > 0 ? `, failed ${failed}` : ""}`;

      if (failed > 0) {
        message.warning(summary);
      } else {
        message.success(summary);
      }
      await reload();
    } catch {
      message.error("Failed to import dataset dir files");
    } finally {
      setImportingId(undefined);
    }
  };

  const columns: ColumnsType<DatasetItem> = [
    {
      title: "Dataset",
      dataIndex: "dataset_name",
      ellipsis: { showTitle: false },
      render: (_: string, record) => (
        <ItemRow
          icon={<FolderOpenOutlined className="project-report-item-icon" />}
          title={datasetLabel(record)}
          meta={[record.description, record.path].filter(Boolean).join(" · ") || undefined}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      align: "right",
      render: (_: unknown, record) => (
        <span className="project-report-item-actions" onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Create Dir">
            <Button type="text" size="small" icon={<FolderAddOutlined />} onClick={() => handleEnsureDir(record)} />
          </Tooltip>
          <Tooltip title="Import Dir Files">
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              loading={importingId === record.id}
              disabled={Boolean(importingId) && importingId !== record.id}
              onClick={() => handleImportDirFiles(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete this dataset?"
            description="This will also remove its project, file and sample associations."
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div className="dataset-project-panel-body">
      <div className="dataset-project-toolbar">
        <LazyListSearch value={keyword} onChange={setKeyword} placeholder="Search datasets" />
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
          New
        </Button>
        <Tooltip title="Refresh">
          <Button type="text" size="small" icon={<ReloadOutlined />} loading={isFetching} onClick={() => reload()} />
        </Tooltip>
      </div>

      {datasets.length === 0 && !isFetching ? (
        <div className="dataset-project-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "Failed to load datasets" : "No datasets"} />
        </div>
      ) : (
        <Table<DatasetItem>
          rowKey="id"
          size="small"
          showHeader={false}
          columns={columns}
          dataSource={datasets}
          loading={isFetching}
          pagination={false}
          scroll={{ x: 540 }}
          rowClassName={(record) => (selectedIds.includes(record.id) ? "project-report-row-selected" : "")}
          rowSelection={
            selectable
              ? {
                  type: multiple ? "checkbox" : "radio",
                  selectedRowKeys: selectedIds,
                  onChange: (keys, rows) => onSelectRows(keys.map(String), rows),
                }
              : undefined
          }
          onRow={(record) => ({
            // 点击数据集即「进入文件夹」；勾选 / 单选由左侧的选择列负责。
            onClick: (event) => {
              if ((event.target as HTMLElement | null)?.closest?.(".ant-table-selection-column")) {
                return;
              }
              onOpen(record);
            },
          })}
        />
      )}

      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={datasets.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more datasets", totalPrefix: "total " }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 数据集内的文件列表（第二级）
// ---------------------------------------------------------------------------

// /data/dataset/files 一次返回该数据集的全部文件（后端不分页），这里在本地做
// 关键字过滤 + 分页切片，既保留列表的滚动懒加载体验，又保证同一数据集只请求一次。
// 缓存放在调用方的 ref 里，刷新时清空即可重新拉取。
const createDatasetFilesFetcher = (
  datasetId: string,
  cache: { current: Promise<DatasetFileItem[]> | null }
) => {
  return (payload: PageRequest<DatasetFilePageQuery>): Promise<PageResponse<DatasetFileItem>> => {
    if (!cache.current) {
      const request = listDatasetFilesApi({ dataset_id: datasetId }).then((response) => response.data ?? []);
      cache.current = request;
      // 请求失败时不缓存，下次重试仍会真正发起请求。
      void request.catch(() => {
        if (cache.current === request) cache.current = null;
      });
    }

    return cache.current.then((all) => {
      const keyword = payload.keyword?.trim().toLowerCase();
      const matched = keyword
        ? all.filter((file) =>
            [file.file_name, file.file_id, file.path, file.role].some((value) =>
              String(value ?? "").toLowerCase().includes(keyword)
            )
          )
        : all;
      const page = payload.page ?? 1;
      const size = payload.page_size ?? 20;
      const start = (page - 1) * size;

      return {
        data: matched.slice(start, start + size),
        total: matched.length,
        page,
        page_size: size,
      };
    });
  };
};

interface DatasetFilesPanelProps {
  dataset: DatasetItem;
  pageSize: number;
  selectable: boolean;
  multiple: boolean;
  selectedIds: string[];
  onSelectRows: (ids: string[], rows: DatasetFileItem[]) => void;
  onToggle: (file: DatasetFileItem) => void;
}

const DatasetFilesPanel = ({
  dataset,
  pageSize,
  selectable,
  multiple,
  selectedIds,
  onSelectRows,
  onToggle,
}: DatasetFilesPanelProps) => {
  const message = useGlobalMessage();
  const { close: closeUI } = useUI();
  // 非分页接口的本地缓存（进入数据集只请求一次），刷新时清空。
  const cacheRef = useRef<Promise<DatasetFileItem[]> | null>(null);
  // 版本号：上传 / 编辑 / 删除后自增，触发列表重新拉取。
  const [version, setVersion] = useState(0);

  const fetcher = useMemo(() => createDatasetFilesFetcher(dataset.id, cacheRef), [dataset.id]);
  const {
    items: files,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    error,
    sentinelRef,
  } = useLazyList<DatasetFileItem, DatasetFilePageQuery>({
    fetcher,
    pageSize,
    scopeKey: dataset.id,
    reloadKey: version,
  });

  const refresh = () => {
    cacheRef.current = null;
    setVersion((value) => value + 1);
  };
  const isFetching = loading || loadingMore;

  const handleOpenSheet = (file: DatasetFileItem) => {
    if (!isSpreadsheetFile(file)) {
      message.warning("This file format is not supported for opening");
      return;
    }
    invoke.univerView.open(
      { file_id: file.file_id },
      { width: "90%", title: `Sheet: ${fileLabel(file)}`, footer: null }
    );
  };

  const handleEdit = async (file: DatasetFileItem) => {
    try {
      await invoke.editFilePage.openDrawerAsync(
        { file },
        { width: 480, title: `Edit File: ${fileLabel(file)}` }
      );
      refresh();
    } catch {
      // user cancelled
    }
  };

  const handleDelete = async (file: DatasetFileItem) => {
    try {
      await deleteFileApi({ id: file.id });
      message.success("File deleted successfully");
      refresh();
    } catch {
      message.error("Failed to delete file");
    }
  };

  const handleUpload = async () => {
    try {
      await invoke.collectedFileUpload.openDrawerAsync(
        { title: `Upload to ${datasetLabel(dataset)}`, defaultDatasetId: dataset.id },
        { width: 520, title: "Upload Files" }
      );
    } catch {
      // user cancelled
      return;
    }
    refresh();
  };

  // 打开系统文件浏览器；当前数据集的 id 会一并传入，里面点「Add To」
  // 直接把文件加到该数据集，不再弹数据集选择框。
  const handleOpenSysFileBrowser = () => {
    const id = invoke.sysFileBrowser.drawer(
      {
        type: "data",
        path: "/",
        defaultDatasetId: dataset.id,
        onFileAdded: refresh,
        onClose: () => {
          closeUI(id);
          refresh();
        },
      },
      { width: 640, title: `System Files: ${datasetLabel(dataset)}` }
    );
  };

  const columns: ColumnsType<DatasetFileItem> = [
    {
      title: "File",
      dataIndex: "file_name",
      ellipsis: { showTitle: false },
      render: (_: string, record) => (
        <ItemRow
          icon={<FileOutlined className="project-report-item-icon" />}
          title={fileLabel(record)}
          meta={[record.format, record.role, formatBytes(record.size)].filter(Boolean).join(" · ") || undefined}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      align: "right",
      render: (_: unknown, record) => (
        <span className="project-report-item-actions" onClick={(event) => event.stopPropagation()}>
          <Tooltip title="Open Sheet">
            <Button type="text" size="small" icon={<TableOutlined />} onClick={() => handleOpenSheet(record)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete this file?"
            description="This will remove the file and its dataset associations."
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div className="dataset-project-panel-body">
      <div className="dataset-project-toolbar">
        <LazyListSearch value={keyword} onChange={setKeyword} placeholder="Search files" />
        <Tooltip title="Upload">
          <Button type="text" size="small" icon={<UploadOutlined />} onClick={handleUpload} />
        </Tooltip>
        <Tooltip title="System Files">
          <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={handleOpenSysFileBrowser} />
        </Tooltip>
        <Tooltip title="Refresh">
          <Button type="text" size="small" icon={<ReloadOutlined />} loading={isFetching} onClick={refresh} />
        </Tooltip>
      </div>

      {files.length === 0 && !isFetching ? (
        <div className="dataset-project-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "Failed to load files" : "No files"} />
        </div>
      ) : (
        <Table<DatasetFileItem>
          rowKey="id"
          size="small"
          showHeader={false}
          columns={columns}
          dataSource={files}
          loading={isFetching}
          pagination={false}
          scroll={{ x: 520 }}
          rowClassName={(record) => (selectedIds.includes(record.id) ? "project-report-row-selected" : "")}
          rowSelection={
            selectable && multiple
              ? {
                  type: "checkbox",
                  selectedRowKeys: selectedIds,
                  onChange: (keys, rows) => onSelectRows(keys.map(String), rows),
                }
              : undefined
          }
          onRow={(record) => ({
            onClick: (event) => {
              if ((event.target as HTMLElement | null)?.closest?.(".ant-table-selection-column")) {
                return;
              }
              // 选择器里点文件即勾选；浏览态点文件直接打开表格。
              if (selectable && multiple) {
                onToggle(record);
                return;
              }
              handleOpenSheet(record);
            },
          })}
        />
      )}

      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={files.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more files", totalPrefix: "total " }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 页面：数据集列表 <-> 数据集内文件（面包屑返回）
// ---------------------------------------------------------------------------

/**
 * 数据集浏览器（替代原数据集表格页与 `dataset-file-page`）。
 *
 * 结构类似文件夹：
 * - 第一级懒加载展示当前项目下的数据集；
 * - 点击数据集进入第二级，懒加载展示该数据集绑定的文件；
 * - 顶部面包屑 + 返回按钮回到数据集列表。
 *
 * 选择模式：
 * - 单选（默认）：Confirm 回传选中的 `DatasetItem`（既有调用方契约）；
 * - `multiple`：可同时勾选多个数据集，也可进入数据集勾选文件，Confirm 回传
 *   `DatasetPickResult`（Agent 输入区的引用插入依赖这个模式）。
 */
const DatasetProjectPage = ({
  project_id,
  dataset_name,
  description,
  metadata,
  page_size,
  title,
  multiple = false,
  onOk,
  onCancel,
  close,
}: DatasetProjectPageProps) => {
  // 后端按「当前用户激活的项目」查询，这里的 project_id 只沿用旧的查询形状。
  const { projectId } = useSelector((state: { user: { projectId?: string } }) => state.user);
  const selectable = Boolean(onOk || onCancel);

  const [activeDataset, setActiveDataset] = useState<DatasetItem>();
  const [pickedDatasets, setPickedDatasets] = useState<Record<string, DatasetItem>>({});
  const [pickedFiles, setPickedFiles] = useState<Record<string, DatasetFileItem>>({});

  const resolvedProjectId = useMemo(
    () => normalizeText(project_id) ?? projectId,
    [project_id, projectId]
  );
  const filters = useMemo<DatasetPageQuery>(
    () => ({
      dataset_name: normalizeText(dataset_name),
      description: normalizeText(description),
      metadata: normalizeText(metadata),
    }),
    [dataset_name, description, metadata]
  );

  const datasetIds = Object.keys(pickedDatasets);
  const fileIds = Object.keys(pickedFiles);
  const totalPicked = datasetIds.length + fileIds.length;

  // 保留不在当前页的已选项（跨页勾选），因此用 id 合并而不是直接覆盖。
  const selectDatasets = (ids: string[], rows: DatasetItem[]) => {
    setPickedDatasets((prev) => {
      if (!multiple) {
        const first = rows[0] ?? (ids[0] ? prev[ids[0]] : undefined);
        return first ? { [first.id]: first } : {};
      }
      const next: Record<string, DatasetItem> = {};
      ids.forEach((id) => {
        const item = prev[id] ?? rows.find((row) => row.id === id);
        if (item) next[id] = item;
      });
      return next;
    });
  };

  const selectFiles = (ids: string[], rows: DatasetFileItem[]) => {
    setPickedFiles((prev) => {
      const next: Record<string, DatasetFileItem> = {};
      ids.forEach((id) => {
        const item = prev[id] ?? rows.find((row) => row.id === id);
        if (item) next[id] = item;
      });
      return next;
    });
  };

  const toggleFile = (file: DatasetFileItem) => {
    setPickedFiles((prev) => {
      const next = { ...prev };
      if (next[file.id]) {
        delete next[file.id];
      } else {
        next[file.id] = file;
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (!onOk || totalPicked === 0) {
      return;
    }
    if (!multiple) {
      onOk(Object.values(pickedDatasets)[0]);
      return;
    }
    onOk({ datasets: Object.values(pickedDatasets), files: Object.values(pickedFiles) });
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  return (
    <SiderPanelLayout
      className="dataset-project-panel"
      title={activeDataset ? datasetLabel(activeDataset) : title || "Datasets"}
      actions={
        activeDataset ? (
          <Tooltip title="Back to datasets">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              aria-label="Back to datasets"
              onClick={() => setActiveDataset(undefined)}
            />
          </Tooltip>
        ) : undefined
      }
      footer={
        selectable ? (
          <Flex align="center" justify="space-between" gap="small" style={{ width: "100%" }}>
            <span className="dataset-project-picked">
              {multiple ? `${datasetIds.length} dataset(s) · ${fileIds.length} file(s)` : ""}
            </span>
            <Flex gap="small">
              <Button size="small" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="small" type="primary" disabled={totalPicked === 0} onClick={handleConfirm}>
                {multiple && totalPicked > 0 ? `Confirm (${totalPicked})` : "Confirm"}
              </Button>
            </Flex>
          </Flex>
        ) : undefined
      }
    >
      {activeDataset ? (
        <>
          <Breadcrumb
            className="dataset-project-breadcrumb"
            items={[
              { title: <Typography.Link onClick={() => setActiveDataset(undefined)}>Datasets</Typography.Link> },
              { title: datasetLabel(activeDataset) },
            ]}
          />
          <DatasetFilesPanel
            key={activeDataset.id}
            dataset={activeDataset}
            pageSize={normalizePageSize(page_size, 20)}
            selectable={selectable}
            multiple={multiple}
            selectedIds={fileIds}
            onSelectRows={selectFiles}
            onToggle={toggleFile}
          />
        </>
      ) : (
        <DatasetListPanel
          projectId={resolvedProjectId}
          filters={filters}
          pageSize={normalizePageSize(page_size, 10)}
          selectable={selectable}
          multiple={multiple}
          selectedIds={datasetIds}
          onSelectRows={selectDatasets}
          onOpen={setActiveDataset}
        />
      )}
    </SiderPanelLayout>
  );
};

export default DatasetProjectPage;

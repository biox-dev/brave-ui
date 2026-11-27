import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useSelector } from "react-redux";
import { Breadcrumb, Button, Empty, Flex, Modal, Popconfirm, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  ImportOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import {
  addSharedDatasetToProjectApi,
  deleteDatasetApi,
  deleteFileApi,
  ensureDatasetDirApi,
  importDatasetDirFilesApi,
  listDatasetFilesApi,
  pageDatasetByProjectApi,
  pageSharedDatasetApi,
} from "@/api/data";
import type {
  DatasetFileItem,
  DatasetFilePageQuery,
  DatasetItem,
  DatasetPageQuery,
  PageRequest,
  PageResponse,
  SharedDatasetItem,
} from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useUI } from "@/core/ui-system/useUI";
import { useUIStore } from "@/core/ui-system/ui.store";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import {
  DATASET_FILE_TAB_KEY_PREFIX,
  useActiveWorkspaceResourceId,
  useWorkspaceOpener,
  type WorkspaceOpenTarget,
} from "@/layout/workspace-navigation";
import type { DatasetPathInfo } from "@/store/userSlice";
import AskAgentButton from "../common/ask-agent-button";
import SiderPanelLayout from "../common/sider-panel-layout";
import { useDatasetProjectPath } from "./use-dataset-project-path";
import { setUploadCallback, useDatasetUploadStore } from "./dataset-upload-store";
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
  /**
   * 是否把当前浏览路径（已进入的数据集）持久化到 localStorage：
   * 刷新浏览器或切换左侧面板后再回来仍停在上次的数据集里。
   * 选择器模式（传了 onOk / onCancel 的抽屉）自动不持久化，默认开启。
   */
  persistPath?: boolean;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
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

// ---------------------------------------------------------------------------
// 浏览路径：记住「当前进入的数据集」，状态存 redux `user.datasetPath`
// （reducer 内同步 localStorage），刷新浏览器 / 切换面板后恢复。
// 快照只带数据集名称等展示字段，文件列表仍按 id 重新拉取。
// ---------------------------------------------------------------------------

const toDatasetItem = (info?: DatasetPathInfo | null): DatasetItem | undefined =>
  info?.id
    ? {
        id: info.id,
        dataset_name: info.dataset_name ?? "",
        description: info.description ?? "",
        metadata: info.metadata ?? "",
        created_at: "",
        updated_at: "",
      }
    : undefined;

/**
 * 数据集文件的「打开方式」统一描述：
 * - Agent 会话页：在右侧 MainTabs 用 fileView 视图打开标签；
 * - 其它页面：路由跳转到 /dataset-file/:id（文件查看详情页）。
 *
 * 不做格式判断，任何文件都能打开：表格 / 文本直接预览，二进制格式显示不可预览提示。
 * `file_id` 是 go_file 主键（`id` 是 go_dataset_file 关联行），预览接口与路由 :id 都用它。
 */
const buildDatasetFileTarget = (file: DatasetFileItem): WorkspaceOpenTarget => ({
  view: "filePreview",
  title: fileLabel(file),
  tabKeyPrefix: DATASET_FILE_TAB_KEY_PREFIX,
  resourceId: String(file.file_id),
  params: { file_id: String(file.file_id) },
  routePath: `/dataset-file/${encodeURIComponent(String(file.file_id))}`,
});

// ---------------------------------------------------------------------------
// 工具栏 Upload：点击直接拉起系统文件选择框（可多选），选中的文件交给
// `invoke.datasetFileUpload` 弹窗上传。数据集固定为当前数据集，角色走后端
// 默认值（DEFAULT），不再让用户选 dataset / role。
//
// 上传状态保存在 `dataset-upload-store`：上传中关掉弹窗后仍在后台继续，
// 此时按钮显示百分比，点击直接重新打开弹窗查看进度（不再拉起文件选择框）。
// ---------------------------------------------------------------------------

interface DatasetUploadButtonProps {
  datasetId: string;
  datasetName: string;
  /** 至少上传成功一个文件后刷新文件列表。 */
  onUploaded: () => void;
}

const DatasetUploadButton = ({ datasetId, datasetName, onUploaded }: DatasetUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = useDatasetUploadStore(
    (state) => state.sessions[datasetId]?.uploading ?? false
  );
  const percent = useDatasetUploadStore((state) => state.sessions[datasetId]?.percent ?? 0);

  const openDialog = (files?: File[]) => {
    // 回调每次打开都刷新，保证上传完成时刷新的是当前列表。
    setUploadCallback(datasetId, onUploaded);
    if (files?.length) {
      useDatasetUploadStore.getState().addFiles(datasetId, files);
    } else {
      useDatasetUploadStore.getState().ensure(datasetId, datasetName);
    }

    // 同一个数据集的弹窗已经打开时不再重复打开（只把文件追加进会话）。
    const alreadyOpen = useUIStore
      .getState()
      .stack.some(
        (item) =>
          item.visible && item.view === "datasetFileUpload" && item.params?.dataset_id === datasetId
      );
    if (alreadyOpen) {
      return;
    }

    invoke.datasetFileUpload.open(
      { dataset_id: datasetId, dataset_name: datasetName, onUploaded },
      { title: `Upload to ${datasetName}`, width: 560, footer: null, maskClosable: false }
    );
  };

  const handlePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // 清空 value，保证下次选同一个文件也能触发 change。
    event.target.value = "";
    if (picked.length === 0) {
      return;
    }
    openDialog(picked);
  };

  // 后台上传中：按钮显示进度，点击重新打开上传弹窗。
  if (uploading) {
    return (
      <Tooltip title={`Uploading ${percent}% · click to view`}>
        <Button
          type="text"
          size="small"
          aria-label="Upload"
          onClick={() => openDialog()}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <LoadingOutlined />
          <span style={{ fontSize: 12 }}>{percent}%</span>
        </Button>
      </Tooltip>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handlePick}
      />
      <Tooltip title="Upload">
        <Button
          type="text"
          size="small"
          icon={<UploadOutlined />}
          aria-label="Upload"
          onClick={() => inputRef.current?.click()}
        />
      </Tooltip>
    </>
  );
};

/** 文件夹 / 文件行：图标 + 名称 + 一行摘要，样式沿用侧栏的 project-report-item。
 *
 * `actions` 放在行尾并始终占据布局宽度（悬浮行时淡入），文字在按钮前截断，
 * 不会出现按钮盖住文字的情况，也不单独占用一整列。
 */
const ItemRow = ({
  icon,
  title,
  meta,
  actions,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  actions?: ReactNode;
}) => (
  <div className="project-report-item dataset-project-item">
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
    {actions ? (
      <span
        className="project-report-item-actions dataset-project-item-actions"
        onClick={(event) => event.stopPropagation()}
      >
        {actions}
      </span>
    ) : null}
  </div>
);

// ---------------------------------------------------------------------------
// 共享数据集选择弹窗：列出所有 shared dataset，勾选后绑定到当前激活项目
// （go_project_dataset）。已绑定的行禁用勾选，重复导入是幂等的。
// ---------------------------------------------------------------------------

interface SharedDatasetPickerProps {
  open: boolean;
  onClose: () => void;
  /** 导入成功后回调（对应列表刷新）。 */
  onImported: () => void;
}

const SharedDatasetPicker = ({ open, onClose, onImported }: SharedDatasetPickerProps) => {
  const message = useGlobalMessage();
  const [items, setItems] = useState<SharedDatasetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 输入防抖，避免每敲一个字都打一次接口。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(keywordInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await pageSharedDatasetApi({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
      });
      setItems(response.data?.data ?? []);
      setTotal(response.data?.total ?? 0);
    } catch {
      message.error("Failed to load shared datasets");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [keyword, message, page, pageSize]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  // 每次打开都重置勾选与搜索条件。
  useEffect(() => {
    if (open) {
      setSelectedIds([]);
      setKeywordInput("");
      setKeyword("");
      setPage(1);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      message.warning("Select at least one shared dataset");
      return;
    }

    setSubmitting(true);
    try {
      const response = await addSharedDatasetToProjectApi({ dataset_ids: selectedIds });
      const added = response.data?.added ?? 0;
      const skipped = response.data?.skipped ?? 0;
      message.success(`Added ${added} shared dataset(s)${skipped > 0 ? `, skipped ${skipped}` : ""}`);
      onImported();
      onClose();
    } catch {
      message.error("Failed to add shared datasets to the project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Import Shared Datasets"
      okText="Add to Project"
      confirmLoading={submitting}
      onOk={handleConfirm}
      onCancel={onClose}
      width={640}
    >
      <Flex vertical gap="small">
        <LazyListSearch
          value={keywordInput}
          onChange={setKeywordInput}
          placeholder="Search shared datasets"
        />
        <Table<SharedDatasetItem>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={items}
          pagination={{
            current: page,
            pageSize,
            total,
            size: "small",
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No shared datasets" /> }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys.map(String)),
            getCheckboxProps: (record) => ({ disabled: record.bound }),
          }}
          columns={[
            {
              title: "Dataset",
              dataIndex: "dataset_name",
              render: (_: string, record) => (
                <Flex align="center" gap={8}>
                  <span>{datasetLabel(record)}</span>
                  {record.bound ? <Tag color="green">Added</Tag> : <Tag>Shared</Tag>}
                </Flex>
              ),
            },
            {
              title: "Description",
              dataIndex: "description",
              ellipsis: true,
              render: (value: string) => value || "-",
            },
          ]}
        />
      </Flex>
    </Modal>
  );
};

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
  /** 面板标题（默认 Datasets）。 */
  title?: string;
  /** 选择器模式下由页面注入的底部操作区。 */
  footer?: ReactNode;
  /** 纵向堆叠折叠时停止列表请求。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态。 */
  onToggleCollapse?: () => void;
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
  title,
  footer,
  collapsed = false,
  onToggleCollapse,
}: DatasetListPanelProps) => {
  const message = useGlobalMessage();

  // 共享数据集导入弹窗（列出所有 shared dataset，勾选后绑定到当前项目）。
  const [sharedPickerOpen, setSharedPickerOpen] = useState(false);

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
    enabled: !collapsed,
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

  const columns: ColumnsType<DatasetItem> = [
    {
      title: "Dataset",
      dataIndex: "dataset_name",
      render: (_: string, record) => (
        <ItemRow
          icon={<FolderOpenOutlined className="project-report-item-icon" />}
          title={datasetLabel(record)}
          meta={record.description || undefined}
          actions={
            <>
              {/* 把数据集作为 @dataset:<id> 引用插进 Agent 输入框（Agent 侧用 get_dataset 解析工作目录）。 */}
              <AskAgentButton
                kind="dataset"
                id={record.id}
                label={datasetLabel(record)}
              />
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
            </>
          }
        />
      ),
    },
  ];

  return (
    <>
      <SiderPanelLayout
        className="dataset-project-panel"
        bodyClassName="dataset-project-panel-body"
        title={title || "Datasets"}
        titleExtra={total > 0 ? <span className="sider-panel-count">{total}</span> : undefined}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        footer={footer}
        actions={
          <>
            <LazyListSearch
              value={keyword}
              onChange={setKeyword}
              placeholder="Search datasets"
              className="project-report-panel-search"
            />
            {/* 打开共享数据集选择弹窗，确认后把 shared dataset 绑定到当前项目。 */}
            <Tooltip title="Import Shared Dataset">
              <Button
                type="text"
                size="small"
                icon={<ImportOutlined />}
                onClick={() => setSharedPickerOpen(true)}
              />
            </Tooltip>
            <Tooltip title="New Dataset">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreate} />
            </Tooltip>
            <Tooltip title="Refresh">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                loading={isFetching}
                onClick={() => reload()}
              />
            </Tooltip>
          </>
        }
      >
        {datasets.length === 0 && !isFetching ? (
          <div className="dataset-project-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "Failed to load datasets" : "No datasets"} />
          </div>
        ) : (
          <Table<DatasetItem>
            rowKey="id"
            size="small"
            showHeader={false}
            tableLayout="fixed"
            columns={columns}
            dataSource={datasets}
            loading={isFetching}
            pagination={false}
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
      </SiderPanelLayout>

      <SharedDatasetPicker
        open={sharedPickerOpen}
        onClose={() => setSharedPickerOpen(false)}
        onImported={() => {
          void reload();
        }}
      />
    </>
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
  /** 返回数据集列表。 */
  onBack: () => void;
  /** 选择器模式下由页面注入的底部操作区。 */
  footer?: ReactNode;
  /** 纵向堆叠折叠时停止列表请求。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态。 */
  onToggleCollapse?: () => void;
}

const DatasetFilesPanel = ({
  dataset,
  pageSize,
  selectable,
  multiple,
  selectedIds,
  onSelectRows,
  onToggle,
  onBack,
  footer,
  collapsed = false,
  onToggleCollapse,
}: DatasetFilesPanelProps) => {
  const message = useGlobalMessage();
  const { close: closeUI } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  // 当前是否在 Agent 会话页：是则点文件在右侧 MainTabs 打开标签，否则路由跳转。
  const openTarget = useWorkspaceOpener();
  // 会话页右侧正在显示的文件 / 路由 /dataset-file/:id 都算选中（行高亮与详情保持一致）。
  const workspaceSelectedFileId = useActiveWorkspaceResourceId(DATASET_FILE_TAB_KEY_PREFIX);
  const routeSelectedFileId = useMemo(() => {
    const match = location.pathname.match(/\/dataset-file\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);
  // 非分页接口的本地缓存（进入数据集只请求一次），刷新时清空。
  const cacheRef = useRef<Promise<DatasetFileItem[]> | null>(null);
  // 版本号：上传 / 编辑 / 删除后自增，触发列表重新拉取。
  const [version, setVersion] = useState(0);
  // 正在导入目录文件：按钮显示 loading。
  const [importing, setImporting] = useState(false);

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
    enabled: !collapsed,
  });

  const refresh = () => {
    cacheRef.current = null;
    setVersion((value) => value + 1);
  };
  const isFetching = loading || loadingMore;

  const handleOpenSheet = (file: DatasetFileItem) => {
    // 会话页开右侧标签，其它页面路由跳转（统一入口）；不限制文件格式。
    openTarget(buildDatasetFileTarget(file));
  };

  /** Actions 里的「眼睛」始终路由跳转（与行点击的区别：不依赖当前页面）。 */
  const handleOpenSheetRoute = (file: DatasetFileItem) => {
    navigate(buildDatasetFileTarget(file).routePath);
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

  const handleEnsureDir = async () => {
    try {
      const response = await ensureDatasetDirApi({ id: dataset.id });
      const dirPath = response.data?.path;
      message.success(dirPath ? `Dataset dir ready: ${dirPath}` : "Dataset dir ready");
    } catch {
      message.error("Failed to create dataset dir");
    }
  };

  // 把数据集工作目录下尚未绑定的文件批量登记为 go_file / go_dataset_file，
  // 后端按 path + dataset_id 判重，重复执行是幂等的。
  const handleImportDirFiles = async () => {
    setImporting(true);
    try {
      const response = await importDatasetDirFilesApi({ dataset_id: dataset.id });
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
      refresh();
    } catch {
      message.error("Failed to import dataset dir files");
    } finally {
      setImporting(false);
    }
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
      render: (_: string, record) => (
        <ItemRow
          icon={<FileOutlined className="project-report-item-icon" />}
          title={fileLabel(record)}
          meta={[record.format, record.role, formatBytes(record.size)].filter(Boolean).join(" · ") || undefined}
          actions={
            <>
              {/* 把数据集文件作为 @file:<id> 引用插进 Agent 输入框（Agent 侧用 get_file 解析路径）。
                  file 引用用的是关联行 id（agent-sender 选文件时同此），不是 file_id。 */}
              <AskAgentButton
                kind="file"
                id={record.id}
                label={fileLabel(record)}
              />
              {/* 详情内容（表格查看）由行点击在右侧标签/路由页打开，列表保留查看 + 编辑 + 删除。 */}
              <Tooltip title="Open Sheet">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => handleOpenSheetRoute(record)}
                />
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
            </>
          }
        />
      ),
    },
  ];

  return (
    <SiderPanelLayout
      className="dataset-project-panel"
      bodyClassName="dataset-project-panel-body"
      title={datasetLabel(dataset)}
      titleExtra={total > 0 ? <span className="sider-panel-count">{total}</span> : undefined}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      footer={footer}
      subHeader={
        <Breadcrumb
          className="dataset-project-breadcrumb"
          items={[
            { title: <Typography.Link onClick={onBack}>Datasets</Typography.Link> },
            { title: datasetLabel(dataset) },
          ]}
        />
      }
      actions={
        <>
          <Tooltip title="Back to datasets">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              aria-label="Back to datasets"
              onClick={onBack}
            />
          </Tooltip>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search files"
            className="project-report-panel-search"
          />
          <Tooltip title="Create Dir">
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined />}
              aria-label="Create Dir"
              onClick={handleEnsureDir}
            />
          </Tooltip>
          <Tooltip title="Import Dir Files">
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              aria-label="Import Dir Files"
              loading={importing}
              onClick={handleImportDirFiles}
            />
          </Tooltip>
          {/* 直接打开系统文件选择框（可多选），确认后在弹窗里逐个上传并显示进度；
              数据集固定为当前数据集，角色走后端默认值 DEFAULT。 */}
          <DatasetUploadButton
            datasetId={dataset.id}
            datasetName={datasetLabel(dataset)}
            onUploaded={refresh}
          />
          <Tooltip title="System Files">
            <Button
              type="text"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={handleOpenSysFileBrowser}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={refresh}
            />
          </Tooltip>
        </>
      }
    >
      {files.length === 0 && !isFetching ? (
        <div className="dataset-project-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "Failed to load files" : "No files"} />
        </div>
      ) : (
        <Table<DatasetFileItem>
          rowKey="id"
          size="small"
          showHeader={false}
          tableLayout="fixed"
          columns={columns}
          dataSource={files}
          loading={isFetching}
          pagination={false}
          rowClassName={(record) =>
            selectedIds.includes(record.id) ||
            String(record.file_id) === String(workspaceSelectedFileId) ||
            String(record.file_id) === String(routeSelectedFileId)
              ? "project-report-row-selected"
              : ""
          }
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
              // 选择器里点文件即勾选；浏览态点文件在右侧标签（会话页）/ 路由页打开。
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
    </SiderPanelLayout>
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
  persistPath = true,
  collapsed = false,
  onToggleCollapse,
}: DatasetProjectPageProps) => {
  // 后端按「当前用户激活的项目」查询，这里的 project_id 只沿用旧的查询形状。
  const { projectId } = useSelector((state: { user: { projectId?: string } }) => state.user);
  const selectable = Boolean(onOk || onCancel);
  // 选择器抽屉不复用上次路径（否则一打开就停在某个数据集里）。
  const shouldPersistPath = persistPath && !selectable;

  // 浏览路径：redux `user.datasetPath`（同步 localStorage），与左侧栏折叠态同一套路。
  const [storedDatasetPath, setStoredDatasetPath] = useDatasetProjectPath();

  const [activeDataset, setActiveDataset] = useState<DatasetItem | undefined>(() =>
    shouldPersistPath ? toDatasetItem(storedDatasetPath) : undefined
  );
  const [pickedDatasets, setPickedDatasets] = useState<Record<string, DatasetItem>>({});
  const [pickedFiles, setPickedFiles] = useState<Record<string, DatasetFileItem>>({});

  const resolvedProjectId = useMemo(
    () => normalizeText(project_id) ?? projectId,
    [project_id, projectId]
  );

  // 切换项目：上次进入的数据集属于旧项目，回到数据集列表并清空已勾选项。
  // 列表数据由 DatasetListPanel 的 `scopeKey`（含 projectId）变化自动重新拉取，无需额外请求。
  // 首次拿到项目 ID（"" → 项目 ID）不触发，避免多余的路径清空。
  const prevProjectIdRef = useRef(resolvedProjectId);
  useEffect(() => {
    const prev = prevProjectIdRef.current;
    prevProjectIdRef.current = resolvedProjectId;
    if (!prev || !resolvedProjectId || prev === resolvedProjectId) {
      return;
    }
    setActiveDataset(undefined);
    setPickedDatasets({});
    setPickedFiles({});
    setStoredDatasetPath(null);
  }, [resolvedProjectId, setStoredDatasetPath]);
  const filters = useMemo<DatasetPageQuery>(
    () => ({
      dataset_name: normalizeText(dataset_name),
      description: normalizeText(description),
      metadata: normalizeText(metadata),
    }),
    [dataset_name, description, metadata]
  );

  // 进入 / 返回数据集时写回 store（返回列表即清除记录）；id 与名称都没变时不重复派发。
  useEffect(() => {
    if (!shouldPersistPath) {
      return;
    }
    if (storedDatasetPath?.id === activeDataset?.id && storedDatasetPath?.dataset_name === activeDataset?.dataset_name) {
      return;
    }
    setStoredDatasetPath(activeDataset ?? null);
  }, [shouldPersistPath, activeDataset, storedDatasetPath, setStoredDatasetPath]);

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

  // 选择器模式下的底部操作区：两个层级共用，由面板透传给 SiderPanelLayout。
  const footer = selectable ? (
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
  ) : undefined;

  // 每个层级各自渲染 SiderPanelLayout：搜索框与动作按钮落在统一标题栏里，
  // 与脚本 / 流程 / 文献等侧栏面板保持一致。
  return activeDataset ? (
    <DatasetFilesPanel
      key={activeDataset.id}
      dataset={activeDataset}
      pageSize={normalizePageSize(page_size, 20)}
      selectable={selectable}
      multiple={multiple}
      selectedIds={fileIds}
      onSelectRows={selectFiles}
      onToggle={toggleFile}
      onBack={() => setActiveDataset(undefined)}
      footer={footer}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
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
      title={title || "Datasets"}
      footer={footer}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  );
};

export default DatasetProjectPage;

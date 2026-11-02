import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Pagination,
  Popconfirm,
  Popover,
  Table,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CodeOutlined,
  ContainerOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  deleteContainerTemplateApi,
  exportContainerTemplateApi,
  type ContainerTemplateItem,
} from "@/api/container";
import { useContainerTemplatePageQuery } from "@/hooks/usePaginationV2";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { openBottomTerminal } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";

export interface ContainerTemplateListProps {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  spec_id?: string;
  command?: string;
  work_dir?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerTemplateItem) => void;
  onCancel?: () => void;
  close?: () => void;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

/** 模板的人类可读名称：优先 display_name，其次 name，最后回退到 id。 */
const templateDisplayName = (item: ContainerTemplateItem) =>
  item.display_name || item.name || item.id;

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePageSize = (value?: number | string) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 20;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
    if (msg) {
      return msg;
    }
  }
  return fallback;
};

/** 悬停标题时展示的模板详情卡片。 */
const ContainerTemplateDetailCard = ({ item }: { item: ContainerTemplateItem }) => (
  <div style={{ width: 360 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "display_name", label: "Display Name", children: templateDisplayName(item) },
        { key: "id", label: "ID", children: item.id || "-" },
        { key: "spec_id", label: "Spec ID", children: item.spec_id || "-" },
        { key: "app_type", label: "App Type", children: item.app_type || "-" },
        { key: "image_name", label: "Image", children: item.image_name || "-" },
        { key: "pull_policy", label: "Pull Policy", children: item.pull_policy || "-" },
        {
          key: "command",
          label: "Command",
          children: item.command ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.command}</span>
          ) : (
            "-"
          ),
        },
        { key: "cpu", label: "CPU", children: Number.isFinite(item.cpu) ? item.cpu : "-" },
        { key: "memory", label: "Memory", children: Number.isFinite(item.memory) ? item.memory : "-" },
        {
          key: "work_dir",
          label: "Work Dir",
          children: item.work_dir ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.work_dir}</span>
          ) : (
            "-"
          ),
        },
        {
          key: "description",
          label: "Description",
          children: item.definition_description || item.description || "-",
        },
      ]}
    />
  </div>
);

/**
 * 容器模板列表（左侧栏面板形态）。
 *
 * - 标题栏可折叠（由父级堆叠布局注入 collapsed / onToggleCollapse）。
 * - 点击行：在主区域底部面板打开临时终端标签（不跳路由，`hideMainPane` 会自动展开）。
 * - 右侧 Terminal 按钮：通过 invoke 打开临时终端弹窗。
 * - 作为选择器（invoke 打开且注入 onOk）时，点击行改为本地选中。
 */
const ContainerTemplateList = ({
  id,
  name,
  description,
  type,
  spec_id,
  command,
  work_dir,
  page_size,
  title,
  onOk,
  onCancel,
  close,
  collapsed = false,
  onToggleCollapse,
}: ContainerTemplateListProps) => {
  const message = useGlobalMessage();
  const { locale } = useI18n();

  const [selectedId, setSelectedId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();

  // 作为选择器（通过 invoke 打开）时使用本地选中态，普通模式点击行跳转终端。
  const selectable = Boolean(onOk || onCancel);

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    setQuery,
    isLoading,
    isFetching,
    refetch,
  } = useContainerTemplatePageQuery(
    {},
    {
      initialPageSize: normalizePageSize(page_size),
      keepPreviousData: true,
      staleTime: 30_000,
      cacheTime: 5 * 60_000,
    }
  );

  useEffect(() => {
    setQuery({
      id: normalizeText(id),
      name: normalizeText(name),
      description: normalizeText(description),
      type: normalizeText(type),
      spec_id: normalizeText(spec_id),
      command: normalizeText(command),
      work_dir: normalizeText(work_dir),
    });
  }, [id, name, description, type, spec_id, command, work_dir, setQuery]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

  const handleCreate = useCallback(async () => {
    try {
      await invoke.containerTemplateForm.openAsync(
        {},
        { title: "Create Container Template", width: 600, footer: false }
      );
      refetch();
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
    }
  }, [refetch]);

  const handleEdit = useCallback(async (record: ContainerTemplateItem) => {
    try {
      await invoke.containerTemplateForm.openAsync(
        { item: record },
        { title: "Edit Container Template", width: 600, footer: false }
      );
      refetch();
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
    }
  }, [refetch]);

  const handleDelete = useCallback(async (record: ContainerTemplateItem) => {
    setDeletingId(record.id);
    try {
      await deleteContainerTemplateApi({ id: record.id });
      message.success("Container template deleted successfully");
      refetch();
    } catch (error) {
      message.error(getErrorMessage(error, "Failed to delete container template"));
    } finally {
      setDeletingId(undefined);
    }
  }, [message, refetch]);

  const handleExport = useCallback(async (record: ContainerTemplateItem) => {
    try {
      const resp = await exportContainerTemplateApi({ id: record.id });
      const json = JSON.stringify(resp.data, null, 2);
      invoke.containerTemplateExportDialog.open(
        { json, name: record.name },
        { title: `Export: ${record.name}`, width: 720, footer: false }
      );
    } catch (error) {
      message.error(getErrorMessage(error, "Failed to export container template"));
    }
  }, [message]);

  const handleImport = useCallback(async () => {
    try {
      await invoke.containerTemplateImportDialog.openAsync(
        {},
        { title: "Import Container Template", width: 600, footer: false }
      );
      refetch();
    } catch {
      // 用户取消时 openAsync 会 reject，无需处理。
    }
  }, [refetch]);

  /** 右侧 Terminal 按钮：invoke 打开临时容器终端弹窗（关闭即删除容器）。 */
  const handleOpenTerminal = useCallback((record: ContainerTemplateItem) => {
    invoke.containerTemplateTerminal.open(
      { template_id: record.id, name: templateDisplayName(record) },
      {
        title: `Terminal - ${templateDisplayName(record)}`,
        width: 960,
        footer: null,
      }
    );
  }, []);

  /** 点击行：在主区域底部面板打开临时终端（不跳路由）。 */
  const openTerminalTab = useCallback((record: ContainerTemplateItem) => {
    // 同一模板重复点击只会聚焦已有标签，不会重复创建容器。
    openBottomTerminal(record.id, templateDisplayName(record));
  }, []);

  const handleRowClick = useCallback(
    (record: ContainerTemplateItem) => {
      if (selectable) {
        setSelectedId(record.id);
        return;
      }
      openTerminalTab(record);
    },
    [selectable, openTerminalTab]
  );

  const columns = useMemo<ColumnsType<ContainerTemplateItem>>(
    () => [
      {
        title: "Template",
        dataIndex: "display_name",
        key: "display_name",
        ellipsis: { showTitle: false },
        render: (_: unknown, record) => {
          const displayName = templateDisplayName(record);
          const meta = [
            record.is_default ? "Default" : undefined,
            record.app_type,
            record.image_name,
            record.updated_at ? formatRelativeTime(record.updated_at, locale) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <ContainerOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在鼠标悬停到标题上时显示，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ContainerOutlined />
                      {displayName}
                    </span>
                  }
                  content={<ContainerTemplateDetailCard item={record} />}
                >
                  <span className="project-report-item-title">{displayName}</span>
                </Popover>
                {meta && (
                  <span className="project-report-item-meta" title={meta}>
                    {meta}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 152,
        align: "right",
        render: (_: unknown, record) => (
          <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Terminal">
              <Button
                type="text"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => handleOpenTerminal(record)}
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
            <Tooltip title="Export">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleExport(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Delete this template?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record)}
              okButtonProps={{ loading: deletingId === record.id }}
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </span>
        ),
      },
    ],
    [locale, deletingId, handleOpenTerminal, handleEdit, handleExport, handleDelete]
  );

  const selectColumn: ColumnsType<ContainerTemplateItem>[number] = {
    title: "Select",
    key: "select",
    width: 96,
    align: "right",
    render: (_, record) => (
      <Button
        type={record.id === selectedId ? "primary" : "default"}
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(record.id);
        }}
      >
        {record.id === selectedId ? "Selected" : "Select"}
      </Button>
    ),
  };

  const handleConfirm = () => {
    if (!selectedItem || !onOk) {
      return;
    }
    onOk(selectedItem);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  return (
    <div className={`project-report-panel${collapsed ? " is-collapsed" : ""}`}>
      <div className="project-report-panel-header">
        {onToggleCollapse ? (
          <button
            type="button"
            className="project-report-panel-title project-report-panel-title-button"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <CaretRightOutlined className="project-report-panel-chevron" />
            ) : (
              <CaretDownOutlined className="project-report-panel-chevron" />
            )}
            <span>{title || "Container Templates"}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title || "Container Templates"}</span>
        )}
        <div className="project-report-panel-actions">
          <Tooltip title="Create container template">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreate} />
          </Tooltip>
          <Tooltip title="Import container template">
            <Button type="text" size="small" icon={<ImportOutlined />} onClick={handleImport} />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              loading={isFetching}
              onClick={() => refetch()}
            />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body" style={collapsed ? { display: "none" } : undefined}>
        {data.length === 0 && !isLoading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No container template" />
        ) : (
          <Table<ContainerTemplateItem>
            rowKey="id"
            size="small"
            columns={selectable ? [...columns, selectColumn] : columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            rowClassName={(record) =>
              String(record.id) === String(selectedId) ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
            })}
          />
        )}
      </div>

      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--sharp-divider)",
          ...(collapsed ? { display: "none" } : null),
        }}
      >
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          pageSizeOptions={[20, 50, 100, 200, 500, 1000]}
          showTotal={(t) => `${t} templates`}
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>

      {selectable && (
        <div
          style={{
            display: collapsed ? "none" : "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 10px",
            borderTop: "1px solid var(--sharp-divider)",
          }}
        >
          <Button onClick={handleCancel}>Cancel</Button>
          <Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContainerTemplateList;

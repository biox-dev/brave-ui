import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
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
import {
  createContainerTerminalSessionApi,
  execContainerTerminalSessionApi,
} from "@/api/container-template-terminal";
import { useContainerTemplatePageQuery } from "@/hooks/usePaginationV2";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { openBottomTerminal } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";

/**
 * 选择模式下底部的一个动作按钮。
 *
 * 选择器本身不关心「选中模板之后要建什么」，只把选中的模板交给 onClick；
 * 具体是建应用会话还是建终端会话由调用方决定。
 */
export interface ContainerTemplateSelectAction {
  /** 动作唯一标识（同时作为 loading 状态的 key）。 */
  key: string;
  /** 按钮文案。 */
  label: string;
  /** 是否渲染为主按钮（默认 false）。 */
  primary?: boolean;
  /** 以当前选中的模板为参数执行；抛错时选择器保持打开，便于重试。 */
  onClick: (item: ContainerTemplateItem) => void | Promise<void>;
}

export interface ContainerTemplateListProps {
  id?: string;
  name?: string;
  description?: string;
  type?: string;
  spec_id?: string;
  command?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (item: ContainerTemplateItem) => void;
  onCancel?: () => void;
  close?: () => void;
  /**
   * 选择模式下的底部动作：传入后底部不再渲染单个 Confirm，而是每个动作一个按钮。
   * 动作执行成功后仍按选择器语义回传选中模板（onOk → resolve 并关闭弹窗）。
   */
  okActions?: ContainerTemplateSelectAction[];
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
  page_size,
  title,
  onOk,
  onCancel,
  close,
  okActions,
  collapsed = false,
  onToggleCollapse,
}: ContainerTemplateListProps) => {
  const message = useGlobalMessage();
  const { locale } = useI18n();

  const [selectedId, setSelectedId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  // 自定义底部动作（okActions）正在执行的那一个：用于按钮 loading / 防重复点击。
  const [pendingActionKey, setPendingActionKey] = useState<string>();
  // 「运行命令」弹窗：把命令写入该模板的持久终端（后端会话注册表），
  // 提交后自动打开底部终端标签，输出通过该终端的 WebSocket 实时显示。
  const [runTarget, setRunTarget] = useState<ContainerTemplateItem | null>(null);
  const [runCommand, setRunCommand] = useState("");
  const [runSubmitting, setRunSubmitting] = useState(false);

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
    });
  }, [id, name, description, type, spec_id, command, setQuery]);

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

  /**
   * 打开「运行命令」弹窗：命令会写入该模板新建的终端会话。
   *
   * 终端会话由 `/container/terminal/session/create` 创建（一个模板可以有多条会话），
   * 提交时先建会话再投递命令，最后按会话 ID 打开底部终端标签。
   */
  const handleOpenRun = useCallback((record: ContainerTemplateItem) => {
    setRunTarget(record);
    setRunCommand(record.command?.trim() || "pwd");
  }, []);

  const handleSubmitRun = useCallback(async () => {
    if (!runTarget) {
      return;
    }
    const command = runCommand.trim();
    if (!command) {
      message.warning("Please input a command");
      return;
    }
    setRunSubmitting(true);
    try {
      const created = (await createContainerTerminalSessionApi({
        container_template_id: runTarget.id,
      })).data;
      // wait_seconds=0：只投递命令，输出走终端 WebSocket 实时回传。
      await execContainerTerminalSessionApi(created.session_id, {
        command,
        wait_seconds: 0,
      });
      openBottomTerminal(created.session_id, created.name || templateDisplayName(runTarget));
      message.success("Command submitted to terminal");
      setRunTarget(null);
    } catch (error) {
      message.error(getErrorMessage(error, "Failed to run command"));
    } finally {
      setRunSubmitting(false);
    }
  }, [message, runCommand, runTarget]);

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

  /**
   * 右侧 Terminal 按钮：先新建一条终端会话（创建即启动容器），再打开该会话的终端弹窗。
   *
   * 会话创建与 WebSocket 连接分开后，弹窗只认会话 ID；关闭弹窗不会删除容器，
   * 需要在左侧栏「终端会话」列表里显式关闭。
   */
  const handleOpenTerminal = useCallback(
    async (record: ContainerTemplateItem) => {
      try {
        const created = (await createContainerTerminalSessionApi({
          container_template_id: record.id,
        })).data;
        invoke.containerTemplateTerminal.open(
          { session_id: created.session_id, name: created.name },
          {
            title: `Terminal - ${created.name || templateDisplayName(record)}`,
            width: 960,
            footer: null,
          }
        );
      } catch (error) {
        message.error(getErrorMessage(error, "Failed to create terminal session"));
      }
    },
    [message]
  );

  /**
   * 点击行：在主区域底部面板新建一个终端会话并打开它（不跳路由）。
   *
   * 会话创建与连接分开：每次都建一条新会话（容器已启动），再按会话 ID 打开标签，
   * 因此左侧栏「终端会话」列表能看到并管理这些会话。
   */
  const openTerminalTab = useCallback(
    async (record: ContainerTemplateItem) => {
      try {
        const created = (await createContainerTerminalSessionApi({
          container_template_id: record.id,
        })).data;
        openBottomTerminal(created.session_id, created.name || templateDisplayName(record));
      } catch (error) {
        message.error(getErrorMessage(error, "Failed to create terminal session"));
      }
    },
    [message]
  );

  const handleRowClick = useCallback(
    (record: ContainerTemplateItem) => {
      if (selectable) {
        setSelectedId(record.id);
        return;
      }
      void openTerminalTab(record);
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
        width: 190,
        align: "right",
        render: (_: unknown, record) => (
          <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Terminal">
              <Button
                type="text"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => void handleOpenTerminal(record)}
              />
            </Tooltip>
            <Tooltip title="Run command in terminal">
              <Button
                type="text"
                size="small"
                icon={<CaretRightOutlined />}
                onClick={() => handleOpenRun(record)}
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
    [locale, deletingId, handleOpenTerminal, handleOpenRun, handleEdit, handleExport, handleDelete]
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

  /**
   * 执行自定义底部动作。
   *
   * 动作成功后仍然走 onOk 回传选中模板：`openAsync` 依赖它 resolve 并关闭弹窗，
   * 所以调用方的 `await invoke.containerTemplatePage.openAsync(...)` 能正常结束，
   * 而「具体建什么」由动作自己的 onClick 完成。
   */
  const runOkAction = async (action: ContainerTemplateSelectAction) => {
    if (!selectedItem || pendingActionKey) {
      return;
    }
    setPendingActionKey(action.key);
    try {
      await action.onClick(selectedItem);
      onOk?.(selectedItem);
    } catch {
      // 动作失败时保持选择器打开：用户可以重试，或换成另一个动作。
    } finally {
      setPendingActionKey(undefined);
    }
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
          {okActions && okActions.length > 0 ? (
            okActions.map((action) => (
              <Button
                key={action.key}
                type={action.primary ? "primary" : "default"}
                disabled={!selectedItem || Boolean(pendingActionKey)}
                loading={pendingActionKey === action.key}
                onClick={() => void runOkAction(action)}
              >
                {action.label}
              </Button>
            ))
          ) : (
            <Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
              Confirm
            </Button>
          )}
        </div>
      )}

      <Modal
        open={Boolean(runTarget)}
        title={`Run in terminal - ${runTarget ? templateDisplayName(runTarget) : ""}`}
        okText="Run"
        confirmLoading={runSubmitting}
        onOk={handleSubmitRun}
        onCancel={() => setRunTarget(null)}
        destroyOnClose
      >
        <Input.TextArea
          autoSize={{ minRows: 4, maxRows: 12 }}
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="例如：R --version"
          style={{ fontFamily: '"Menlo", "Consolas", monospace', fontSize: 13 }}
          onPressEnter={(e) => {
            // Enter 直接提交；Shift+Enter 换行。
            if (!e.shiftKey) {
              e.preventDefault();
              void handleSubmitRun();
            }
          }}
        />
        <div style={{ marginTop: 8, color: "var(--ant-color-text-secondary)", fontSize: 12 }}>
          命令会写入该模板的持久终端（同一模板复用同一个容器），提交后自动打开底部终端面板。
        </div>
      </Modal>
    </div>
  );
};

export default ContainerTemplateList;

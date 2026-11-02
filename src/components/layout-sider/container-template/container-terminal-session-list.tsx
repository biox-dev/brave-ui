import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Popconfirm,
  Popover,
  Switch,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CodeOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { closeContainerTemplateTerminalApi } from "@/api/container-template-terminal";
import { useContainerTerminalSessionListQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { closeBottomTab, openBottomTerminal } from "@/layout/bottom-panel-store";
import { formatRelativeTime } from "@/utils/time";
import type { ContainerTerminalSessionItem } from "@/api/container-template-terminal";

export interface ContainerTerminalSessionListProps {
  title?: string;
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

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

/** 会话状态标签：busy > 有订阅者 > 存活。 */
const statusTag = (item: ContainerTerminalSessionItem) => {
  if (item.busy) {
    return <Tag color="processing">Running</Tag>;
  }
  if (item.subscribers > 0) {
    return <Tag color="success">Attached</Tag>;
  }
  return <Tag color="default">Idle</Tag>;
};

/** 悬停标题时展示的会话详情卡片。 */
const SessionDetailCard = ({ item }: { item: ContainerTerminalSessionItem }) => (
  <div style={{ width: 360 }}>
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: "session_id", label: "Session ID", children: item.session_id || "-" },
        { key: "template_id", label: "Template ID", children: item.template_id || "-" },
        { key: "image_name", label: "Image", children: item.image_name || "-" },
        { key: "app_type", label: "App Type", children: item.app_type || "-" },
        { key: "runtime", label: "Runtime", children: item.runtime_name || "-" },
        {
          key: "runtime_id",
          label: "Runtime ID",
          children: item.runtime_id ? (
            <span style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{item.runtime_id}</span>
          ) : (
            "-"
          ),
        },
        { key: "subscribers", label: "Subscribers", children: item.subscribers },
        { key: "seq", label: "Output Seq", children: item.seq },
        { key: "persistent", label: "Persistent", children: item.persistent ? "yes" : "no" },
        {
          key: "last_active",
          label: "Last Active",
          children: item.last_active ? new Date(item.last_active).toLocaleString() : "-",
        },
      ]}
    />
  </div>
);

/**
 * 「终端会话」列表（左侧栏面板形态）。
 *
 * 数据来自 `GET /container/terminal/session/list`：后端把进程内会话注册表里的会话
 * 与容器模板绑定行 join 起来（`DisplayName` / `ImageName`），并附带
 * `TerminalSessionStatus`（存活 / 订阅者 / running / 序号）。
 *
 * - 点击行：在底部面板打开（或聚焦）同名终端标签，与容器模板列表的点击行为一致；
 * - 右侧 Terminal 按钮：同上（显式图标入口）；
 * - 右侧 Delete 按钮：删除会话（后端关闭 shell 并删除容器）并关闭对应的底部标签。
 */
const ContainerTerminalSessionList = ({
  title,
  collapsed = false,
  onToggleCollapse,
}: ContainerTerminalSessionListProps) => {
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const [deletingId, setDeletingId] = useState<string>();
  // 默认只显示当前激活项目下的会话（后端用 GetActiveProjectByUserID 过滤）。
  const [onlyCurrentProject, setOnlyCurrentProject] = useState(true);

  const { data = [], isLoading, isFetching, refetch } = useContainerTerminalSessionListQuery({
    allProjects: !onlyCurrentProject,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  // 切换过滤条件后重新拉取，避免短时间内看到上一份缓存。
  useEffect(() => {
    refetch();
  }, [onlyCurrentProject, refetch]);

  /**
   * 打开底部终端标签。
   *
   * key 与容器模板列表一致（`terminal:<templateId>`），因此两边点击同一个模板
   * 只会聚焦同一个标签，不会重复建容器。
   */
  const openTerminalTab = useCallback((record: ContainerTerminalSessionItem) => {
    if (!record.template_id) {
      return;
    }
    openBottomTerminal(record.template_id, record.display_name);
  }, []);

  /** 删除会话：先调后端（关 shell + 删容器），再关掉前端标签。 */
  const handleDelete = useCallback(
    async (record: ContainerTerminalSessionItem) => {
      if (!record.template_id) {
        return;
      }
      setDeletingId(record.session_id);
      try {
        await closeContainerTemplateTerminalApi(record.template_id);
        // 关闭标签：closeBottomTab 内也会再调一次 DELETE（幂等），这里主要是通知 UI。
        closeBottomTab(`terminal:${record.template_id}`);
        message.success("Terminal session closed");
        refetch();
      } catch (error) {
        message.error(getErrorMessage(error, "Failed to close terminal session"));
      } finally {
        setDeletingId(undefined);
      }
    },
    [message, refetch]
  );

  const columns = useMemo<ColumnsType<ContainerTerminalSessionItem>>(
    () => [
      {
        title: "Session",
        dataIndex: "display_name",
        key: "display_name",
        ellipsis: { showTitle: false },
        render: (_: unknown, record) => {
          const displayName = record.display_name || record.session_id;
          const meta = [
            record.image_name,
            record.app_type,
            record.last_active ? formatRelativeTime(record.last_active, locale) : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div className="project-report-item">
              <CodeOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                {/* 详情卡片只在悬停标题时出现，避免整行悬停就弹卡。 */}
                <Popover
                  placement="left"
                  mouseEnterDelay={0.2}
                  mouseLeaveDelay={0.1}
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <CodeOutlined />
                      {displayName}
                    </span>
                  }
                  content={<SessionDetailCard item={record} />}
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
        title: "Status",
        key: "status",
        width: 92,
        align: "center",
        render: (_: unknown, record) => statusTag(record),
      },
      {
        title: "Actions",
        key: "actions",
        width: 80,
        align: "right",
        render: (_: unknown, record) => (
          <span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
            <Tooltip title="Terminal">
              <Button
                type="text"
                size="small"
                icon={<CodeOutlined />}
                onClick={() => openTerminalTab(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Close this terminal?"
              description="The container will be deleted."
              onConfirm={() => handleDelete(record)}
              okButtonProps={{ loading: deletingId === record.session_id }}
            >
              <Tooltip title="Close session & delete container">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </span>
        ),
      },
    ],
    [locale, deletingId, openTerminalTab, handleDelete]
  );

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
            <span>{title || "Terminal Sessions"}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title || "Terminal Sessions"}</span>
        )}
        <div className="project-report-panel-actions">
          <Tooltip
            title={
              onlyCurrentProject
                ? "Showing sessions of the current project only"
                : "Showing sessions of all projects"
            }
          >
            <Switch
              size="small"
              checked={onlyCurrentProject}
              onChange={setOnlyCurrentProject}
              checkedChildren="Current"
              unCheckedChildren="All"
            />
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
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              onlyCurrentProject ? "No terminal session in current project" : "No terminal session"
            }
          />
        ) : (
          <Table<ContainerTerminalSessionItem>
            rowKey="session_id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            onRow={(record) => ({
              onClick: () => openTerminalTab(record),
            })}
          />
        )}
      </div>
    </div>
  );
};

export default ContainerTerminalSessionList;

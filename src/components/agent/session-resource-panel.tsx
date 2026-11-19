import { FC, useMemo } from 'react';
import { Button, Empty, Table, Tooltip } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AgentSessionResourceItem, AgentSessionResourceType } from '@/api/agent';
import { useI18n } from '@/hooks/useI18n';
import {
  isSessionResourceOpenable,
  openSessionResourceTab,
} from '@/components/agent/session-resource-workspace';
import { useAgentSessionResources } from '@/components/agent/use-agent-session-resources';

/** 分组数据未就绪时的共享空数组，保持 dataSource 引用稳定。 */
const EMPTY_RESOURCE_ITEMS: AgentSessionResourceItem[] = [];

export interface SessionResourcePanelProps {
  /** 当前会话 ID；New Chat（无会话）时不发起请求。 */
  sessionId?: string;
  /**
   * 资源类型。
   *
   * 不传表示「空状态面板」：没有可展示的资源时，仍保留标题栏（含刷新按钮）
   * 与空状态，方便用户在无数据时手动刷新。
   */
  resourceType?: AgentSessionResourceType;
  title: string;
  /** 右侧堆叠面板整体是否展开：只有展开时才会请求接口。 */
  active: boolean;
  /**
   * 是否在该分区标题栏显示刷新按钮。
   *
   * 所有分区共用一次分组请求，因此页面上只让第一个分区显示刷新入口，
   * 避免多个重复的刷新按钮（点击后刷新的仍是同一份数据）。
   */
  showRefresh?: boolean;
  /**
   * 关闭整个右侧面板（由页面把 overall 面板折叠）。
   *
   * 只传第一个分区：关闭按钮放在面板最上方的标题栏里，避免每个分区都重复一个 ×。
   */
  onClose?: () => void;
  /** 当前分区折叠时仅保留标题栏（不影响其它分区，也不影响共享请求）。 */
  collapsed: boolean;
  onToggleCollapse?: () => void;
}

/**
 * 会话结果面板：展示当前会话产生 / 修改过的某一类资源（脚本 / 工作流 / 分析节点 / 分析运行）。
 *
 * 数据来自 `useAgentSessionResources`：所有分区共用一个 query key，
 * 无论渲染多少个分区都只会发一次请求，本组件只取自己的 `resourceType` 那一组。
 * 刷新按钮也在这里（由 `showRefresh` 控制只在一处显示）：
 * 刷新的是共享数据，点击后所有分区同时更新。
 *
 * 不传 `resourceType` 时作为「空状态面板」使用：没有数据时依然渲染标题栏
 * （含刷新按钮）和空状态，而不是整块面板消失。
 *
 * 点击名称在右侧工作区（SplitWorkspace 的 rightMiddle）打开对应页面：
 * 视图名 / 参数 / 标签 key 由 `session-resource-workspace.ts` 的
 * `SESSION_RESOURCE_WORKSPACE_TARGETS` 统一映射，本组件只负责渲染按钮。
 */
const SessionResourcePanel: FC<SessionResourcePanelProps> = ({
  sessionId,
  resourceType,
  title,
  active,
  showRefresh = false,
  onClose,
  collapsed,
  onToggleCollapse,
}) => {
  const { locale } = useI18n();

  const {
    data: groups,
    isLoading,
    isFetching,
    refetch,
  } = useAgentSessionResources(sessionId, active);

  const items = (resourceType ? groups?.[resourceType] : undefined) ?? EMPTY_RESOURCE_ITEMS;

  const columns = useMemo<ColumnsType<AgentSessionResourceItem>>(() => {
    // 空状态面板不渲染表格列。
    if (!resourceType) {
      return [];
    }
    // 是否可点击由统一映射决定（登记过的类型才渲染成按钮），
    // 新增可点击的资源类型只需改 session-resource-workspace.ts。
    const openableType = isSessionResourceOpenable(resourceType);
    return [
      {
        dataIndex: 'name',
        render: (_, record) => {
          const name = record.name?.trim();
          const displayName =
            name || `${locale === 'en_US' ? 'Deleted' : '已删除'} #${record.resource_id}`;
          const openable = openableType && Boolean(sessionId);
          const nameStyle = {
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {openable ? (
                <Button
                  type="link"
                  size="small"
                  title={locale === 'en_US' ? 'Open in workspace' : '在右侧工作区打开'}
                  style={{ ...nameStyle, padding: 0, height: 'auto', textAlign: 'left' }}
                  onClick={() => openSessionResourceTab(sessionId, record, displayName)}
                >
                  {displayName}
                </Button>
              ) : (
                <span style={nameStyle}>{displayName}</span>
              )}
              <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {record.resource_id}
              </span>
            </div>
          );
        },
      },
    ];
  }, [locale, resourceType, sessionId]);

  const emptyDescription = !sessionId
    ? locale === 'en_US'
      ? 'No active session'
      : '暂无会话'
    : locale === 'en_US'
      ? 'No results'
      : '暂无结果';

  const refreshLabel = locale === 'en_US' ? 'Refresh' : '刷新';
  const closeLabel = locale === 'en_US' ? 'Close panel' : '关闭面板';
  // 右侧面板折叠或无会话时不请求接口，刷新按钮同步禁用，避免无意义的空请求。
  const canRefresh = Boolean(sessionId) && active;


  return (
    <div className={`project-report-panel${collapsed ? ' is-collapsed' : ''}`}>
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
            <span>{title}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title}</span>
        )}
        <div className="project-report-panel-actions">
          {showRefresh && (
            <Tooltip title={refreshLabel}>
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={isFetching} />}
                aria-label={refreshLabel}
                disabled={!canRefresh}
                onClick={() => void refetch()}
              />
            </Tooltip>
          )}
          {onClose && (
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              aria-label={closeLabel}
              onClick={onClose}
            />
          )}
        </div>
      </div>

      <div
        className="project-report-panel-body"
        style={collapsed ? { display: 'none' } : undefined}
      >
        {!isLoading && items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
        ) : (
          <Table<AgentSessionResourceItem>
            rowKey="resource_id"
            size="small"
            showHeader={false}
            pagination={false}
            columns={columns}
            dataSource={items}
            loading={isLoading || isFetching}
          />
        )}
      </div>
    </div>
  );
};

export default SessionResourcePanel;

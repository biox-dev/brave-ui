import { FC, useMemo } from 'react';
import { Button, Empty, Table, Tooltip } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from 'react-query';
import {
  listAgentSessionResourcesApi,
  type AgentSessionResourceItem,
  type AgentSessionResourceType,
} from '@/api/agent';
import { useI18n } from '@/hooks/useI18n';

export interface SessionResourcePanelProps {
  /** 当前会话 ID；New Chat（无会话）时不发起请求。 */
  sessionId?: string;
  resourceType: AgentSessionResourceType;
  title: string;
  /** 折叠时仅保留标题栏，并且不发起 / 不刷新请求。 */
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

/**
 * 会话结果面板：展示当前会话产生 / 修改过的某一类资源（脚本 / 工作流 / 分析节点）。
 *
 * 只在展开（`collapsed=false`）且存在会话 ID 时请求接口：折叠或关闭后
 * React Query 的 `enabled` 变为 false / 组件卸载，不会继续请求 API。
 */
const SessionResourcePanel: FC<SessionResourcePanelProps> = ({
  sessionId,
  resourceType,
  title,
  collapsed,
  onToggleCollapse,
  onClose,
}) => {
  const { locale } = useI18n();

  const {
    data: items,
    isLoading,
    isFetching,
    refetch,
  } = useQuery(
    ['agent-session-resources', sessionId, resourceType],
    async () => {
      const response = await listAgentSessionResourcesApi(sessionId!, resourceType);
      return response.data.data;
    },
    {
      enabled: Boolean(sessionId) && !collapsed,
      staleTime: 30_000,
      keepPreviousData: true,
    },
  );

  const columns = useMemo<ColumnsType<AgentSessionResourceItem>>(
    () => [
      {
        dataIndex: 'name',
        render: (_, record) => {
          const name = record.name?.trim();
          return (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name || `${locale === 'en_US' ? 'Deleted' : '已删除'} #${record.resource_id}`}
              </span>
              <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                {record.resource_id}
              </span>
            </div>
          );
        },
      },
    ],
    [locale],
  );

  const emptyDescription = !sessionId
    ? locale === 'en_US'
      ? 'No active session'
      : '暂无会话'
    : locale === 'en_US'
      ? 'No results'
      : '暂无结果';

  const refreshLabel = locale === 'en_US' ? 'Refresh' : '刷新';
  // 折叠或无会话时不请求接口，刷新按钮同步禁用，避免无意义的空请求。
  const canRefresh = Boolean(sessionId) && !collapsed;

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
          {onClose && (
            <Tooltip title={locale === 'en_US' ? 'Close' : '关闭'}>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label={locale === 'en_US' ? 'Close panel' : '关闭面板'}
                onClick={onClose}
              />
            </Tooltip>
          )}
        </div>
      </div>

      <div
        className="project-report-panel-body"
        style={collapsed ? { display: 'none' } : undefined}
      >
        {!isLoading && (items?.length ?? 0) === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription} />
        ) : (
          <Table<AgentSessionResourceItem>
            rowKey="resource_id"
            size="small"
            showHeader={false}
            pagination={false}
            columns={columns}
            dataSource={items ?? []}
            loading={isLoading || isFetching}
          />
        )}
      </div>
    </div>
  );
};

export default SessionResourcePanel;

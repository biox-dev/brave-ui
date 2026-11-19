import { FC } from 'react';
import { Button } from 'antd';
import type { AgentSessionResourceItem, AgentSessionResourceType } from '@/api/agent';
import { useI18n } from '@/hooks/useI18n';
import {
  isSessionResourceOpenable,
  openSessionResourceTab,
} from '@/components/agent/session-resource-workspace';
import { useAgentSessionResources } from '@/components/agent/use-agent-session-resources';

/** 分组数据未就绪时的共享空数组，保持引用稳定。 */
const EMPTY_RESOURCE_ITEMS: AgentSessionResourceItem[] = [];

export interface SessionResourcePanelProps {
  /** 当前会话 ID；New Chat（无会话）时不发起请求。 */
  sessionId?: string;
  /** 要展示的资源类型。 */
  resourceType: AgentSessionResourceType;
  /** 右侧面板整体是否展开：只有展开时才会请求接口。 */
  active: boolean;
}

/**
 * 会话资源列表：渲染某一类资源的全部条目（脚本 / 工作流 / 分析节点 / 应用会话）。
 *
 * 只负责「列出条目」：标题栏、刷新按钮、空状态与折叠都由容器
 * `SessionResourceStack` 负责，这里不再有自己的标题栏。
 *
 * 数据来自 `useAgentSessionResources`：与容器共用同一个 query key，React Query 会
 * 自动去重，因此多处调用不会产生额外请求。
 *
 * 点击名称在右侧工作区（SplitWorkspace 的 rightMiddle）打开对应页面：
 * 视图名 / 参数 / 标签 key 由 `session-resource-workspace.ts` 统一映射。
 */
const SessionResourcePanel: FC<SessionResourcePanelProps> = ({
  sessionId,
  resourceType,
  active,
}) => {
  const { locale } = useI18n();
  const { data: groups } = useAgentSessionResources(sessionId, active);

  const items = groups?.[resourceType] ?? EMPTY_RESOURCE_ITEMS;
  const openable = isSessionResourceOpenable(resourceType) && Boolean(sessionId);
  const deletedLabel = locale === 'en_US' ? 'Deleted' : '已删除';

  return (
    <div className="session-resource-list">
      {items.map((record) => {
        const displayName = record.name?.trim() || `${deletedLabel} #${record.resource_id}`;
        return (
          <div key={record.resource_id} className="session-resource-item">
            {openable ? (
              <Button
                type="link"
                size="small"
                title={locale === 'en_US' ? 'Open in workspace' : '在右侧工作区打开'}
                className="session-resource-item-name"
                onClick={() => openSessionResourceTab(sessionId, record, displayName)}
              >
                {displayName}
              </Button>
            ) : (
              <span className="session-resource-item-name">{displayName}</span>
            )}
            <span className="session-resource-item-id">{record.resource_id}</span>
          </div>
        );
      })}
    </div>
  );
};

export default SessionResourcePanel;

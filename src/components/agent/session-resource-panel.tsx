import { FC, useState } from 'react';
import { Button, Popconfirm } from 'antd';
import { DisconnectOutlined, RobotOutlined } from '@ant-design/icons';
import {
  unlinkAgentSessionResourceApi,
  type AgentSessionResourceItem,
  type AgentSessionResourceType,
} from '@/api/agent';
import type { AgentRefKind } from '@/components/agent/agent-sender.store';
import { getGlobalMessage } from '@/hooks/useGlobalMessage';
import { useInsertAgentRef } from '@/hooks/useInsertAgentRef';
import { useI18n } from '@/hooks/useI18n';
import {
  getSessionResourceTabKey,
  isSessionResourceOpenable,
  openSessionResourceTab,
} from '@/components/agent/session-resource-workspace';
import { useAgentSessionResources } from '@/components/agent/use-agent-session-resources';
import { closeAgentWorkspaceTab, useAgentWorkspace } from '@/layout/agent-workspace-store';

/** 分组数据未就绪时的共享空数组，保持引用稳定。 */
const EMPTY_RESOURCE_ITEMS: AgentSessionResourceItem[] = [];

/**
 * 会话资源类型 → Agent 引用前缀（提交时拼成 `@<kind>:<id>`）。
 *
 * 前缀与后端工具的容错解析保持一致：
 *   - plan → 计划工具（@plan:<id>）；
 *   - script → get_script；
 *   - workflow → get_workflow；
 *   - analysis → get_analysis_workflow；
 *   - analysis_node → get_analysis_node；
 *   - project_report → get_report（与报告文件页的 @report:<id> 同一个前缀）。
 */
const RESOURCE_REF_KINDS: Record<AgentSessionResourceType, AgentRefKind> = {
  plan: 'plan',
  script: 'script',
  workflow: 'workflow',
  analysis: 'analysis',
  analysis_node: 'analysis_node',
  project_report: 'report',
};

export interface SessionResourcePanelProps {
  /** 当前会话 ID；New Chat（无会话）时不发起请求。 */
  sessionId?: string;
  /** 要展示的资源类型。 */
  resourceType: AgentSessionResourceType;
  /** 右侧面板整体是否展开：只有展开时才会请求接口。 */
  active: boolean;
}

/**
 * 会话资源列表：渲染某一类资源的全部条目（脚本 / 工作流 / 分析节点 / 分析运行 / 项目报告）。
 *
 * 只负责「列出条目」：标题栏、刷新按钮、空状态与折叠都由容器
 * `SessionResourceStack` 负责，这里不再有自己的标题栏。
 *
 * 数据来自 `useAgentSessionResources`：与容器共用同一个 query key，React Query 会
 * 自动去重，因此多处调用不会产生额外请求。
 *
 * 点击名称在右侧工作区（SplitWorkspace 的 rightMiddle）打开对应页面：
 * 视图名 / 参数 / 标签 key 由 `session-resource-workspace.ts` 统一映射。
 *
 * 每条记录右侧还有一个「Ask Agent」（机器人图标）按钮：把该资源按类型对应的
 * 前缀（如 `@plan:<id>` / `@workflow:<id>` / `@report:<id>`）作为引用 chip
 * 插进 Agent 输入框，见 `RESOURCE_REF_KINDS`。
 */
const SessionResourcePanel: FC<SessionResourcePanelProps> = ({
  sessionId,
  resourceType,
  active,
}) => {
  const { locale } = useI18n();
  const { data: groups, refetch } = useAgentSessionResources(sessionId, active);
  // 右侧工作区当前显示的标签：与条目用同一套 key 映射比较，命中即选中。
  const activeTabKey = useAgentWorkspace(sessionId).active;
  // 正在取消关联的关联行 ID：只禁用该条的按钮，避免重复提交。
  const [unlinkingId, setUnlinkingId] = useState<string>();
  // 把资源按类型对应的前缀插入 Agent 输入框（@plan / @script / @workflow ...）。
  const insertAgentRef = useInsertAgentRef();

  const items = groups?.[resourceType] ?? EMPTY_RESOURCE_ITEMS;
  const openable = isSessionResourceOpenable(resourceType) && Boolean(sessionId);
  const deletedLabel = locale === 'en_US' ? 'Deleted' : '已删除';
  const unlinkLabel = locale === 'en_US' ? 'Unlink' : '取消关联';
  const unlinkedText = locale === 'en_US' ? 'Removed from session results' : '已取消关联';
  const askAgentLabel = locale === 'en_US' ? 'Ask Agent' : '询问 Agent';
  const askAgentText =
    locale === 'en_US' ? 'Reference added to Agent input' : '已加入 Agent 输入框引用';

  // 取消关联：只删除「会话 ↔ 资源」关联行，资源本身保留；随后刷新共享列表。
  const handleUnlink = async (record: AgentSessionResourceItem) => {
    if (!record.id) {
      return;
    }
    setUnlinkingId(record.id);
    try {
      await unlinkAgentSessionResourceApi(record.id);
      // 已经在右侧工作区打开的标签一并关闭，避免继续展示已移除的资源。
      const tabKey = getSessionResourceTabKey(record);
      if (tabKey) {
        closeAgentWorkspaceTab(sessionId, tabKey);
      }
      getGlobalMessage()?.success(unlinkedText);
      await refetch();
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setUnlinkingId(undefined);
    }
  };

  return (
    <div className="session-resource-list">
      {items.map((record) => {
        const displayName = record.name?.trim() || `${deletedLabel} #${record.resource_id}`;
        const tabKey = getSessionResourceTabKey(record);
        const isActive = Boolean(tabKey) && tabKey === activeTabKey;
        const unlinking = Boolean(record.id) && unlinkingId === record.id;
        return (
          <div
            key={record.id || record.resource_id}
            className={`session-resource-item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div className="session-resource-item-main">
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
              {/* Ask Agent：按资源类型插入对应前缀的引用 chip（@plan / @workflow / ...）。 */}
              <Button
                type="text"
                size="small"
                className="session-resource-item-ask"
                icon={<RobotOutlined />}
                title={askAgentLabel}
                aria-label={askAgentLabel}
                onClick={() => {
                  const ok = insertAgentRef(
                    RESOURCE_REF_KINDS[resourceType],
                    record.resource_id,
                    { label: displayName },
                  );
                  if (ok) {
                    getGlobalMessage()?.success(askAgentText);
                  }
                }}
              />
              <Popconfirm
                title={unlinkLabel}
                description={
                  locale === 'en_US'
                    ? 'Removes this item from the session results. The resource itself is kept.'
                    : '仅从当前会话结果中移除，资源本身会保留。'
                }
                okText={unlinkLabel}
                cancelText={locale === 'en_US' ? 'Cancel' : '取消'}
                okButtonProps={{ danger: true }}
                disabled={!record.id || Boolean(unlinkingId)}
                onConfirm={() => void handleUnlink(record)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  className="session-resource-item-unlink"
                  icon={<DisconnectOutlined />}
                  title={unlinkLabel}
                  aria-label={unlinkLabel}
                  loading={unlinking}
                  disabled={!record.id || (Boolean(unlinkingId) && !unlinking)}
                />
              </Popconfirm>
            </div>
            <span className="session-resource-item-id">{record.resource_id}</span>
          </div>
        );
      })}
    </div>
  );
};

export default SessionResourcePanel;

import { FC, useCallback, useMemo } from 'react';
import { Empty } from 'antd';
import { useNavigate, useParams } from 'react-router';
import SplitWorkspace from '@/layout/components/SplitWorkspace';
import MainTabs from '@/layout/components/MainTabs';
import BorderlessCard from '@/components/common/borderless-card';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import {
  closeAgentWorkspaceTab,
  setActiveAgentWorkspaceTab,
  useAgentWorkspace,
} from '@/layout/agent-workspace-store';
import './agent-session-page.css';

/**
 * 右侧标签内容用「视图名 + 任意参数」描述（视图名由聊天内容决定），
 * 这里把 ViewResolver 的强类型联合放宽成运行时字符串，避免到处 `as any`。
 */
type WorkspaceViewProps = { view: string } & Record<string, unknown>;
const WorkspaceViewResolver = ViewResolver as unknown as FC<WorkspaceViewProps>;

/**
 * Agent 会话页（`/task/:sessionId?`，无 sessionId 表示 New Chat）。
 *
 * 布局是一个独立的工作组：
 * - 左侧：当前会话的聊天（`ViewResolver view="agentChat"`）；
 * - 右侧：顶部 `<MainTabs />`（本地模式）+ 下方 `<ViewResolver view={页面key} />`；
 *   没有打开任何页面（标签数为 0）时右侧整体不渲染，聊天自动撑满。
 *
 * 聊天里创建 / 切换会话时通过 `onConversationChange` 把地址同步成 `/task/:id`，
 * 这样刷新、分享、左侧会话列表高亮都能保持一致。
 */
const AgentSessionPage: FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const workspace = useAgentWorkspace(sessionId);
  const tabs = workspace.tabs;

  // 激活标签被关闭后 store 会切到邻居；这里再兜底一次，避免 active 指向已关闭的 key。
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === workspace.active) ?? tabs[tabs.length - 1],
    [tabs, workspace.active],
  );

  // MainTabs 本地模式只关心 key / title。
  const localTabs = useMemo(
    () => tabs.map((tab) => ({ key: tab.key, title: tab.title })),
    [tabs],
  );

  const handleConversationChange = useCallback(
    (id?: string) => {
      if (id) {
        navigate(`/task/${encodeURIComponent(id)}`, { replace: true });
        return;
      }
      navigate('/task', { replace: true });
    },
    [navigate],
  );

  return (
    <div className="agent-session-page">
      <SplitWorkspace
        main={
          <div className="agent-session-chat">
            <ViewResolver
              view="agentChat"
              conversationId={sessionId}
              onConversationChange={handleConversationChange}
            />
          </div>
        }
        right={
          tabs.length === 0 ? undefined : (
            <BorderlessCard
              size="small"
              className="agent-session-right-card"
              styles={{ body: { padding: 8 } }}
              title={
                <MainTabs
                  localTabs={localTabs}
                  activeKey={activeTab?.key}
                  onSelect={(key) => setActiveAgentWorkspaceTab(sessionId, key)}
                  onClose={(key) => closeAgentWorkspaceTab(sessionId, key)}
                />
              }
            >
              {activeTab ? (
                <WorkspaceViewResolver
                  view={activeTab.view}
                  {...(activeTab.params ?? {})}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    locale === 'en_US' ? 'Select a tab to continue' : '请选择一个标签页继续'
                  }
                />
              )}
            </BorderlessCard>
          )
        }
        minRightWidth={320}
        maxRightWidth={1600}
        defaultRightWidth={560}
        minMainWidth={320}
        rightResizeLabel={locale === 'en_US' ? 'Resize workspace panel' : '调整工作区面板'}
      />
    </div>
  );
};

export default AgentSessionPage;

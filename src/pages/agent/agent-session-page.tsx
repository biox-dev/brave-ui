import { FC, useCallback, useEffect, useMemo } from 'react';
import { Button, Empty } from 'antd';
import { LeftOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import AgentChat from '@/components/agent/agent-chat';
import SessionResourceStack from '@/components/agent/session-resource-stack';

import {
  subscribeAgentSessionApi,
  unsubscribeAgentSessionApi,
} from '@/api/agent';
import { useSiderStackCollapsed } from '@/components/layout-sider/use-sider-stack-collapsed';
import SplitWorkspace from '@/layout/components/SplitWorkspace';
import MainTabs from '@/layout/components/MainTabs';
import BorderlessCard from '@/components/common/borderless-card';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import {
  useAgentConversationStore,
} from '@/components/agent/agent-conversation-store';
import {
  closeAgentWorkspaceTab,
  resetAgentWorkspace,
  setActiveAgentWorkspaceTab,
  useAgentWorkspace,
  type AgentWorkspaceTab,
} from '@/layout/agent-workspace-store';
import './agent-session-page.css';

/**
 * 右侧标签内容用「视图名 + 任意参数」描述（视图名由聊天内容决定），
 * 这里把 ViewResolver 的强类型联合放宽成运行时字符串，避免到处 `as any`。
 */
type WorkspaceViewProps = { view: string } & Record<string, unknown>;
const WorkspaceViewResolver = ViewResolver as unknown as FC<WorkspaceViewProps>;

/** New Chat 时使用的共享空标签数组，保持引用稳定（不渲染右侧标签页）。 */
const NO_TABS: AgentWorkspaceTab[] = [];

/**
 * Agent 会话页（`/session/:sessionId?`，无 sessionId 表示 New Chat）。
 *
 * 布局是一个独立的工作组：
 * - 顶部：通栏 header，右侧只有一个展开 / 折叠按钮（总是显示）；
 * - main：当前会话的聊天（直接渲染 `<AgentChat />`），没有右侧面板时自动撑满；
 * - rightMiddle：聊天内容打开的标签页（有标签时才渲染，关闭全部后聊天自动撑开）；
 * - right：`SessionResourceStack`（纵向堆叠脚本 / 工作流 / 分析工作流 / 分析节点 /
 *   应用会话），「有数据就堆叠、没数据就空状态」的分支全部收在容器组件内部，
 *   页面只负责传入 sessionId / active / cleared / onClose。
 *
 * 所有分区共用一次分组请求（`useAgentSessionResources`）：React Query 按同一个
 * query key 去重，容器与各分区重复调用不会产生额外请求。刷新入口在分区标题栏里，
 * 只显示在第一个有数据的分区上（所有分区共享同一份数据）。
 *
 * 聊天里创建 / 切换会话时通过 `onConversationChange` 把地址同步成 `/session/:id`，
 * 这样刷新、分享、左侧会话列表高亮都能保持一致。
 */
const AgentSessionPage: FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const workspace = useAgentWorkspace(sessionId);
  // New Chat（无会话）时右侧清空：标签页与工作区内容都用这份空状态，不读取上一个会话的残留。
  const isNewChat = !sessionId;
  const tabs = isNewChat ? NO_TABS : workspace.tabs;

  // 会话实时流按会话订阅：进入页面时登记，离开 / 切换会话时撤销。
  //
  // 订阅在服务端按 SessionID 维护，因此同一项目内打开该会话的所有用户会收到同一份
  // WS 事件流。新建会话时页面还没有会话 ID，发起人由 /agent/chat 自动登记。
  // 订阅不会因某一轮任务结束而被清理：只要页面还在，后续每一轮都能收到；
  // 用户离线（最后一条 WS 连接断开超过宽限期）时由服务端兜底清理。
  useEffect(() => {
    if (!sessionId) return;
    void subscribeAgentSessionApi(sessionId).catch(() => {
      // 订阅失败不阻塞页面：历史消息仍可通过会话详情接口正常加载。
    });
    return () => {
      void unsubscribeAgentSessionApi(sessionId).catch(() => {
        // 退订失败无需提示：服务端会在本轮结束 / 连接断开时自动清理。
      });
    };
  }, [sessionId]);

  // 顶部标题显示当前会话名称：优先用聊天页（AgentChat）从 `/agent/conversation/get`
  // 回填的标题缓存；左侧列表已加载时作为兜底；两者都没有（详情未返回）时回退到 sessionId。
  // 这里不再触发列表请求：标题不需要整张列表，列表请求由它自己的面板负责。
  const conversations = useAgentConversationStore((state) => state.conversations);
  const conversationTitles = useAgentConversationStore((state) => state.titles);
  const conversationParticipants = useAgentConversationStore((state) => state.participants);
  const sessionTitle = useMemo(() => {
    if (!sessionId) {
      return locale === 'en_US' ? 'New Chat' : '新建会话';
    }
    const title =
      conversationTitles[sessionId]?.trim() ||
      conversations.find((item) => item.id === sessionId)?.title?.trim();
    return title || sessionId;
  }, [conversationTitles, conversations, locale, sessionId]);

  // 使用过该会话的用户名：直接展示详情接口返回的 users，不做过滤 / 去重 / 兜底。
  const sessionUsernames = sessionId ? conversationParticipants[sessionId] ?? [] : [];

  // 右侧堆叠面板整体折叠（持久化）：折叠后仍保留 DOM 与滚动位置。
  // 折叠按钮不在分隔条上（SplitWorkspace 的 showRightToggle=false），而是放在 header，
  // 使聊天区与面板之间的分隔条只用于拖拽调宽。
  const [rightPaneCollapsedKeys, setRightPaneCollapsedKeys] = useSiderStackCollapsed(
    'agentSessionRightPane',
  );
  const rightPaneCollapsed = rightPaneCollapsedKeys.length > 0;
  const setRightPaneCollapsed = useCallback(
    (collapsed: boolean) => setRightPaneCollapsedKeys(collapsed ? ['collapsed'] : []),
    [setRightPaneCollapsedKeys],
  );

  // New Chat 时清空右侧工作表（标签页）：上一个会话打开的页面不应留在新会话里。
  useEffect(() => {
    if (!isNewChat) {
      return;
    }
    resetAgentWorkspace(undefined);
  }, [isNewChat]);

  // 激活标签被关闭后 store 会切到邻居；这里再兜底一次，避免 active 指向已关闭的 key。
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.key === workspace.active) ?? tabs[tabs.length - 1],
    [tabs, workspace.active],
  );

  // MainTabs 只关心 key / title。
  const tabItems = useMemo(
    () => tabs.map((tab) => ({ key: tab.key, title: tab.title })),
    [tabs],
  );

  const handleConversationChange = useCallback(
    (id?: string) => {
      if (id) {
        navigate(`/session/${encodeURIComponent(id)}`, { replace: true });
        return;
      }
      navigate('/session', { replace: true });
    },
    [navigate],
  );

  return (
    <div className="agent-session-page">
      <SplitWorkspace
        header={
          <div className="agent-session-header">
            <div className="agent-session-header-main">
              <span className="agent-session-header-title" title={sessionTitle}>
                {sessionTitle}
              </span>
              {sessionUsernames.length > 0 && (
                <span
                  className="agent-session-header-users"
                  title={sessionUsernames.map((user) => user.username).join(', ')}
                >
                  <UserOutlined />
                  <span className="agent-session-header-users-text">
                    {sessionUsernames.map((user) => user.username).join(', ')}
                  </span>
                </span>
              )}
            </div>
            <div className="agent-session-header-actions">
              {/*
               * 只在面板折叠时显示「打开」按钮；关闭入口放在右侧面板自己的标题栏里
               * （见 SessionResourcePanel 的 onClose）。
               */}
              {rightPaneCollapsed && (
                <Button
                  size="small"
                  type="default"
                  icon={<LeftOutlined />}
                  aria-label={locale === 'en_US' ? 'Open panels' : '展开面板'}
                  title={locale === 'en_US' ? 'Open panels' : '展开面板'}
                  onClick={() => setRightPaneCollapsed(false)}
                />
              )}
            </div>
          </div>
        }
        main={
          <div className="agent-session-chat">
            <AgentChat
              conversationId={sessionId}
              onConversationChange={handleConversationChange}
            />
          </div>
        }
        rightMiddle={
          tabs.length === 0 ? undefined : (
            <BorderlessCard
              size="small"
              className="agent-session-tabs-card"
              title={
                <MainTabs
                  tabs={tabItems}
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
                  /* 工作区视图可用它关掉承载自己的标签（如终端「移到底部面板」后收起右侧标签）。 */
                  onCloseTab={() => closeAgentWorkspaceTab(sessionId, activeTab.key)}
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
        rightMiddleResizeLabel={locale === 'en_US' ? 'Resize tabs panel' : '调整标签面板'}
        right={
          <SessionResourceStack
            sessionId={sessionId}
            active={!rightPaneCollapsed}
            cleared={isNewChat}
            onClose={() => setRightPaneCollapsed(true)}
          />
        }
        /* 折叠 / 展开由 header 控制，分隔条上不再渲染折叠按钮。 */
        showRightToggle={false}
        rightCollapsed={rightPaneCollapsed}
        onRightCollapsedChange={setRightPaneCollapsed}
        minMainWidth={400}
        minRightMiddleWidth={400}
        maxRightMiddleWidth={1600}
        defaultRightMiddleWidth={560}
        minRightWidth={320}
        maxRightWidth={640}
        defaultRightWidth={380}
        rightResizeLabel={locale === 'en_US' ? 'Resize stack panel' : '调整堆叠面板'}
      />
    </div>
  );
};

export default AgentSessionPage;

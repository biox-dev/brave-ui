import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Tooltip } from 'antd';
import { LayoutOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import AgentChat from '@/components/agent/agent-chat';
import SessionResourcePanel from '@/components/agent/session-resource-panel';
import type { AgentSessionResourceType } from '@/api/agent';
import SiderStackLayout, {
  type SiderStackSection,
} from '@/components/layout-sider/sider-stack-layout';
import { useSiderStackCollapsed } from '@/components/layout-sider/use-sider-stack-collapsed';
import SplitWorkspace from '@/layout/components/SplitWorkspace';
import MainTabs from '@/layout/components/MainTabs';
import BorderlessCard from '@/components/common/borderless-card';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import {
  loadAgentConversations,
  useAgentConversationStore,
} from '@/components/agent/agent-conversation-store';
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
 * 右侧堆叠分区：四块会话结果（脚本 / 工作流 / 分析节点 / 应用会话）。
 * 每块各自持有折叠态，折叠或关闭后对应面板不再请求接口。
 */
const STACK_SECTION_KEYS = [
  'sessionScripts',
  'sessionWorkflows',
  'sessionAnalysisNodes',
  'sessionAppSessions',
] as const;
type StackSectionKey = (typeof STACK_SECTION_KEYS)[number];

/** 会话结果分区配置：标题与对应的资源类型。 */
const SESSION_RESOURCE_SECTIONS: Record<
  StackSectionKey,
  { resourceType: AgentSessionResourceType; zh: string; en: string }
> = {
  sessionScripts: { resourceType: 'script', zh: '脚本', en: 'Scripts' },
  sessionWorkflows: { resourceType: 'workflow', zh: '工作流', en: 'Workflows' },
  sessionAnalysisNodes: { resourceType: 'analysis_node', zh: '分析节点', en: 'Analysis Nodes' },
  sessionAppSessions: { resourceType: 'app_session', zh: '应用会话', en: 'App Sessions' },
};

/**
 * Agent 会话页（`/session/:sessionId?`，无 sessionId 表示 New Chat）。
 *
 * 布局是一个独立的工作组：
 * - 顶部：通栏 header，右侧 Layout 按钮可重新显示被关闭的右侧堆叠；
 * - main：当前会话的聊天（直接渲染 `<AgentChat />`），没有右侧面板时自动撑满；
 * - rightMiddle：聊天内容打开的标签页（有标签时才渲染，关闭全部后聊天自动撑开）；
 * - right：可关闭的纵向堆叠面板（会话结果 + 应用会话列表），
 *   每个分区折叠或关闭后不再请求自己的接口。
 *
 * 聊天里创建 / 切换会话时通过 `onConversationChange` 把地址同步成 `/session/:id`，
 * 这样刷新、分享、左侧会话列表高亮都能保持一致。
 */
const AgentSessionPage: FC = () => {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const workspace = useAgentWorkspace(sessionId);
  const tabs = workspace.tabs;

  // 顶部标题显示当前会话名称：优先用会话列表里的 title（与左侧列表同源）。
  // 直接访问地址时列表可能还没拉过，这里补一次加载。
  const conversations = useAgentConversationStore((state) => state.conversations);
  const conversationsLoaded = useAgentConversationStore((state) => state.loaded);
  useEffect(() => {
    if (!conversationsLoaded) {
      void loadAgentConversations();
    }
  }, [conversationsLoaded]);
  const sessionTitle = useMemo(() => {
    if (!sessionId) {
      return locale === 'en_US' ? 'New Chat' : '新建会话';
    }
    const current = conversations.find((item) => item.id === sessionId);
    return current?.title?.trim() || sessionId;
  }, [conversations, locale, sessionId]);

  // 右侧堆叠：可见性与分区列表由页面持有，关闭全部分区后 Layout 按钮可一键恢复。
  const [stackVisible, setStackVisible] = useState(true);
  const [stackSectionKeys, setStackSectionKeys] = useState<StackSectionKey[]>([
    ...STACK_SECTION_KEYS,
  ]);
  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [stackCollapsedKeys, setStackCollapsedKeys] = useSiderStackCollapsed(
    'agentSessionRightStack',
  );

  const closeStackSection = useCallback((key: StackSectionKey) => {
    setStackSectionKeys((prev) => prev.filter((item) => item !== key));
  }, []);

  const stackSections = useMemo<SiderStackSection[]>(
    () =>
      stackSectionKeys.map((key) => {
        const resourceSection = SESSION_RESOURCE_SECTIONS[key];
        return {
          key,
          render: ({ collapsed, toggle }) => (
            <SessionResourcePanel
              sessionId={sessionId}
              resourceType={resourceSection.resourceType}
              title={locale === 'en_US' ? resourceSection.en : resourceSection.zh}
              collapsed={collapsed}
              onToggleCollapse={toggle}
              onClose={() => closeStackSection(key)}
            />
          ),
        };
      }),
    [closeStackSection, locale, sessionId, stackSectionKeys],
  );

  const showStack = stackVisible && stackSections.length > 0;

  // 以「实际是否可见」判断：分区被 × 全部关闭时 stackVisible 仍为 true，
  // 若按 stackVisible 判断，Layout 第一次点击只会把 stackVisible 置 false（面板依旧不出现），
  // 需要点第二次才会重建分区。改为按 showStack 判断后，关闭态点一次即可恢复。
  const toggleStack = useCallback(() => {
    if (showStack) {
      setStackVisible(false);
      return;
    }
    setStackVisible(true);
    // 恢复显示时，如果之前把分区都关掉了，先把默认分区加回来。
    setStackSectionKeys((prev) => (prev.length > 0 ? prev : [...STACK_SECTION_KEYS]));
  }, [showStack]);

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
            <span className="agent-session-header-title" title={sessionTitle}>
              {sessionTitle}
            </span>
            <div className="agent-session-header-actions">
              <Tooltip title={showStack ? 'Hide stack' : 'Show stack'}>
                <Button
                  type={showStack ? 'text' : 'default'}
                  size="small"
                  icon={<LayoutOutlined />}
                  aria-pressed={showStack}
                  onClick={toggleStack}
                >
                  Layout
                </Button>
              </Tooltip>
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
        rightMiddleResizeLabel={locale === 'en_US' ? 'Resize tabs panel' : '调整标签面板'}
        right={
          showStack ? (
            <SiderStackLayout
              sections={stackSections}
              collapsedKeys={stackCollapsedKeys}
              onCollapsedKeysChange={setStackCollapsedKeys}
              resizeLabel={locale === 'en_US' ? 'Resize panels' : '调整面板高度'}
            />
          ) : undefined
        }
        minMainWidth={320}
        minRightMiddleWidth={320}
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

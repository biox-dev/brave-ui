import { FC, useCallback, useMemo } from 'react';
import { Button, Empty } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import AgentChat from '@/components/agent/agent-chat';
import SessionResourcePanel from '@/components/agent/session-resource-panel';
import { useAgentSessionResources } from '@/components/agent/use-agent-session-resources';
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
 * 右侧堆叠分区：五块会话结果（脚本 / 工作流 / 分析工作流 / 分析节点 / 应用会话）。
 * 每块各自持有折叠态；数据由所有面板共用的一次分组请求提供。
 */
const STACK_SECTION_KEYS = [
  'sessionScripts',
  'sessionWorkflows',
  'sessionAnalyses',
  'sessionAnalysisNodes',
  'sessionAppSessions',
] as const;
type StackSectionKey = (typeof STACK_SECTION_KEYS)[number];

/**
 * 会话结果分区配置：标题与对应的资源类型。
 * 分区固定全部展示，不再支持显隐配置。
 */
const SESSION_RESOURCE_SECTIONS: Record<
  StackSectionKey,
  { resourceType: AgentSessionResourceType; zh: string; en: string }
> = {
  sessionScripts: { resourceType: 'script', zh: '脚本', en: 'Scripts' },
  sessionWorkflows: { resourceType: 'workflow', zh: '工作流', en: 'Workflows' },
  sessionAnalyses: { resourceType: 'analysis', zh: '分析工作流', en: 'Analysis Workflow' },
  sessionAnalysisNodes: { resourceType: 'analysis_node', zh: '分析节点', en: 'Analysis Nodes' },
  sessionAppSessions: { resourceType: 'app_session', zh: '应用会话', en: 'App Sessions' },
};

/**
 * Agent 会话页（`/session/:sessionId?`，无 sessionId 表示 New Chat）。
 *
 * 布局是一个独立的工作组：
 * - 顶部：通栏 header，右侧只有一个展开 / 折叠按钮（总是显示）；
 * - main：当前会话的聊天（直接渲染 `<AgentChat />`），没有右侧面板时自动撑满；
 * - rightMiddle：聊天内容打开的标签页（有标签时才渲染，关闭全部后聊天自动撑开）；
 * - right：纵向堆叠面板（脚本 / 工作流 / 分析工作流 / 分析节点 / 应用会话），
 *   只渲染有数据的分区；每个分区可独立展开或折叠，并自带刷新按钮。
 *   没有任何数据时保留面板并展示空状态（同样由 SessionResourcePanel 渲染，带刷新按钮）。
 *
 * 所有分区共用一次分组请求（`useAgentSessionResources`）：面板折叠时不发请求，
 * 展开时才请求；页面用同一份数据决定哪些分区有内容。刷新入口在分区标题栏里，
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
  const tabs = workspace.tabs;

  // 顶部标题显示当前会话名称：优先用聊天页（AgentChat）从 `/agent/conversation/get`
  // 回填的标题缓存；左侧列表已加载时作为兜底；两者都没有（详情未返回）时回退到 sessionId。
  // 这里不再触发列表请求：标题不需要整张列表，列表请求由它自己的面板负责。
  const conversations = useAgentConversationStore((state) => state.conversations);
  const conversationTitles = useAgentConversationStore((state) => state.titles);
  const sessionTitle = useMemo(() => {
    if (!sessionId) {
      return locale === 'en_US' ? 'New Chat' : '新建会话';
    }
    const title =
      conversationTitles[sessionId]?.trim() ||
      conversations.find((item) => item.id === sessionId)?.title?.trim();
    return title || sessionId;
  }, [conversationTitles, conversations, locale, sessionId]);

  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [stackCollapsedKeys, setStackCollapsedKeys] = useSiderStackCollapsed(
    'agentSessionRightStack',
  );

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

  // 所有分区共用这一次分组请求（与各分区同一个 query key）：
  // 右侧面板折叠时不请求接口，展开时才请求。
  const { data: resourceGroups } = useAgentSessionResources(sessionId, !rightPaneCollapsed);

  // 只渲染有数据的分区：没有结果的分区不占位。
  const visibleSectionKeys = useMemo(
    () =>
      STACK_SECTION_KEYS.filter(
        (key) =>
          (resourceGroups?.[SESSION_RESOURCE_SECTIONS[key].resourceType]?.length ?? 0) > 0,
      ),
    [resourceGroups],
  );

  const stackSections = useMemo<SiderStackSection[]>(
    () =>
      visibleSectionKeys.map((key, index) => {
        const resourceSection = SESSION_RESOURCE_SECTIONS[key];
        return {
          key,
          render: ({ collapsed, toggle }) => (
            <SessionResourcePanel
              sessionId={sessionId}
              resourceType={resourceSection.resourceType}
              title={locale === 'en_US' ? resourceSection.en : resourceSection.zh}
              active={!rightPaneCollapsed}
              /* 所有分区共用一次请求：刷新入口只放在第一个分区，避免重复按钮。 */
              showRefresh={index === 0}
              /* 关闭整个右侧面板的按钮只放在最上方分区的标题栏里。 */
              onClose={index === 0 ? () => setRightPaneCollapsed(true) : undefined}
              collapsed={collapsed}
              onToggleCollapse={toggle}
            />
          ),
        };
      }),
    [locale, rightPaneCollapsed, sessionId, setRightPaneCollapsed, visibleSectionKeys],
  );

  const showStack = visibleSectionKeys.length > 0;

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
            <span className="agent-session-header-title" title={sessionTitle}>
              {sessionTitle}
            </span>
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
          showStack ? (
            <SiderStackLayout
              sections={stackSections}
              collapsedKeys={stackCollapsedKeys}
              onCollapsedKeysChange={setStackCollapsedKeys}
              resizeLabel={locale === 'en_US' ? 'Resize panels' : '调整面板高度'}
            />
          ) : (
            /* 没有数据时也保留右侧面板：空状态与刷新按钮都由 SessionResourcePanel 渲染。 */
            <SessionResourcePanel
              sessionId={sessionId}
              title={locale === 'en_US' ? 'Session results' : '会话结果'}
              active={!rightPaneCollapsed}
              showRefresh
              onClose={() => setRightPaneCollapsed(true)}
              collapsed={false}
            />
          )
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

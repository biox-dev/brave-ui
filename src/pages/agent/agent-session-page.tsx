import { FC, useCallback, useEffect, useMemo } from 'react';
import { Button, Checkbox, Empty, Popover } from 'antd';
import { LayoutOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import AgentChat from '@/components/agent/agent-chat';
import SessionResourcePanel from '@/components/agent/session-resource-panel';
import type { AgentSessionResourceType } from '@/api/agent';
import SiderStackLayout, {
  type SiderStackSection,
} from '@/components/layout-sider/sider-stack-layout';
import { useSiderStackCollapsed } from '@/components/layout-sider/use-sider-stack-collapsed';
import { useSiderStackVisible } from '@/components/layout-sider/use-sider-stack-visible';
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
 * 右侧堆叠分区：五块会话结果（脚本 / 工作流 / 分析工作流 / 分析节点 / 应用会话）。
 * 每块各自持有折叠态，折叠或关闭后对应面板不再请求接口。
 */
const STACK_SECTION_KEYS = [
  'sessionScripts',
  'sessionWorkflows',
  'sessionAnalyses',
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
  sessionAnalyses: { resourceType: 'analysis', zh: '分析工作流', en: 'Analysis Workflow' },
  sessionAnalysisNodes: { resourceType: 'analysis_node', zh: '分析节点', en: 'Analysis Nodes' },
  sessionAppSessions: { resourceType: 'app_session', zh: '应用会话', en: 'App Sessions' },
};

/**
 * 默认只显示「分析节点 + 应用会话」两块：作为未持久化时的稳定回退值（保持引用不变）。
 * 脚本 / 工作流 / 分析工作流仍可在 Layout 弹层里手动勾选显示。
 */
const DEFAULT_VISIBLE_STACK_SECTIONS: readonly string[] = [
  'sessionAnalysisNodes',
  'sessionAppSessions',
];

/**
 * Agent 会话页（`/session/:sessionId?`，无 sessionId 表示 New Chat）。
 *
 * 布局是一个独立的工作组：
 * - 顶部：通栏 header，右侧 Layout 按钮点击后可勾选要显示的堆叠分区（持久化）；
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

  // 右侧堆叠：分区显示状态持久化（redux + localStorage），全部取消勾选时右侧面板不渲染。
  // 存储 key 用 v2：默认显示规则变更后，避免旧的「全部显示」持久化值覆盖新默认。
  const [visibleSectionKeys, setVisibleSectionKeys] = useSiderStackVisible(
    'agentSessionRightStack:v2',
    DEFAULT_VISIBLE_STACK_SECTIONS,
  );
  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [stackCollapsedKeys, setStackCollapsedKeys] = useSiderStackCollapsed(
    'agentSessionRightStack',
  );

  // 按固定顺序渲染当前可见的分区，持久化里多余的 key（版本变更遗留）会被自动忽略。
  const stackSectionKeys = useMemo(
    () => STACK_SECTION_KEYS.filter((key) => visibleSectionKeys.includes(key)),
    [visibleSectionKeys],
  );

  const closeStackSection = useCallback(
    (key: StackSectionKey) => {
      setVisibleSectionKeys(stackSectionKeys.filter((item) => item !== key));
    },
    [setVisibleSectionKeys, stackSectionKeys],
  );

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

  const showStack = stackSectionKeys.length > 0;

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
  // 展开状态才显示 Layout（分区勾选）；折叠后 header 只留展开按钮，避免误以为面板还在。
  // 没有勾选任何分区时右侧面板本就不渲染，仍保留 Layout 入口用于重新开启分区。
  const showLayoutButton = !(showStack && rightPaneCollapsed);

  // Layout 弹层里的分区勾选项：与右侧堆叠的固定顺序一致。
  const sectionOptions = useMemo(
    () =>
      STACK_SECTION_KEYS.map((key) => ({
        value: key,
        label:
          locale === 'en_US'
            ? SESSION_RESOURCE_SECTIONS[key].en
            : SESSION_RESOURCE_SECTIONS[key].zh,
      })),
    [locale],
  );

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
              {showLayoutButton && (
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  title={locale === 'en_US' ? 'Visible panels' : '显示面板'}
                  content={
                    <Checkbox.Group
                      value={[...stackSectionKeys]}
                      options={sectionOptions}
                      onChange={(values) =>
                        setVisibleSectionKeys(
                          STACK_SECTION_KEYS.filter((key) => values.includes(key)),
                        )
                      }
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    />
                  }
                >
                  <Button
                    type={showStack ? 'text' : 'default'}
                    size="small"
                    icon={<LayoutOutlined />}
                    aria-pressed={showStack}
                    aria-label={locale === 'en_US' ? 'Choose panels' : '选择面板'}
                  >
                    Layout
                  </Button>
                </Popover>
              )}
              {/* 折叠 / 展开右侧堆叠面板：折叠时只显示图标，展开时与 Layout 并排。 */}
              {showStack && (
                <Button
                  size="small"
                  type={rightPaneCollapsed ? 'default' : 'text'}
                  icon={rightPaneCollapsed ? <LeftOutlined /> : <RightOutlined />}
                  aria-pressed={!rightPaneCollapsed}
                  aria-label={
                    rightPaneCollapsed
                      ? locale === 'en_US'
                        ? 'Expand panels'
                        : '展开面板'
                      : locale === 'en_US'
                        ? 'Collapse panels'
                        : '折叠面板'
                  }
                  title={
                    rightPaneCollapsed
                      ? locale === 'en_US'
                        ? 'Expand panels'
                        : '展开面板'
                      : locale === 'en_US'
                        ? 'Collapse panels'
                        : '折叠面板'
                  }
                  onClick={() => setRightPaneCollapsed(!rightPaneCollapsed)}
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
          ) : undefined
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

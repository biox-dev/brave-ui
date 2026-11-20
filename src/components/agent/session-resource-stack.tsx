import { FC, useEffect, useMemo, useRef } from 'react';
import { Button, Empty, Tooltip } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { AgentSessionResourceType } from '@/api/agent';
import PanelLayout from '@/components/common/panel-layout';
import SessionResourcePanel from '@/components/agent/session-resource-panel';
import { useAgentSessionResources } from '@/components/agent/use-agent-session-resources';
import SiderStackLayout, {
  type SiderStackSection,
} from '@/components/layout-sider/sider-stack-layout';
import { useSiderStackCollapsed } from '@/components/layout-sider/use-sider-stack-collapsed';
import { useComponentStore } from '@/event-bus/stores/components';
import { useI18n } from '@/hooks/useI18n';

/** 后端「会话资源有新增」事件的组件类目 / 方法名。 */
const REALTIME_CATEGORY = 'agent-session-resource';
const REALTIME_METHOD = 'sessionResourcesChanged';

/** 后端可能把 args 作为 map 或数组下发，这里统一成对象。 */
const normalizeRealtimeArgs = (
  args: unknown,
): { session_id?: string; resource_type?: string } => {
  if (Array.isArray(args)) {
    return (args[0] ?? {}) as { session_id?: string; resource_type?: string };
  }
  if (args && typeof args === 'object') {
    return args as { session_id?: string; resource_type?: string };
  }
  return {};
};

/** 折叠状态持久化的 key（redux `user.leftStackCollapsed`）。 */
const STACK_COLLAPSED_STORAGE_KEY = 'agentSessionRightStack';

/** 分组展示顺序与标题。 */
const SECTIONS: { resourceType: AgentSessionResourceType; zh: string; en: string }[] = [
  { resourceType: 'script', zh: '脚本', en: 'Scripts' },
  { resourceType: 'workflow', zh: '工作流', en: 'Workflows' },
  { resourceType: 'analysis', zh: '分析工作流', en: 'Analysis Workflow' },
  { resourceType: 'analysis_node', zh: '分析节点', en: 'Analysis Nodes' },
  { resourceType: 'project_report', zh: '报告', en: 'Reports' },
];

export interface SessionResourceStackProps {
  /** 当前会话 ID；New Chat（无会话）时不发起请求。 */
  sessionId?: string;
  /** 右侧面板整体是否展开：折叠时不请求接口。 */
  active: boolean;
  /** New Chat / 新建会话时清空内容（不展示上一个会话的结果）。 */
  cleared?: boolean;
  /** 关闭整个右侧面板。 */
  onClose?: () => void;
}

/**
 * 会话结果面板。
 *
 * 外层使用统一的 `PanelLayout` 骨架（固定高度标题栏 + 可滚动内容区）：
 * 标题栏里放大标题、刷新与关闭按钮，堆叠内容直接放进 `children`。
 * 每个有数据的资源类型是 `SiderStackLayout` 的一个分区：可独立折叠、
 * 相邻分区可拖拽调高；没有任何数据时在内容区展示空状态。
 *
 * 数据来自 `useAgentSessionResources`：与各分区共用同一个 query key，
 * React Query 自动去重；后端实时事件也只在这里注册一次。
 */
const SessionResourceStack: FC<SessionResourceStackProps> = ({
  sessionId,
  active,
  cleared = false,
  onClose,
}) => {
  const { locale } = useI18n();

  const [collapsedKeys, setCollapsedKeys] = useSiderStackCollapsed(
    STACK_COLLAPSED_STORAGE_KEY,
  );

  const { data: groups, isFetching, refetch } = useAgentSessionResources(
    sessionId,
    active,
    cleared,
  );

  // 后端新增「会话 ↔ 资源」关联时刷新共享数据：只响应本会话的事件；
  // 资源明细可能稍后才落库，延迟一次再拉。
  //
  // 注册不依赖 active：面板折叠时后端仍会推送，若此时没有监听者，
  // 之后展开只能等 staleTime 过期，表现为「事件到了但 UI 没刷新」。
  // 折叠期收到的事件只做标记，展开时补一次刷新。
  const { register, unregister } = useComponentStore();
  const pendingRefreshRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const instance = {
      [REALTIME_METHOD]: (rawArgs?: unknown) => {
        const args = normalizeRealtimeArgs(rawArgs);
        if (args.session_id && String(args.session_id) !== String(sessionId)) {
          return;
        }
        if (!activeRef.current) {
          pendingRefreshRef.current = true;
          return;
        }
        pendingRefreshRef.current = false;
        window.setTimeout(() => void refetch(), 300);
      },
    };
    // 按会话 ID 注册：后端推送的 component.invoke 里 id 就是会话 ID，
    // 定向投递到本会话，其它会话的面板不会被误触发。
    register(REALTIME_CATEGORY, sessionId, instance);
    return () => unregister(REALTIME_CATEGORY, sessionId, instance);
  }, [refetch, register, sessionId, unregister]);

  // 折叠期错过的推送：展开时补拉一次。
  useEffect(() => {
    if (active && pendingRefreshRef.current && sessionId) {
      pendingRefreshRef.current = false;
      void refetch();
    }
  }, [active, refetch, sessionId]);

  // 只有有数据的分组才展示。
  const visibleSections = useMemo(
    () => (cleared ? [] : SECTIONS.filter((s) => (groups?.[s.resourceType]?.length ?? 0) > 0)),
    [cleared, groups],
  );

  const stackSections = useMemo<SiderStackSection[]>(
    () =>
      visibleSections.map((section) => ({
        key: section.resourceType,
        render: ({ collapsed, toggle }) => (
          <div className="project-report-panel session-resource-section">
            <div className="project-report-panel-header">
              <button
                type="button"
                className="project-report-panel-title project-report-panel-title-button"
                aria-expanded={!collapsed}
                onClick={toggle}
              >
                {collapsed ? (
                  <CaretRightOutlined className="project-report-panel-chevron" />
                ) : (
                  <CaretDownOutlined className="project-report-panel-chevron" />
                )}
                <span>{locale === 'en_US' ? section.en : section.zh}</span>
              </button>
            </div>
            {collapsed ? null : (
              <SessionResourcePanel
                sessionId={sessionId}
                resourceType={section.resourceType}
                active={active}
              />
            )}
          </div>
        ),
      })),
    [active, locale, sessionId, visibleSections],
  );

  const title = locale === 'en_US' ? 'Session results' : '会话结果';
  const emptyText = !sessionId
    ? locale === 'en_US'
      ? 'No active session'
      : '暂无会话'
    : locale === 'en_US'
      ? 'No results'
      : '暂无结果';
  const refreshLabel = locale === 'en_US' ? 'Refresh' : '刷新';

  return (
    <PanelLayout
      title={title}
      extra={
        <Tooltip title={refreshLabel}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={isFetching} />}
            aria-label={refreshLabel}
            disabled={!sessionId || !active || cleared}
            onClick={() => void refetch()}
          />
        </Tooltip>
      }
      onClose={onClose}
      closeLabel={locale === 'en_US' ? 'Close panel' : '关闭面板'}
    >
      {stackSections.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      ) : (
        <SiderStackLayout
          sections={stackSections}
          collapsedKeys={collapsedKeys}
          onCollapsedKeysChange={setCollapsedKeys}
          resizeLabel={locale === 'en_US' ? 'Resize panels' : '调整面板高度'}
        />
      )}
    </PanelLayout>
  );
};

export default SessionResourceStack;

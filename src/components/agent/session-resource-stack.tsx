import { FC, useEffect, useMemo } from 'react';
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

/** 后端「会话资源有新增」事件的组件类目 / 方法名 / 注册 ID。 */
const REALTIME_CATEGORY = 'agent-session-resource';
const REALTIME_METHOD = 'sessionResourcesChanged';
const REALTIME_ID = '*';

/** 折叠状态持久化的 key（redux `user.leftStackCollapsed`）。 */
const STACK_COLLAPSED_STORAGE_KEY = 'agentSessionRightStack';

/** 分组展示顺序与标题。 */
const SECTIONS: { resourceType: AgentSessionResourceType; zh: string; en: string }[] = [
  { resourceType: 'script', zh: '脚本', en: 'Scripts' },
  { resourceType: 'workflow', zh: '工作流', en: 'Workflows' },
  { resourceType: 'analysis', zh: '分析工作流', en: 'Analysis Workflow' },
  { resourceType: 'analysis_node', zh: '分析节点', en: 'Analysis Nodes' },
  { resourceType: 'app_session', zh: '应用会话', en: 'App Sessions' },
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
  const { register, unregister } = useComponentStore();
  useEffect(() => {
    if (!sessionId || !active) {
      return;
    }
    const instance = {
      [REALTIME_METHOD]: (args?: { session_id?: string }) => {
        if (args?.session_id && args.session_id !== sessionId) {
          return;
        }
        window.setTimeout(() => void refetch(), 300);
      },
    };
    register(REALTIME_CATEGORY, REALTIME_ID, instance);
    return () => unregister(REALTIME_CATEGORY, REALTIME_ID, instance);
  }, [active, refetch, register, sessionId, unregister]);

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

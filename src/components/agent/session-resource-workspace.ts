import type { AgentSessionResourceItem, AgentSessionResourceType } from '@/api/agent';
import { openAgentWorkspaceTab } from '@/layout/agent-workspace-store';
import {
  ANALYSIS_NODE_TAB_KEY_PREFIX,
  ANALYSIS_TAB_KEY_PREFIX,
  PROJECT_REPORT_TAB_KEY_PREFIX,
  SCRIPT_TAB_KEY_PREFIX,
  WORKFLOW_TAB_KEY_PREFIX,
} from '@/layout/workspace-navigation';

/**
 * 会话结果（右侧堆叠分区）→ 右侧工作区标签的**唯一映射**。
 *
 * 会话页右侧的每个堆叠分区对应一种 `AgentSessionResourceType`（脚本 / 工作流 /
 * 分析节点 / 分析运行 / 项目报告）。点击分区里的某一项时，这里统一决定：
 *   - 用哪个 ViewResolver 视图渲染（`view`）；
 *   - 视图需要什么参数（`params`，由资源项推导）；
 *   - 标签 key 前缀（`tabKeyPrefix`，同一资源重复点击复用同一个标签）。
 *
 * 新增一种可点击的资源时只改这里，`SessionResourcePanel` 与后续其它入口都自动生效；
 * 每个登记过的资源类型都可在右侧工作区打开。
 */
export interface SessionResourceWorkspaceTarget {
  /** ViewResolver 的视图名（必须是 component-registry 里注册过的 key）。 */
  view: string;
  /** 标签 key 前缀：最终 key = `${tabKeyPrefix}:${resource_id}`。 */
  tabKeyPrefix: string;
  /** 由资源项生成传给视图的 props。 */
  params: (item: AgentSessionResourceItem) => Record<string, unknown>;
}

/**
 * 各资源类型对应的右侧工作区视图。
 *
 * 注意：
 * - `analysis`（分析运行）没有独立路由页，打开该分析下的节点列表（analysisNodePage）；
 * - `analysis_node` 打开节点详情（analysisNodeDetails）；
 * - `plan` 打开计划节点树（planDetail）；
 * - `project_report` 打开报告正文文件（projectReportFile）；
 * - `script` / `workflow` 分别打开统一登记在详情视图中的详情页。
 */
export const SESSION_RESOURCE_WORKSPACE_TARGETS: Partial<
  Record<AgentSessionResourceType, SessionResourceWorkspaceTarget>
> = {
  script: {
    view: 'scriptPanelDetail',
    tabKeyPrefix: SCRIPT_TAB_KEY_PREFIX,
    params: (item) => ({ component_type: 'script', script_id: item.resource_id }),
  },
  workflow: {
    view: 'workflowPanelDetail',
    tabKeyPrefix: WORKFLOW_TAB_KEY_PREFIX,
    params: (item) => ({ workflow_id: item.resource_id }),
  },
  analysis: {
    view: 'analysisNodePage',
    tabKeyPrefix: ANALYSIS_TAB_KEY_PREFIX,
    params: (item) => ({ analysis_id: item.resource_id }),
  },
  analysis_node: {
    view: 'analysisNodeDetails',
    tabKeyPrefix: ANALYSIS_NODE_TAB_KEY_PREFIX,
    params: (item) => ({ analysis_node_id: item.resource_id }),
  },
  plan: {
    view: 'planDetail',
    tabKeyPrefix: 'session-plan',
    params: (item) => ({ planId: item.resource_id }),
  },
  project_report: {
    view: 'projectReportFile',
    tabKeyPrefix: PROJECT_REPORT_TAB_KEY_PREFIX,
    params: (item) => ({ reportId: item.resource_id, defaultMode: 'view' }),
  },
};

/** 取某个资源类型的工作区视图配置；未登记 = 该项不可点击打开。 */
export const getSessionResourceWorkspaceTarget = (
  resourceType?: AgentSessionResourceType,
): SessionResourceWorkspaceTarget | undefined =>
  resourceType ? SESSION_RESOURCE_WORKSPACE_TARGETS[resourceType] : undefined;

/** 该资源类型是否支持点击后在右侧工作区打开。 */
export const isSessionResourceOpenable = (
  resourceType?: AgentSessionResourceType,
): boolean => Boolean(getSessionResourceWorkspaceTarget(resourceType));

/**
 * 资源项在右侧工作区里的标签 key。
 *
 * 标签 key 由映射统一生成：列表用它判断「这一条是否正在右侧显示」，
 * 打开标签时也用它保证同一条资源重复点击只聚焦、不重复开标签。
 */
export const getSessionResourceTabKey = (
  item: Pick<AgentSessionResourceItem, 'resource_type' | 'resource_id'>,
): string | undefined => {
  const target = getSessionResourceWorkspaceTarget(item.resource_type);
  return target ? `${target.tabKeyPrefix}:${item.resource_id}` : undefined;
};

/**
 * 把一条会话结果在右侧工作区（SplitWorkspace 的 rightMiddle 区域）打开或聚焦。
 */
export const openSessionResourceTab = (
  sessionId: string | undefined,
  item: AgentSessionResourceItem,
  title: string,
): boolean => {
  const key = getSessionResourceTabKey(item);
  const target = getSessionResourceWorkspaceTarget(item.resource_type);
  if (!sessionId || !key || !target) {
    return false;
  }
  openAgentWorkspaceTab(sessionId, {
    key,
    title,
    view: target.view,
    params: target.params(item),
  });
  return true;
};

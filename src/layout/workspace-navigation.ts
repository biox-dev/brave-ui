import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router";
import { openAgentWorkspaceTab, useAgentWorkspace } from "./agent-workspace-store";

/**
 * 「同一资源，两种打开方式」的统一约定
 * ============================================================
 * 很多列表（分析节点、脚本、项目报告…）里的同一条资源，需要在两种页面里点开：
 *
 * 1. Agent 会话页（`/session`、`/session/:sessionId`）：
 *    在右侧工作区（`MainTabs`）打开一个标签，用 `view` + `params` 交给 `ViewResolver` 渲染；
 * 2. 其它页面：按资源自己的路由跳转（`routePath`）。
 *
 * 各列表只需要把「资源 → 标签 / 路由」描述一次（`WorkspaceOpenTarget`），
 * 由 `openWorkspaceTarget` 统一决定用哪种方式打开，避免每个列表各写一份
 * `if (当前是会话页)` 分支。新增页面时复用同一套函数即可。
 */

/** Agent 会话页路径的解析结果。 */
export type AgentSessionPathMatch = {
  /** pathname 是否命中 Agent 会话页（`/session` 及其子路径）。 */
  matched: boolean;
  /** 会话 ID；New Chat（`/session` 不带 ID）为 undefined。 */
  sessionId?: string;
};

/** 分析节点详情在右侧工作区里的标签 key 前缀（多个入口共用，保证聚焦同一个标签）。 */
export const ANALYSIS_NODE_TAB_KEY_PREFIX = "session-analysis-node";
/** 分析运行（节点列表视图）的标签 key 前缀，与 `session-resource-workspace` 的 analysis 一致。 */
export const ANALYSIS_TAB_KEY_PREFIX = "session-analysis";
/** 脚本详情的标签 key 前缀。 */
export const SCRIPT_TAB_KEY_PREFIX = "session-script";
/** 工作流详情的标签 key 前缀。 */
export const WORKFLOW_TAB_KEY_PREFIX = "session-workflow";
/** 文献详情的标签 key 前缀。 */
export const LITERATURE_TAB_KEY_PREFIX = "session-literature";
/** 项目报告正文（output.md）的标签 key 前缀，与 `session-resource-workspace` 一致。 */
export const PROJECT_REPORT_TAB_KEY_PREFIX = "session-project-report";
/** 数据集文件（文件查看详情）的标签 key 前缀。 */
export const DATASET_FILE_TAB_KEY_PREFIX = "session-dataset-file";

/**
 * 解析 pathname 是否命中 Agent 会话页，命中时取出会话 ID。
 *
 * 只做纯字符串判断，不依赖 react-router 的 params 名字，所以列表组件、
 * 工具函数（无 hook 上下文）里也能直接用同一份规则。
 */
export const parseAgentSessionPath = (pathname?: string): AgentSessionPathMatch => {
  const segments = (pathname || "/").split("/").filter(Boolean);
  if (segments[0] !== "session") {
    return { matched: false };
  }
  const raw = segments[1];
  if (!raw) {
    return { matched: true };
  }
  try {
    return { matched: true, sessionId: decodeURIComponent(raw) };
  } catch {
    // 非法的百分号编码：原样使用，避免因为一个坏链接整页抛错。
    return { matched: true, sessionId: raw };
  }
};

/** 当前路由是否在 Agent 会话页（以及当前会话 ID）。 */
export const useAgentSessionPath = (): AgentSessionPathMatch => {
  const { pathname } = useLocation();
  return useMemo(() => parseAgentSessionPath(pathname), [pathname]);
};

/**
 * 一条资源「在右侧工作区怎么开 / 不在会话页时跳哪」的描述。
 *
 * - `tabKeyPrefix` + `resourceId` 决定标签 key：同一资源重复点击只聚焦、不重复开标签；
 * - `params` 是传给 `ViewResolver` 视图的 props；
 * - `routePath` 是非会话页时的普通路由地址。
 */
export type WorkspaceOpenTarget = {
  /** ViewResolver 的视图名（必须是 component-registry 里注册过的 key）。 */
  view: string;
  /** 标签显示名（MainTabs 上的文字）。 */
  title: string;
  /** 标签 key 前缀：最终 key = `${tabKeyPrefix}:${resourceId}`。 */
  tabKeyPrefix: string;
  /** 资源 ID：参与标签 key 计算。 */
  resourceId: string;
  /** 传给视图组件的参数。 */
  params?: Record<string, unknown>;
  /** 不在 Agent 会话页时跳转的路由地址。 */
  routePath: string;
};

/** 资源在右侧工作区里的标签 key（各列表用它判断「这一条是否正在右侧显示」）。 */
export const workspaceTargetKey = (target: Pick<WorkspaceOpenTarget, "tabKeyPrefix" | "resourceId">) =>
  `${target.tabKeyPrefix}:${target.resourceId}`;

/** 打开结果：在右侧标签里打开，或退化成路由跳转。 */
export type WorkspaceOpenResult = "tab" | "route";

/**
 * 按当前 pathname 决定打开方式：
 * - Agent 会话页（`/session` 与 `/session/:sessionId`）：在右侧 `MainTabs` 打开 / 聚焦标签；
 *   New Chat（`/session` 还没有会话 ID）先写进 `__new__` 工作区，会话创建后由页面迁移过去；
 * - 其它页面：路由跳转到 `routePath`。
 */
export const openWorkspaceTarget = (
  pathname: string | undefined,
  navigate: NavigateFunction,
  target: WorkspaceOpenTarget
): WorkspaceOpenResult => {
  const { matched, sessionId } = parseAgentSessionPath(pathname);
  if (matched) {
    openAgentWorkspaceTab(sessionId, {
      key: workspaceTargetKey(target),
      title: target.title,
      view: target.view,
      params: target.params,
    });
    return "tab";
  }
  navigate(target.routePath);
  return "route";
};

/** `openWorkspaceTarget` 的 hook 版本：自动带上当前 pathname 与 navigate。 */
export const useWorkspaceOpener = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (target: WorkspaceOpenTarget) => openWorkspaceTarget(pathname, navigate, target),
    [navigate, pathname]
  );
};

/**
 * 会话页右侧「当前激活标签」里属于某个资源前缀的资源 ID（不在会话页 / 激活的是别的资源时为 undefined）。
 *
 * 列表用它做行高亮：右侧正在看某个节点 / 脚本 / 报告时，左边对应行保持选中态，
 * 与在详情路由页时用路由高亮的体验一致。
 */
export const useActiveWorkspaceResourceId = (tabKeyPrefix: string): string | undefined => {
  const { matched, sessionId } = useAgentSessionPath();
  const workspace = useAgentWorkspace(matched ? sessionId : undefined);
  return useMemo(() => {
    if (!matched) {
      return undefined;
    }
    const prefix = `${tabKeyPrefix}:`;
    return workspace.active.startsWith(prefix) ? workspace.active.slice(prefix.length) : undefined;
  }, [matched, tabKeyPrefix, workspace.active]);
};

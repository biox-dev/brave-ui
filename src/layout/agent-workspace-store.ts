import { create } from 'zustand';

/**
 * Agent 会话页（`/session/:sessionId`）右侧工作区的标签状态。
 *
 * 与主区域 `MainTabs` 的区别：
 * - `MainTabs` 的标签来自「访问过的路由」并落库到后端；
 * - 这里的标签是「从聊天内容打开的页面」，只属于当前会话，不参与路由跳转，
 *   也不落库（后续做「点击聊天内容打开右侧页面」时调用 `openAgentWorkspaceTab` 即可）。
 *
 * 标签用 `view`（ViewResolver 的视图名）+ `params` 描述要渲染的内容，
 * 右侧面板顶部是标签栏（MainTabs），下方是 `<ViewResolver view={view} />`。
 */

export type AgentWorkspaceTab = {
  /** 标签唯一键（同一页面重复打开时复用并聚焦）。 */
  key: string;
  /** 标签显示名。 */
  title: string;
  /** ViewResolver 的视图名，例如 datasetProjectPage / scriptPage。 */
  view: string;
  /** 传给视图组件的参数。 */
  params?: Record<string, unknown>;
};

type SessionWorkspace = {
  tabs: AgentWorkspaceTab[];
  active: string;
};

type AgentWorkspaceStore = {
  /** 按会话隔离：每个会话右侧打开的页面互不影响。 */
  bySession: Record<string, SessionWorkspace>;
};

/** 没有会话（New Chat）时使用的 key。 */
const NEW_SESSION_KEY = '__new__';
/** 单个会话最多打开多少个右侧标签。 */
const MAX_TABS = 12;

/** 空工作区：保持引用稳定，避免 zustand selector 每次返回新对象。 */
export const EMPTY_WORKSPACE: SessionWorkspace = { tabs: [], active: '' };

export const sessionWorkspaceKey = (sessionId?: string): string =>
  sessionId?.trim() || NEW_SESSION_KEY;

export const useAgentWorkspaceStore = create<AgentWorkspaceStore>(() => ({
  bySession: {},
}));

/** 订阅某个会话的右侧工作区（无标签时返回稳定的空对象）。 */
export const useAgentWorkspace = (sessionId?: string): SessionWorkspace =>
  useAgentWorkspaceStore(
    (state) => state.bySession[sessionWorkspaceKey(sessionId)] ?? EMPTY_WORKSPACE,
  );

const updateSession = (
  sessionId: string | undefined,
  updater: (current: SessionWorkspace) => SessionWorkspace,
) => {
  const key = sessionWorkspaceKey(sessionId);
  useAgentWorkspaceStore.setState((state) => ({
    bySession: {
      ...state.bySession,
      [key]: updater(state.bySession[key] ?? EMPTY_WORKSPACE),
    },
  }));
};

/** 打开（或聚焦）一个右侧标签：已存在则更新内容并激活。 */
export const openAgentWorkspaceTab = (
  sessionId: string | undefined,
  tab: AgentWorkspaceTab,
) => {
  updateSession(sessionId, (current) => {
    const exists = current.tabs.some((item) => item.key === tab.key);
    const tabs = exists
      ? current.tabs.map((item) => (item.key === tab.key ? { ...item, ...tab } : item))
      : [...current.tabs, tab].slice(-MAX_TABS);
    return { tabs, active: tab.key };
  });
};

/**
 * 原地更新一个已打开标签的内容，但不改变激活状态。
 *
 * 用于「标签已在后台打开、内容随后到达」的场景（如工具调用详情：先打开时还在执行，
 * 结果到达后需要刷新内容）。标签不存在时不做任何事 —— 需要打开请用 openAgentWorkspaceTab。
 */
export const updateAgentWorkspaceTab = (
  sessionId: string | undefined,
  tab: AgentWorkspaceTab,
) => {
  updateSession(sessionId, (current) => {
    if (!current.tabs.some((item) => item.key === tab.key)) {
      return current;
    }
    return {
      ...current,
      tabs: current.tabs.map((item) => (item.key === tab.key ? { ...item, ...tab } : item)),
    };
  });
};

/** 关闭标签：关闭当前标签时切到右侧邻居，否则切到左侧，全部关闭则为空。 */export const closeAgentWorkspaceTab = (
  sessionId: string | undefined,
  tabKey: string,
) => {
  updateSession(sessionId, (current) => {
    const index = current.tabs.findIndex((item) => item.key === tabKey);
    if (index < 0) {
      return current;
    }
    const tabs = current.tabs.filter((item) => item.key !== tabKey);
    if (current.active !== tabKey) {
      return { tabs, active: current.active };
    }
    const nextActive = tabs[index]?.key ?? tabs[index - 1]?.key ?? '';
    return { tabs, active: nextActive };
  });
};

/** 激活一个已打开的标签。 */
export const setActiveAgentWorkspaceTab = (
  sessionId: string | undefined,
  tabKey: string,
) => {
  updateSession(sessionId, (current) =>
    current.tabs.some((item) => item.key === tabKey)
      ? { ...current, active: tabKey }
      : current,
  );
};

/** 关闭某个会话的全部右侧标签（标签栏的「关闭全部」）。 */
export const closeAllAgentWorkspaceTabs = (sessionId: string | undefined) => {
  updateSession(sessionId, (current) =>
    current.tabs.length === 0 ? current : { tabs: [], active: '' },
  );
};

/** 清空某个会话的右侧工作区（如切回 New Chat 时）。 */
export const resetAgentWorkspace = (sessionId?: string) => {
  const key = sessionWorkspaceKey(sessionId);
  useAgentWorkspaceStore.setState((state) => {
    if (!state.bySession[key]) {
      return state;
    }
    const next = { ...state.bySession };
    delete next[key];
    return { bySession: next };
  });
};

/**
 * 把一个会话的右侧工作区复制到另一个会话。
 *
 * 用在「New Chat 发出第一条消息」的场景：地址从 `/session` 变成 `/session/:id` 后，
 * 之前在 New Chat 里打开的标签不应该凭空消失。
 *
 * 这里刻意「只复制、不删来源」：数据路由的地址切换要比这次 store 更新晚一拍，
 * 如果当场删掉 `__new__` 工作区，页面会先按旧地址渲染一帧「没有标签」，
 * 标签栏先关闭再重新出现（闪动）。两边同时有标签就不会出现这一帧。
 * 遗留的 `__new__` 标签由 AgentSessionPage 在下次进入 New Chat 时清掉。
 * 目标会话已有标签时保留它的激活标签，只去重追加复制过来的标签。
 */
export const moveAgentWorkspace = (from?: string, to?: string) => {
  const fromKey = sessionWorkspaceKey(from);
  const toKey = sessionWorkspaceKey(to);
  if (fromKey === toKey) {
    return;
  }
  useAgentWorkspaceStore.setState((state) => {
    const source = state.bySession[fromKey];
    if (!source || source.tabs.length === 0) {
      return state;
    }
    const target = state.bySession[toKey] ?? EMPTY_WORKSPACE;
    const targetKeys = new Set(target.tabs.map((tab) => tab.key));
    const tabs = [...target.tabs, ...source.tabs.filter((tab) => !targetKeys.has(tab.key))];
    return {
      bySession: { ...state.bySession, [toKey]: { tabs, active: target.active || source.active } },
    };
  });
};

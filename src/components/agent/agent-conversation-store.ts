import { create } from "zustand";
import {
  deleteConversationApi,
  pageConversationApi,
  type AgentConversationItem,
  type AgentSessionUser,
} from "@/api/agent";

/**
 * Agent 会话列表的共享状态。
 *
 * 之前会话列表（下拉切换）直接嵌在 `agent-chat.tsx` 里，只有聊天组件自己知道自己
 * 有几个会话。现在会话切换 / New Chat 被抽到左侧「会话」面板（独立活动栏入口），
 * 聊天页仍然会在轮次结束 / 分叉后刷新列表，因此数据放到模块级 store：
 *
 * - 左侧面板：mount 时 / 路由变化时调用 `loadAgentConversations()` 拉取并渲染；
 * - 聊天页：新建会话、轮次结束、fork 后调用同一个函数，两侧看到的是同一份数据；
 * - 同一时刻只会有一个在途请求（`inflight`），避免重复请求。
 */
type AgentConversationStore = {
  conversations: AgentConversationItem[];
  /** 后端返回的会话总数（当前项目）。 */
  total: number;
  /** 当前搜索关键字。 */
  keyword: string;
  loading: boolean;
  /** 追加下一页加载中。 */
  loadingMore: boolean;
  hasMore: boolean;
  /** 是否至少成功拉取过一次（用于区分「还没拉过」与「确实为空」）。 */
  loaded: boolean;
  /**
   * 会话标题缓存（id → title）。
   *
   * 聊天页每次 `/agent/conversation/get` 都能拿到后端维护的最新 title，直接回填到
   * 这里；顶部标题读这份缓存即可，不必再为了显示一个标题去拉整张会话列表。
   */
  titles: Record<string, string>;
  /**
   * 会话参与者缓存（id → users）。
   *
   * 同样由聊天页的 `/agent/conversation/get` 回填：后端按 user 消息去重并回填
   * 用户名，顶部可直接展示「谁用过这个会话」，无需再发请求。
   */
  participants: Record<string, AgentSessionUser[]>;
};

/** 每页条数（懒加载分页大小）。 */
export const PAGE_SIZE = 20;

export const useAgentConversationStore = create<AgentConversationStore>(() => ({
  conversations: [],
  total: 0,
  keyword: "",
  loading: false,
  loadingMore: false,
  hasMore: false,
  loaded: false,
  titles: {},
  participants: {},
}));

// 请求序号：关键字 / 重置会让旧请求的响应直接作废；nextPage 是下一次追加的页码。
let seq = 0;
let nextPage = 1;
let inflightReset: Promise<void> | null = null;
let inflightMore: Promise<void> | null = null;

const collectTitles = (items: AgentConversationItem[]) => {
  const titles = { ...useAgentConversationStore.getState().titles };
  let changed = false;
  for (const item of items) {
    const title = (item.title ?? "").trim();
    if (title && titles[item.id] !== title) {
      titles[item.id] = title;
      changed = true;
    }
  }
  return changed ? titles : null;
};

/** 重置到第一页（保留当前关键字）；返回本轮请求的 Promise。 */
export const loadAgentConversations = (): Promise<void> => {
  const current = useAgentConversationStore.getState();
  const requestSeq = ++seq;
  nextPage = 1;
  useAgentConversationStore.setState({ loading: true });
  const task = pageConversationApi({
    page: 1,
    page_size: PAGE_SIZE,
    ...(current.keyword.trim() ? { keyword: current.keyword.trim() } : {}),
  })
    .then((res) => {
      if (requestSeq !== seq) {
        return;
      }
      const conversations = res.data?.data ?? [];
      const total = res.data?.total ?? 0;
      nextPage = 2;
      const titles = collectTitles(conversations);
      useAgentConversationStore.setState({
        conversations,
        total,
        hasMore: conversations.length > 0 && conversations.length < total,
        loaded: true,
        ...(titles ? { titles } : {}),
      });
    })
    .catch(() => {
      // 错误由全局拦截器提示。
    })
    .finally(() => {
      if (requestSeq === seq) {
        useAgentConversationStore.setState({ loading: false });
      }
      if (inflightReset === task) {
        inflightReset = null;
      }
    });
  inflightReset = task;
  return task;
};

/** 追加下一页（滚动到底部触发）。 */
export const loadMoreAgentConversations = (): Promise<void> => {
  if (inflightMore) {
    return inflightMore;
  }
  const state = useAgentConversationStore.getState();
  if (!state.hasMore || state.loading) {
    return Promise.resolve();
  }
  const requestSeq = seq;
  const page = nextPage;
  useAgentConversationStore.setState({ loadingMore: true });
  const task = pageConversationApi({
    page,
    page_size: PAGE_SIZE,
    ...(state.keyword.trim() ? { keyword: state.keyword.trim() } : {}),
  })
    .then((res) => {
      if (requestSeq !== seq) {
        return;
      }
      const rows = res.data?.data ?? [];
      const total = res.data?.total ?? 0;
      nextPage = page + 1;
      const titles = collectTitles(rows);
      useAgentConversationStore.setState((prev) => {
        const conversations = [...prev.conversations, ...rows];
        return {
          conversations,
          total,
          hasMore: rows.length > 0 && conversations.length < total,
          ...(titles ? { titles } : {}),
        };
      });
    })
    .catch(() => {
      // 错误由全局拦截器提示。
    })
    .finally(() => {
      if (requestSeq === seq) {
        useAgentConversationStore.setState({ loadingMore: false });
      }
      inflightMore = null;
    });
  inflightMore = task;
  return task;
};

/** 设置搜索关键字（防抖由调用方处理），并重置到第一页。 */
export const setAgentConversationKeyword = (keyword: string): Promise<void> => {
  const next = keyword ?? "";
  if (useAgentConversationStore.getState().keyword === next) {
    return Promise.resolve();
  }
  useAgentConversationStore.setState({ keyword: next });
  return loadAgentConversations();
};

/**
 * 确保列表至少成功加载过一次：已加载则不再发请求。
 *
 * 用于各消费方的「挂载」场景（左侧面板 / 聊天页）：两个入口可能先后挂载，
 * 用 `loaded` 去重，避免同一份列表在一个页面启动时被拉两次。
 * 新建会话 / 轮次结束 / fork 这类**数据真的变了**的场景仍直接调 `loadAgentConversations()`。
 */
export const ensureAgentConversations = (): Promise<void> => {
  if (useAgentConversationStore.getState().loaded) {
    return Promise.resolve();
  }
  return inflightReset ?? loadAgentConversations();
};

/**
 * 删除会话并同步本地列表。
 *
 * 后端会级联清理消息 / 文件历史 / 资源关联；这里只把该条目从列表、标题缓存与
 * 参与者缓存中移除，并同步减少总数，避免为了刷新一条记录重新拉取整页。
 * 错误照常抛出，由调用方决定是否提示（全局拦截器已负责错误提示）。
 */
export const removeAgentConversation = async (id: string): Promise<void> => {
  await deleteConversationApi(id);
  useAgentConversationStore.setState((state) => {
    const conversations = state.conversations.filter((item) => item.id !== id);
    const removed = conversations.length !== state.conversations.length;
    const titles = { ...state.titles };
    delete titles[id];
    const participants = { ...state.participants };
    delete participants[id];
    return {
      conversations,
      total: removed ? Math.max(0, state.total - 1) : state.total,
      titles,
      participants,
    };
  });
};

/**
 * 回填单个会话的标题（聊天页详情接口的响应）。
 *
 * 只更新变化过的字段，避免每次刷新会话详情都让订阅者无谓重渲染：
 * - `titles`：顶部标题的唯一数据源（深链时无需先加载列表）；
 * - `conversations`：列表已加载时同步对应条目，保持列表标题与详情一致。
 */
export const upsertConversation = (conv?: AgentConversationItem | null) => {
  if (!conv || !conv.id) {
    return;
  }
  const title = (conv.title ?? "").trim();
  useAgentConversationStore.setState((state) => {
    const next: Partial<AgentConversationStore> = {};
    if (title && state.titles[conv.id] !== title) {
      next.titles = { ...state.titles, [conv.id]: title };
    }
    // 详情接口返回的参与者：直接缓存，不做差异比较 / 旧数据兼容。
    next.participants = { ...state.participants, [conv.id]: conv.users ?? [] };
    const index = state.conversations.findIndex((item) => item.id === conv.id);
    if (index >= 0 && title && state.conversations[index].title !== title) {
      const conversations = [...state.conversations];
      conversations[index] = { ...conversations[index], title };
      next.conversations = conversations;
    }
    return next;
  });
};

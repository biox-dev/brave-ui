import { create } from "zustand";
import { pageConversationApi, type AgentConversationItem } from "@/api/agent";

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
  loading: boolean;
  /** 是否至少成功拉取过一次（用于区分「还没拉过」与「确实为空」）。 */
  loaded: boolean;
  /**
   * 会话标题缓存（id → title）。
   *
   * 聊天页每次 `/agent/conversation/get` 都能拿到后端维护的最新 title，直接回填到
   * 这里；顶部标题读这份缓存即可，不必再为了显示一个标题去拉整张会话列表。
   */
  titles: Record<string, string>;
};

export const useAgentConversationStore = create<AgentConversationStore>(() => ({
  conversations: [],
  loading: false,
  loaded: false,
  titles: {},
}));

let inflight: Promise<void> | null = null;

/** 拉取当前用户的会话列表（左侧会话面板与聊天页共用）。 */
export const loadAgentConversations = (): Promise<void> => {
  if (inflight) {
    return inflight;
  }
  useAgentConversationStore.setState({ loading: true });
  inflight = pageConversationApi({ page: 1, page_size: 100 })
    .then((res) => {
      const conversations = res.data?.data ?? [];
      // 列表接口自带 title：顺手回填标题缓存，使顶部标题无需等聊天详情返回。
      const titles = { ...useAgentConversationStore.getState().titles };
      for (const item of conversations) {
        const title = (item.title ?? "").trim();
        if (title) {
          titles[item.id] = title;
        }
      }
      useAgentConversationStore.setState({ conversations, titles, loaded: true });
    })
    .catch(() => {
      // 错误由全局拦截器提示。
    })
    .finally(() => {
      inflight = null;
      useAgentConversationStore.setState({ loading: false });
    });
  return inflight;
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
  return loadAgentConversations();
};

/**
 * 回填单个会话的标题（聊天页详情接口的响应）。
 *
 * 只更新变化过的字段，避免每次刷新会话详情都让订阅者无谓重渲染：
 * - `titles`：顶部标题的唯一数据源（深链时无需先加载列表）；
 * - `conversations`：列表已加载时同步对应条目，保持列表标题与详情一致。
 */
export const upsertConversation = (conv?: AgentConversationItem | null) => {
  const title = (conv?.title ?? "").trim();
  if (!conv || !conv.id || !title) {
    return;
  }
  useAgentConversationStore.setState((state) => {
    const next: Partial<AgentConversationStore> = {};
    if (state.titles[conv.id] !== title) {
      next.titles = { ...state.titles, [conv.id]: title };
    }
    const index = state.conversations.findIndex((item) => item.id === conv.id);
    if (index >= 0 && state.conversations[index].title !== title) {
      const conversations = [...state.conversations];
      conversations[index] = { ...conversations[index], title };
      next.conversations = conversations;
    }
    return next;
  });
};

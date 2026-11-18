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
};

export const useAgentConversationStore = create<AgentConversationStore>(() => ({
  conversations: [],
  loading: false,
  loaded: false,
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
      useAgentConversationStore.setState({
        conversations: res.data?.data ?? [],
        loaded: true,
      });
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

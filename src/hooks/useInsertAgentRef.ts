import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { setUserItem } from "@/store/userSlice";
import {
  useAgentSenderStore,
  type AgentRefKind,
} from "@/components/agent/agent-sender.store";

export interface InsertAgentRefOptions {
  /** chip 上展示的名字（缺省用 id）。 */
  label?: string;
  /** 是否顺带把右侧面板切到「助手」（默认 true），否则用户看不到插入结果。 */
  reveal?: boolean;
}

/**
 * 把一条 `@<kind>:<id>` 引用 chip 插入 Agent 输入框。
 *
 * 任意页面都可以调用（例如报告文件页插入当前报告 id）：
 *
 * ```tsx
 * const insertAgentRef = useInsertAgentRef();
 * insertAgentRef("report", report?.id, { label: report?.title });
 * ```
 *
 * 实现上写请求到 agent-sender store，由 AgentSender 挂载 / 更新时消费：
 * 面板当时没打开也不会丢请求（先切到「助手」面板，挂载后自动插入 chip）。
 * 用 store + hook 而不是直接拿 ref 调组件方法，是因为触发点与 AgentChat 之间
 * 没有父子关系（AgentChat 在 layout 侧栏），页面也不必依赖 Sender 的内部实现。
 *
 * @returns 是否成功发起请求（id 为空时返回 false）
 */
export const useInsertAgentRef = () => {
  const dispatch = useDispatch();

  return useCallback(
    (
      kind: AgentRefKind,
      id?: string | number | null,
      options: InsertAgentRefOptions = {}
    ) => {
      const value = String(id ?? "").trim();
      if (!value) return false;

      if (options.reveal !== false) {
        // 面板未打开时先切到「助手」；AgentSender 挂载后会消费下面写入的请求。
        dispatch(setUserItem({ sideView: "agentChat" }));
      }

      useAgentSenderStore.getState().requestInsert({
        kind,
        value,
        label: options.label || value,
      });
      return true;
    },
    [dispatch]
  );
};

export default useInsertAgentRef;

import { create } from "zustand";

/**
 * 引用 chip 的类型：决定提交时拼进消息文本的前缀 `@<kind>:<id>`。
 *
 * - file：数据集文件 / 分析节点产物文件（Agent 侧当作路径使用）；
 * - dataset：数据集（Agent 侧用 get_dataset 解析工作目录）；
 * - container：容器模板（Agent 侧用 get_container_template 解析展示名 / 描述）；
 * - report：项目报告（id 由 Agent 侧业务上下文 / 消息文本自行解析）；
 * - analysis_node：分析节点（Agent 侧用 get_analysis_node 查看节点名称 / 类型 / 工作目录 / 参数）。
 */
export type AgentRefKind = "file" | "dataset" | "container" | "report" | "analysis_node";

/** 一次「把引用 chip 插入 Agent 输入框」的请求。 */
export interface AgentRefRequest {
  kind: AgentRefKind;
  /** 引用目标 id，提交时拼成 `@<kind>:<id>`。 */
  value: string;
  /** chip 上展示的名字。 */
  label: string;
  /** 递增序号：即使连续插入同一个引用，也能触发一次新的插入。 */
  seq: number;
}

interface AgentSenderState {
  /** 待消费的插入请求（AgentSender 挂载 / 更新时消费后清空）。 */
  pendingRef: AgentRefRequest | null;
  /** 发起插入请求（外部页面调用，见 hooks/useInsertAgentRef）。 */
  requestInsert: (ref: Omit<AgentRefRequest, "seq">) => void;
  /** 消费插入请求（AgentSender 插入完成后调用）。 */
  consumePendingRef: () => void;
}

/**
 * AgentSender 的跨组件通信 store。
 *
 * AgentChat 挂在 layout 的侧栏里，而「插入一条引用」的触发点可能在任意路由页面
 * （如报告文件页插入报告 id），两者没有父子关系，因此用一个轻量 store 传递请求：
 * 页面写请求 → AgentSender 消费并插入 chip。
 *
 * 之所以不用 ref / Context：AgentSender 可能还没挂载（面板未打开），
 * store 里的请求可以等挂载后再消费，不会丢。
 */
export const useAgentSenderStore = create<AgentSenderState>((set, get) => ({
  pendingRef: null,

  requestInsert: ({ kind, value, label }) => {
    set({
      pendingRef: {
        kind,
        value,
        label,
        seq: (get().pendingRef?.seq ?? 0) + 1,
      },
    });
  },

  consumePendingRef: () => set({ pendingRef: null }),
}));

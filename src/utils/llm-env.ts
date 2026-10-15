import store from "@/store";
import { setUserItem } from "@/store/userSlice";
import { updateAgentEnvApi } from "@/api/auth";
import { ActionDispatcher } from "@/event-bus/dispatcher";

/** AgentChat 注册到 component store 的实例 ID（见 components/agent/agent-chat.tsx）。 */
const AGENT_CHAT_ID = "agent-chat";

/**
 * LLM 业务上下文类型枚举（与后端 handler.EnvType* 约定一致）。
 * 新增业务上下文时需同步后端 agent_runtime_context.go 中的 normalizeEnvType。
 */
export const LLMEnvType = {
  /** 脚本工作区 */
  Script: "script",
  /** 分析（analysis 级） */
  Analysis: "analysis",
  /** 分析节点 */
  AnalysisNode: "analysisNode",
  /** 项目报告 */
  ProjectReport: "projectReport",
} as const;

export type LLMEnv = {
  id?: string;
  type?: string;
};

/**
 * 设置当前用户选中的业务上下文（llmEnv）。
 *
 * 与旧版本（仅写 redux store）不同：这里把 env 持久化到后端当前用户记录上的
 * AgentConfig.EnvID / EnvType，随后用返回的最新 userInfo 同步 redux。
 * 后端解析系统提示词模板变量与工作目录时直接读取该用户配置，
 * 因此不再需要在 chat / describe 请求里携带 env。
 *
 * 调用方式与旧 setLLMEnv 保持一致：setLLMEnv(id, type)。
 *
 * 刷新时机：写入后端成功后，通过 ActionDispatcher 派发 component.invoke，
 * 调用 AgentChat 注册在 component store 上的 loadEnvInfo()，重新解析顶部上下文。
 * 这样解析一定发生在写入之后，不再与 AgentChat 自身的挂载解析产生竞态
 * （旧实现依赖 llmEnv 引用变化触发 effect，而后端的 describe 与 agent-env 写入
 * 是两次独立异步请求，响应先后顺序不确定，UI 会残留旧 envInfo）。
 *
 * @param id 业务对象 id（如 project report id / analysis node id / analysis id）
 * @param type 业务上下文类型，推荐使用 LLMEnvType 枚举；为空表示清空上下文
 * @returns 请求 Promise（页面通常无需 await，失败仅记录日志，避免阻断交互）
 */
export const setLLMEnv = async (id?: string, type?: string) => {
  // 乐观更新本地，保证 UI（如顶部上下文标签）立即反映新环境。
  // 每次写入都使用新的 llmEnv 对象引用：即使 id / type 与上次相同，
  // AgentChat 中依赖 llmEnv 的 effect 也会重新解析（连续点击同一按钮也能生效）。
  store.dispatch(
    setUserItem({
      llmEnv: { id, type },
    })
  );

  try {
    const res = await updateAgentEnvApi({ env_id: id ?? "", env_type: type ?? "" });
    const fresh = res.data?.user;
    if (fresh) {
      // 同步后端返回的最新 userInfo（含 agent_config.env_id / env_type）。
      store.dispatch(setUserItem({ userInfo: fresh }));
    }
    // 后端已落库：通知 AgentChat 重新解析业务上下文（此时 describe 必为最新值）。
    ActionDispatcher.dispatch("component.invoke", {
      category: "store",
      id: AGENT_CHAT_ID,
      method: "loadEnvInfo",
    });
    return res.data;
  } catch {
    // 错误由全局拦截器提示；本地乐观状态保留，避免阻塞页面渲染。
  }
};


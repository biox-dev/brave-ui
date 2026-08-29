import store from "@/store";
import { setUserItem } from "@/store/userSlice";

/**
 * LLM 业务上下文类型枚举（与后端 handler.RuntimeEnvType 约定一致）。
 * 新增业务上下文时需同步后端 runtime_context.go 中的 normalizeEnvType。
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
 * 设置全局 llmEnv 到 redux store。
 * @param id 业务对象 id（如 project report id / analysis node id 等）
 * @param type llm 环境类型，推荐使用 LLMEnvType 枚举
 */
export const setLLMEnv = (id?: string, type?: string) => {
  store.dispatch(
    setUserItem({
      llmEnv: {
        id,
        type,
      },
    })
  );
};

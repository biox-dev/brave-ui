import store from "@/store";
import { setUserItem } from "@/store/userSlice";

/**
 * 设置全局 llmEnv 到 redux store。
 * @param id 业务对象 id（如 project report id / session id 等）
 * @param type llm 环境类型，默认 "projectReport"
 */
export const setLLMEnv = (id?: string, type?: string ) => {
  store.dispatch(
    setUserItem({
      llmEnv: {
        id,
        type,
      },
    })
  );
};

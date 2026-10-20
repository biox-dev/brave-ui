import { http } from "@/api/client/http";
import { getPathname } from "@/utils/utils";

export interface AgentAnalysisItem {
  id: string;
  project_id: string;
  name: string;
  template_id: string;
  command: string;
  container_instance_id?: string;
  status: string;
  exit_code: number;
  error_message?: string;
  workspace_dir: string;
  command_path?: string;
  log_path?: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentAnalysisPayload {
  name: string;
  template_id: string;
  command: string;
  workspace_dir?: string;
}

export interface UpdateAgentAnalysisPayload {
  id: string;
  name?: string;
  template_id?: string;
  command?: string;
  workspace_dir?: string;
}

export const createAgentAnalysisApi = (payload: CreateAgentAnalysisPayload) => {
  return http.post<AgentAnalysisItem>("/container/agent-analysis/create", payload);
};

export const listAgentAnalysisApi = () => {
  return http.get<AgentAnalysisItem[]>("/container/agent-analysis/list");
};

export const getAgentAnalysisApi = (id: string) => {
  return http.get<AgentAnalysisItem>("/container/agent-analysis/get", { params: { id } });
};

export const updateAgentAnalysisApi = (payload: UpdateAgentAnalysisPayload) => {
  return http.post<AgentAnalysisItem>("/container/agent-analysis/update", payload);
};

export const deleteAgentAnalysisApi = (id: string) => {
  return http.post<{ message: string }>("/container/agent-analysis/delete", { id });
};

/** 用当前模板与命令重新创建一个容器实例。 */
export const rerunAgentAnalysisApi = (id: string) => {
  return http.post<AgentAnalysisItem>("/container/agent-analysis/rerun", { id });
};

/** 停止运行中的（或取消还在排队的）容器。 */
export const stopAgentAnalysisApi = (id: string) => {
  return http.post<AgentAnalysisItem>("/container/agent-analysis/stop", { id });
};

/**
 * 读取任务的命令日志（WorkspaceDir/command.log）。
 *
 * 后端直接返回 text/plain，因此这里用 responseType: "text"；
 * 日志尚未生成时返回 404，由调用方决定如何提示（skipGlobalError）。
 */
export const getAgentAnalysisLogApi = (id: string) => {
  return http.get<string>("/container/agent-analysis/log", {
    params: { id },
    responseType: "text",
    skipGlobalError: true,
  });
};

/**
 * xterm.js 连接运行中容器的 WebSocket 地址。
 *
 * 后端会调用 kubectl exec -it / docker exec -it 打开 /bin/bash；
 * 只有 AgentAnalysis 对应容器处于 running 时才能连接。
 */
export const agentAnalysisTerminalUrl = (id: string) => {
  // getPathname() 返回 origin + 当前部署前缀（例如 http://host 或 http://host/brave）。
  // WebSocket 需要同名部署前缀，因此复用同一份 base，只把 http(s) 换成 ws(s)。
  const base = getPathname().replace(/^http/, "ws");
  return `${base}/api/v1/container/agent-analysis/terminal?id=${encodeURIComponent(id)}`;
};

export const isAgentAnalysisRunning = (status?: string) => /running/i.test(status || "");

/** pending / running 都是进行中：不能重跑，只能停止。 */
export const isAgentAnalysisActive = (status?: string) => /pending|running/i.test(status || "");

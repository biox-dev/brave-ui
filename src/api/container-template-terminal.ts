import { http } from "@/api/client/http";
import { getPathname } from "@/utils/utils";

/**
 * xterm.js 连接「容器模板终端」的 WebSocket 地址。
 *
 * 会话由后端注册表持有（userID + projectID + templateID 唯一），同一个模板重复打开
 * 只会 attach 到同一个 PTY；断开后默认立即删除容器（可用 container.terminal_idle_grace_seconds
 * 配置保留时长），保留期间重新打开会回放历史输出。
 */
export const containerTemplateTerminalUrl = (
  templateId: string | number,
  options?: { since?: number },
) => {
  const base = getPathname().replace(/^http/, "ws");
  const url = `${base}/api/v1/container/template/${encodeURIComponent(String(templateId))}/terminal`;
  const since = options?.since;
  return since === undefined || since === null ? url : `${url}?since=${since}`;
};

export interface ContainerTemplateTerminalExecRequest {
  command: string;
  /** 0（默认）= 只投递命令并立即返回；>0 = 等待命令结束（秒）。 */
  wait_seconds?: number;
  /** 会话不存在时是否自动创建，默认 true。 */
  create_if_missing?: boolean;
}

export interface ContainerTemplateTerminalExecResponse {
  session_id: string;
  accepted: boolean;
  running?: boolean;
  exit_code: number;
  timed_out?: boolean;
  duration_seconds?: number;
  output?: string;
  output_truncated?: boolean;
}

/** 向容器模板终端写入一条命令（UI 按钮 / Agent 共用同一后端实现）。 */
export const execContainerTemplateTerminalApi = (
  templateId: string | number,
  payload: ContainerTemplateTerminalExecRequest,
) => {
  return http.post<ContainerTemplateTerminalExecResponse>(
    `/container/template/${encodeURIComponent(String(templateId))}/terminal/exec`,
    payload,
  );
};

export interface ContainerTemplateTerminalStatus {
  session_id: string;
  exists: boolean;
  alive: boolean;
  subscribers: number;
  seq: number;
}

/** 读取终端会话状态（不存在时 exists=false）。 */
export const getContainerTemplateTerminalStatusApi = (templateId: string | number) => {
  return http.get<ContainerTemplateTerminalStatus>(
    `/container/template/${encodeURIComponent(String(templateId))}/terminal/status`,
  );
};

/** 主动关闭终端会话（关闭 shell 并删除临时容器）。 */
export const closeContainerTemplateTerminalApi = (templateId: string | number) => {
  return http.delete<{ closed: boolean }>(
    `/container/template/${encodeURIComponent(String(templateId))}/terminal`,
  );
};

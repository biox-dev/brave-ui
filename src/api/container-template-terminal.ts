import { http } from "@/api/client/http";
import { getPathname } from "@/utils/utils";

/**
 * xterm.js 连接「容器模板终端」的 WebSocket 地址。
 *
 * 会话由后端注册表持有（userID + projectID + templateID 唯一），同一个模板重复打开
 * 只会 attach 到同一个 PTY。前端一旦接入，该会话即被标记为「持久」：刷新/断网/关标签
 * 都不会删除容器，只有空闲 TTL（container.terminal_session_ttl_minutes）到期或
 * 调 DELETE 才回收；重连时用 since 回放历史输出。
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

/**
 * 终端会话列表项：后端把内存注册表里的会话状态与容器模板绑定行 join 起来。
 * DisplayName 优先取绑定行 display_name，为空时回退模板名，再回退到 session_id。
 */
export interface ContainerTerminalSessionItem {
  session_id: string;
  exists: boolean;
  alive: boolean;
  subscribers: number;
  seq: number;
  user_id?: string;
  project_id?: string;
  template_id?: string;
  /** 持久会话：只能由空闲 TTL 或显式关闭回收。 */
  persistent: boolean;
  /** 当前有命令在执行（此时不会因空闲被回收）。 */
  busy: boolean;
  runtime_id?: string;
  runtime_name?: string;
  created_at?: string;
  last_active?: string;
  display_name: string;
  template_name: string;
  image_name: string;
  app_type: string;
}

/** 列出当前用户的终端会话；默认只返回当前激活项目下的会话。 */
export const listContainerTerminalSessionsApi = (options?: { allProjects?: boolean }) => {
  return http.get<ContainerTerminalSessionItem[]>("/container/terminal/session/list", {
    params: options?.allProjects ? { all_projects: true } : undefined,
  });
};

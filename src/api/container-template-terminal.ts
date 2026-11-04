import { http } from "@/api/client/http";
import { getPathname } from "@/utils/utils";

/**
 * 终端会话模型
 *
 * 容器模板终端会话的创建与 WebSocket 连接是分开的：
 * - `createContainerTerminalSessionApi` 按容器模板新建一条会话（创建时即启动容器与 shell），
 *   返回会话 ID；
 * - `containerTemplateTerminalUrl` 用会话 ID 建 WebSocket（不再按 templateId 连接）；
 * - `execContainerTerminalSessionApi` / `closeContainerTerminalSessionApi` 也只认会话 ID。
 *
 * 一个容器模板可以有多条会话（每次「新建」都是独立容器）；WS 断开不会删除容器，
 * 只有空闲 TTL 到期或显式关闭才回收。
 */

/** xterm.js 连接「终端会话」的 WebSocket 地址（按会话 ID）。 */
export const containerTemplateTerminalUrl = (
  sessionId: string | number,
  options?: { since?: number },
) => {
  const base = getPathname().replace(/^http/, "ws");
  const url = `${base}/api/v1/container/terminal/session/${encodeURIComponent(String(sessionId))}/terminal`;
  const since = options?.since;
  return since === undefined || since === null ? url : `${url}?since=${since}`;
};

/** 终端会话的只读状态（与后端 manager.TerminalSessionStatus 对应）。 */
export interface ContainerTerminalSessionStatus {
  session_id: string;
  exists: boolean;
  alive: boolean;
  subscribers: number;
  seq: number;
  user_id?: string;
  project_id?: string;
  template_id?: string;
  /** 创建该会话的 Agent 会话 ID；为空 / "0" 表示 UI 手动创建。 */
  agent_session_id?: string;
  /** 会话展示名。 */
  name?: string;
  /** 持久会话：只能由空闲 TTL 或显式关闭回收。 */
  persistent: boolean;
  /** 当前有命令在执行（此时不会因空闲被回收）。 */
  busy: boolean;
  runtime_id?: string;
  runtime_name?: string;
  created_at?: string;
  last_active?: string;
}

export interface ContainerTerminalSessionCreateRequest {
  container_template_id: string | number;
  /** 会话展示名；为空时由后端回退到模板展示名 / 模板名 / ID。 */
  name?: string;
  /** 前端 xterm 尺寸：新建会话直接用它建 PTY（可选）。 */
  rows?: number;
  cols?: number;
}

export interface ContainerTerminalSessionCreateResponse extends ContainerTerminalSessionStatus {
  display_name: string;
  template_name: string;
  image_name: string;
  app_type: string;
}

/** 按容器模板新建一条终端会话并立即启动容器，返回会话 ID。 */
export const createContainerTerminalSessionApi = (payload: ContainerTerminalSessionCreateRequest) => {
  return http.post<ContainerTerminalSessionCreateResponse>(
    "/container/terminal/session/create",
    payload,
  );
};

export interface ContainerTemplateTerminalExecRequest {
  command: string;
  /** 0（默认）= 只投递命令并立即返回；>0 = 等待命令结束（秒）。 */
  wait_seconds?: number;
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

/** 向指定终端会话写入一条命令（命令输出走该会话的 WebSocket 实时回传）。 */
export const execContainerTerminalSessionApi = (
  sessionId: string | number,
  payload: ContainerTemplateTerminalExecRequest,
) => {
  return http.post<ContainerTemplateTerminalExecResponse>(
    `/container/terminal/session/${encodeURIComponent(String(sessionId))}/terminal/exec`,
    payload,
  );
};

/** 读取终端会话状态（不存在时 exists=false）。 */
export const getContainerTerminalSessionStatusApi = (sessionId: string | number) => {
  return http.get<ContainerTerminalSessionStatus>(
    `/container/terminal/session/${encodeURIComponent(String(sessionId))}/status`,
  );
};

/** 主动关闭终端会话（关闭 shell 并删除容器）。 */
export const closeContainerTerminalSessionApi = (sessionId: string | number) => {
  return http.delete<{ closed: boolean }>(
    `/container/terminal/session/${encodeURIComponent(String(sessionId))}`,
  );
};

/**
 * 终端会话列表项：后端把内存注册表里的会话状态与容器模板绑定行 join 起来。
 * DisplayName 优先取会话名，为空时回退模板展示名 / 模板名 / session_id。
 */
export interface ContainerTerminalSessionItem extends ContainerTerminalSessionStatus {
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

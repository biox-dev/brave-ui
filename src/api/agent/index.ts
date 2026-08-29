import { http } from "@/api/client/http";
import type { PageRequest, PageResponse } from "@/api/data";

// Agent 任务状态（对应后端 agent.TaskStatus）。
export const AgentTaskStatus = {
  Created: "created",
  Running: "running",
  WaitingPermission: "waiting_permission",
  Completed: "completed",
  Failed: "failed",
  Canceled: "canceled",
} as const;

// Agent 权限状态（对应后端 agent.PermissionStatus）。
export const AgentPermissionStatus = {
  Pending: "pending",
  Approved: "approved",
  Denied: "denied",
  Expired: "expired",
  Canceled: "canceled",
  Consumed: "consumed",
} as const;

// 权限操作对象（对应后端 agent.Operation）。
export interface AgentOperation {
  id?: string;
  type: string;
  path?: string;
  content?: string;
  command?: string;
  metadata?: Record<string, unknown> | null;
}

// 任务（对应后端 agent.Task）。
export interface AgentTaskItem {
  id: string;
  session_id?: string;
  provider: string;
  model?: string;
  status: string;
  working_dir?: string;
  request?: Record<string, unknown> | null;
  error?: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

// 权限请求（对应后端 agent.PermissionRequest）。
export interface AgentPermissionItem {
  id: string;
  task_id: string;
  session_id?: string;
  operation: AgentOperation | null;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

// 任务事件（对应后端 agent.AgentEvent）。
export interface AgentEventItem {
  id: string;
  task_id: string;
  sequence: number;
  type: string;
  payload?: unknown;
  created_at: string;
}

// 创建任务请求（对应后端 agent.Request）。
export interface AgentTaskCreateRequest {
  provider?: string;
  model?: string;
  session_id?: string;
  system_prompt?: string;
  messages?: { role: string; content: string }[];
  working_dir?: string;
  env?: Record<string, string>;
  max_tokens?: number;
  stream?: boolean;
}

// 分页查询参数。注意：后端分页字段（page / page_size）为扁平结构，
// 与 statuses / task_id 同级，无需包裹在 query 中。
export interface AgentTaskPageQuery {
  statuses?: string[];
}

export interface AgentPermissionPageQuery {
  task_id?: string;
  statuses?: string[];
}

export interface AgentEventPageQuery {
  task_id?: string;
}

export const createAgentTaskApi = (payload: AgentTaskCreateRequest) => {
  return http.post<AgentTaskItem>("/agent/task/create", payload);
};

export const pageAgentTaskApi = (payload: PageRequest<AgentTaskPageQuery>) => {
  return http.post<PageResponse<AgentTaskItem>>("/agent/task/page", payload);
};

export const pageAgentPermissionApi = (payload: PageRequest<AgentPermissionPageQuery>) => {
  return http.post<PageResponse<AgentPermissionItem>>("/agent/permission/page", payload);
};

export const pageAgentEventApi = (payload: PageRequest<AgentEventPageQuery>) => {
  return http.post<PageResponse<AgentEventItem>>("/agent/event/page", payload);
};

export const approveAgentPermissionApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/permission/approve", { id });
};

export const denyAgentPermissionApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/permission/deny", { id });
};

// 增量拉取任务事件（返回 sequence 大于 after 的事件）。
export const getAgentTaskEventsApi = (taskId: string, after?: number) => {
  return http.get<AgentEventItem[]>("/agent/task/events", {
    params: { task_id: taskId, after: after ?? 0 },
  });
};

// 获取任务当前待确认的权限请求。
export const getAgentPendingPermissionsApi = (taskId: string) => {
  return http.get<AgentPermissionItem[]>("/agent/task/permissions", {
    params: { task_id: taskId },
  });
};

// 取消 Agent 任务。
export const cancelAgentTaskApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/task/cancel", { id });
};

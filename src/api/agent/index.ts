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

// 技能（对应后端 skill.Manifest）。
export interface AgentSkillItem {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown> | null;
  version?: string;
  instructions?: string;
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

// 会话（对应后端 agent.Conversation）。
export interface AgentConversationItem {
  id: string;
  user_id: string;
  provider: string;
  model?: string;
  messages: { role: string; content: string }[];
  current_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConversationPageQuery {
  // 暂无额外过滤字段
}

// 分页查询当前用户的会话。
export const pageConversationApi = (payload: PageRequest<AgentConversationPageQuery>) => {
  return http.post<PageResponse<AgentConversationItem>>("/agent/conversation/page", payload);
};

// 获取会话（含完整历史消息）。
export const getConversationApi = (id: string) => {
  return http.get<AgentConversationItem>("/agent/conversation/get", { params: { id } });
};

// 获取单个 Agent 任务。
export const getAgentTaskApi = (id: string) => {
  return http.get<AgentTaskItem>("/agent/task/get", { params: { id } });
};

// 多轮对话请求（对应后端 handler.chatRequest）。
export interface AgentChatRequest {
  conversation_id?: string;
  message: string;
  provider?: string;
  model?: string;
  system_prompt?: string;
  working_dir?: string;
  /** 业务上下文 {id,type}，由业务页面通过 setLLMEnv 设置，后端据此解析系统提示词与工作目录。 */
  env?: { id?: string; type?: string } | null;
}

// 多轮对话响应（对应后端 /agent/chat 返回值）。
export interface AgentChatResponse {
  task_id: string;
  conversation_id: string;
}

// 发送一条消息：新建或续接会话，返回本轮任务 ID 与会话 ID。
export const chatAgentApi = (payload: AgentChatRequest) => {
  return http.post<AgentChatResponse>("/agent/chat", payload);
};

// 业务上下文描述（对应后端 RuntimeContextInfo）。
export interface AgentEnvInfo {
  type?: string;
  label?: string;
  working_dir?: string;
  system_prompt?: string;
}

// 解析当前对话的业务上下文，返回人类可读的名称与工作目录。
export const describeAgentEnvApi = (env?: { id?: string; type?: string } | null) => {
  return http.post<AgentEnvInfo>("/agent/env/describe", { env: env ?? null });
};

// 查看全部技能（内置 + 用户自定义）。
export const listAgentSkillApi = () => {
  return http.get<AgentSkillItem[]>("/agent/skill/list");
};

// 当前用户的项目上下文（注入 Agent 系统提示词的背景文本块）。
export interface AgentProjectContextResponse {
  project_context: string;
}

// 查询当前用户激活项目下的项目上下文。
export const getAgentProjectContextApi = () => {
  return http.get<AgentProjectContextResponse>("/agent/project-context");
};

// Agent 记忆类别（对应后端 agent.MemoryKind）。
export const AgentMemoryKind = {
  Fact: "fact",
  Summary: "summary",
  Note: "note",
  Event: "event",
} as const;

// 记忆（对应后端 agent.Memory）。
export interface AgentMemoryItem {
  id: string;
  user_id: string;
  session_id?: string;
  kind: string;
  content: string;
  importance: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
}

export interface AgentMemoryPageQuery {
  kinds?: string[];
}

// 创建 / 更新记忆请求体（ID 为空则新建）。
export interface AgentMemorySaveRequest {
  id?: string;
  session_id?: string;
  kind: string;
  content: string;
  importance?: number;
  metadata?: Record<string, unknown> | null;
}

export const saveAgentMemoryApi = (payload: AgentMemorySaveRequest) => {
  return http.post<AgentMemoryItem>("/agent/memory/save", payload);
};

export const getAgentMemoryApi = (id: string) => {
  return http.get<AgentMemoryItem>("/agent/memory/get", { params: { id } });
};

export const deleteAgentMemoryApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/memory/delete", { id });
};

export const pageAgentMemoryApi = (payload: PageRequest<AgentMemoryPageQuery>) => {
  return http.post<PageResponse<AgentMemoryItem>>("/agent/memory/page", payload);
};

// 检索与 query 相关的记忆（返回按相关度降序）。
export const retrieveAgentMemoryApi = (query: string, limit?: number) => {
  return http.post<AgentMemoryItem[]>("/agent/memory/retrieve", { query, limit });
};

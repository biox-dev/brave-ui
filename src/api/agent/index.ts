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

// 提问状态（对应后端 agent.QuestionStatus）。
export const AgentQuestionStatus = {
  Pending: "pending",
  Answered: "answered",
  Canceled: "canceled",
  Expired: "expired",
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

// 问题选项（对应后端 agent.QuestionOption）。
export interface AgentQuestionOption {
  label: string;
  value: string;
  description?: string;
}

// 单个问题（对应后端 agent.Question）。
export interface AgentQuestion {
  id: string;
  /** single_choice | multiple_choice | text */
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  options?: AgentQuestionOption[];
  allow_custom?: boolean;
  placeholder?: string;
}

// 单个问题的答案（对应后端 agent.QuestionAnswer）。
export interface AgentQuestionAnswer {
  id: string;
  value?: string;
  values?: string[];
  custom?: string;
}

// 一次提问的全部作答（对应后端 agent.AskUserAnswer）。
export interface AgentAskUserAnswer {
  request_id?: string;
  answers: AgentQuestionAnswer[];
}

// 提问请求（对应后端 agent.QuestionRequest）。
export interface AgentQuestionItem {
  id: string;
  task_id: string;
  session_id?: string;
  request_id?: string;
  title?: string;
  description?: string;
  questions: AgentQuestion[];
  status: string;
  answer?: AgentAskUserAnswer | null;
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

// 技能（对应后端 skill.Skill，即一份 SKILL.md）。
export interface AgentSkillItem {
  name: string;
  description: string;
  /** 是否允许用户主动调用（frontmatter user-invocable）。 */
  user_invocable?: boolean;
  /** 为 true 时不注入系统提示词的 <available_skills>（frontmatter disable-model-invocation）。 */
  disable_model_invocation?: boolean;
  /** 技能指令正文。 */
  instructions?: string;
  /** 技能目录。 */
  path?: string;
  /** SKILL.md 文件路径。 */
  skill_file_path?: string;
}

// 创建 / 更新技能请求（对应后端 handler.skillSaveRequest）。
export interface AgentSkillSaveRequest {
  /** 原技能名；为空表示新建。 */
  id?: string;
  name: string;
  description: string;
  user_invocable?: boolean;
  disable_model_invocation?: boolean;
  instructions?: string;
}

// 创建任务请求（对应后端 agent.Request）。
export interface AgentTaskCreateRequest {
  provider?: string;
  model?: string;
  session_id?: string;
  /** AgentProfile ID（为空取默认）。 */
  profile_id?: string;
  /** 本次调用启用的技能名列表（为空使用默认全部技能）。 */
  skills?: string[];
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

export interface AgentQuestionPageQuery {
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

export const pageAgentQuestionApi = (payload: PageRequest<AgentQuestionPageQuery>) => {
  return http.post<PageResponse<AgentQuestionItem>>("/agent/question/page", payload);
};

// 获取任务当前待作答的提问请求。
export const getAgentPendingQuestionsApi = (taskId: string) => {
  return http.get<AgentQuestionItem[]>("/agent/task/questions", {
    params: { task_id: taskId },
  });
};

// 提交用户对一次提问的作答。
export const answerAgentQuestionApi = (id: string, answer: AgentAskUserAnswer) => {
  return http.post<{ ok: boolean; id: string }>("/agent/question/answer", { id, answer });
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
  messages: AgentConversationMessageItem[];
  current_task_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentConversationMessageItem {
  role: string;
  content: string;
  kind?: string;
  task_id?: string;
  data?: unknown;
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

// 任务实际发送给 LLM 的请求内容（对应后端应用 Profile 后的 agent.Request）。
export interface AgentTaskLLMRequest {
  provider?: string;
  model?: string;
  session_id?: string;
  user_id?: string;
  profile_id?: string;
  skills?: string[];
  system_prompt?: string;
  messages?: { role: string; content: string }[];
  working_dir?: string;
  env?: Record<string, string>;
  max_tokens?: number;
  stream?: boolean;
}

// 获取任务实际发送给 LLM 的请求内容（应用 Profile 后的最终 Request）。
export const getAgentTaskRequestApi = (id: string) => {
  return http.get<AgentTaskLLMRequest>("/agent/task/request", { params: { id } });
};

// 多轮对话请求（对应后端 handler.chatRequest）。
export interface AgentChatRequest {
  conversation_id?: string;
  message: string;
  provider?: string;
  model?: string;
  system_prompt?: string;
  /** AgentProfile ID（为空取默认）。 */
  profile_id?: string;
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
  /** 渲染系统提示词模板所用的变量（业务上下文事实）。 */
  vars?: Record<string, unknown> | null;
  /** 用于渲染系统提示词的 Profile 名称。 */
  profile_name?: string;
  /** 用于渲染系统提示词的 Profile ID（雪花 ID，后端以字符串返回）。 */
  profile_id?: string;
}

// 解析当前对话的业务上下文，返回人类可读的名称与工作目录。
export const describeAgentEnvApi = (env?: { id?: string; type?: string } | null) => {
  return http.post<AgentEnvInfo>("/agent/env/describe", { env: env ?? null });
};

// 查看全部技能（内置 + 用户自定义）。
export const listAgentSkillApi = () => {
  return http.get<AgentSkillItem[]>("/agent/skill/list");
};

// 查看单个技能（含指令正文），用于编辑回填。
export const getAgentSkillApi = (id: string) => {
  return http.get<AgentSkillItem>("/agent/skill/get", { params: { id } });
};

// 创建 / 更新技能：写回 SKILL.md 并热更新后端注册表，运行中即时生效。
export const saveAgentSkillApi = (payload: AgentSkillSaveRequest) => {
  return http.post<AgentSkillItem>("/agent/skill/save", payload);
};

// 删除用户技能（仅允许删除 .skills 目录内的技能）。
export const deleteAgentSkillApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/skill/delete", { id });
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

// ---- Agent Profile（对应后端 agent.Profile） ----

// 上下文注入开关（对应后端 agent.ContextConfig）。
export interface AgentProfileContext {
  /** 是否注入长期记忆。 */
  inject_memory: boolean;
}

// AgentProfile（对应后端 agent.Profile）。
export interface AgentProfileItem {
  id: string;
  /** 展示名（仅用于展示，Profile 的查询 / 引用一律使用 id）。 */
  name: string;
  description?: string;
  user_id?: string;
  is_default?: boolean;
  is_builtin?: boolean;
  system_prompt?: string;
  /** 本 Profile 使用的模型名（对应 config.agent.providers 的 key）。 */
  model?: string;
  /** 本 Profile 使用的 Agent（Provider）名称。 */
  provider?: string;
  skills?: string[];
  context?: AgentProfileContext;
  created_at: string;
  updated_at: string;
}

// 创建 / 更新 AgentProfile 请求体（ID 为空则新建）。
export interface AgentProfileSaveRequest {
  id?: string;
  name: string;
  description?: string;
  system_prompt?: string;
  /** 本 Profile 使用的模型名（为空回退到请求级 / Provider 兜底）。 */
  model?: string;
  skills?: string[];
  context?: AgentProfileContext;
  is_default?: boolean;
}

export const listAgentProfileApi = () => {
  return http.get<AgentProfileItem[]>("/agent/profile/list");
};

// 按 ID 查询单个 Agent Profile（内置 Profile 任意用户可读，自定义 Profile 仅限本人）。
export const getAgentProfileApi = (id: string) => {
  return http.get<AgentProfileItem>("/agent/profile/get", { params: { id } });
};

export const saveAgentProfileApi = (payload: AgentProfileSaveRequest) => {
  return http.post<AgentProfileItem>("/agent/profile/save", payload);
};

export const deleteAgentProfileApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/profile/delete", { id });
};

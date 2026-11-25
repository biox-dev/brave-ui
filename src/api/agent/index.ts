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
  /** 人类可读操作摘要（如 "Execute command: ls -la"），批准前展示用。 */
  description?: string;
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
  /** 是否存在持久化执行检查点（后端由 Task.ResumeState 派生）。
   *  failed 且 resumable=true 时，可调用 /agent/task/resume 继续执行。 */
  resumable?: boolean;
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
  /** 本次已作答的问题 ID（逐题提交时用于区分“未答”与“空值”）。 */
  answered_ids?: string[];
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

// 任务实时推送信封（对应后端 agent.AgentEvent；仅用于 WS，历史消息见 agent_messages）。
export interface AgentEventItem {
  id: string;
  task_id: string;
  /** 事件所属会话：订阅按会话生效，前端据此把事件路由到对应会话。 */
  session_id?: string;
  type: string;
  payload?: unknown;
  created_at: string;
  /** 会话内单调递增的流序号：用于和订阅快照的 seq 对齐（见 AgentSessionLive）。 */
  seq?: number;
}

// 技能（对应后端 skill.Skill，即一份 SKILL.md）。
export interface AgentSkillItem {
  name: string;
  description: string;
  /** 为 true 时不注入系统提示词的 <available_skills>（frontmatter disable-model-invocation）。 */
  disable_model_invocation?: boolean;
  /** 为 true 时技能文本（正文 / 附属资源）不做模板渲染，原样返回（frontmatter disable-render）。 */
  disable_render?: boolean;
  /** 技能指令正文；仅详情接口（getAgentSkillApi）返回，列表接口不返回。 */
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
  disable_model_invocation?: boolean;
  disable_render?: boolean;
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

export const createAgentTaskApi = (payload: AgentTaskCreateRequest) => {
  return http.post<AgentTaskItem>("/agent/task/create", payload);
};

export const pageAgentTaskApi = (payload: PageRequest<AgentTaskPageQuery>) => {
  return http.post<PageResponse<AgentTaskItem>>("/agent/task/page", payload);
};

export const pageAgentPermissionApi = (payload: PageRequest<AgentPermissionPageQuery>) => {
  return http.post<PageResponse<AgentPermissionItem>>("/agent/permission/page", payload);
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

// 从持久化检查点继续执行 Agent 任务（后端重启 / 进程崩溃后任务中断时使用）。
export const resumeAgentTaskApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/task/resume", { id });
};

// 会话（对应后端 agent.Conversation）。
//
// 列表接口（/agent/conversation/page）只返回会话本体，不再附带 messages：
// 标题直接使用后端维护的 title，历史消息由 /agent/conversation/get 分页拉取。
export interface AgentConversationItem {
  id: string;
  user_id: string;
  /** 会话发起人的显示名（后端按 user_id join users 表回填，用于项目内会话列表）。 */
  username?: string;
  /** 使用过该会话的用户（仅详情 / fork 接口返回）：后端按 user 消息去重并回填用户名。 */
  users?: AgentSessionUser[];
  provider: string;
  model?: string;
  /** 会话标题（首轮对话时由后端用用户输入初始化）。 */
  title?: string;
  /** 历史消息：仅详情 / fork 接口返回，列表接口为空。 */
  messages?: AgentConversationMessageItem[];
  current_task_id?: string;
  /** 当前轮次的任务状态快照（仅详情接口返回）：无活跃轮次时缺失。 */
  active_task?: AgentActiveTaskStatus;
  /** 是否还有更早的消息（向上滚动时继续加载）。 */
  has_more?: boolean;
  /** 向上翻页游标：下次请求传 before_seq=next_cursor。 */
  next_cursor?: number;
  created_at: string;
  updated_at: string;
}

/** 会话当前轮次的状态快照（对应后端 service.ActiveTaskStatus）。 */
export interface AgentActiveTaskStatus {
  status: string;
  /** 是否存在持久化检查点：failed / canceled 且为 true 时可 Continue。 */
  resumable?: boolean;
  /** 最近一次错误（status 为 failed 时有效）。 */
  error?: string;
}

/** 会话参与者（对应后端 agenttypes.SessionUser）。 */
export interface AgentSessionUser {
  id: string;
  username?: string;
}

export interface AgentConversationMessageItem {
  /** 消息雪花 ID（稳定 key，分页拼接时用于去重）。 */
  id?: string;
  /** 会话内自增序号（升序，分页游标）。 */
  seq?: number;
  role: string;
  content: string;
  kind?: string;
  task_id?: string;
  data?: unknown;
  /** 用户消息归属者的显示名（后端按 user_id IN 查询 users 表回填）。 */
  username?: string;
  /** Agent 侧消息执行者的 Profile 展示名（后端按 profile id IN 查询 agent_profiles 表回填）。 */
  profile_name?: string;
}

// 获取会话的分页参数：不传表示取最新一页。
export interface AgentConversationGetQuery {
  /** 向上翻页游标（上一页返回的 next_cursor）；0 / 不传表示最新一页。 */
  before_seq?: number;
  /** 本页最大条数（后端默认 30，最大 200）。 */
  limit?: number;
}

export interface AgentConversationPageQuery {
  // 暂无额外过滤字段
}

// 分页查询当前用户的会话。
export const pageConversationApi = (payload: PageRequest<AgentConversationPageQuery>) => {
  return http.post<PageResponse<AgentConversationItem>>("/agent/conversation/page", payload);
};

// 获取会话（含一页历史消息）。
//
// 后端默认只返回最新一页；向上滚动时把上一页的 next_cursor 作为 before_seq 继续加载。
export const getConversationApi = (id: string, params?: AgentConversationGetQuery) => {
  return http.get<AgentConversationItem>("/agent/conversation/get", {
    params: { id, ...(params ?? {}) },
  });
};

// Fork 会话：把源会话的历史复制成一个新的独立会话，源会话不变。
// up_to_seq 指定只复制到该消息（含）为止的历史，用于「从某条消息处分叉」。
export const forkConversationApi = (
  id: string,
  payload?: { title?: string; up_to_seq?: number; copy_files?: boolean }
) => {
  return http.post<AgentConversationItem>("/agent/conversation/fork", { id, ...(payload ?? {}) });
};

// 删除会话：级联删除消息、文件历史、任务、权限 / 提问与资源关联（不删除资源本身）。
// 会话仍有正在执行的一轮任务时后端返回 409（需先取消本轮或等其结束）。
export const deleteConversationApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/conversation/delete", { id });
};

// 按任务删除某一轮的消息（含该轮的 user 消息与时间线），不删除任务记录本身。
// 任务仍在执行时后端返回 409。
export const deleteAgentTurnApi = (taskId: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/task/delete", { id: taskId });
};

// 重试某一轮：删除该任务关联的消息（含 user 消息），用该轮原用户输入重新发起一轮。
// 返回新任务与新会话 ID。
export const retryAgentTurnApi = (taskId: string) => {
  return http.post<AgentTurnResponse>("/agent/task/retry", { id: taskId });
};

/** 重试某一轮的响应。 */
export interface AgentTurnResponse {
  task_id: string;
  conversation_id: string;
}
// 会话「实时尾巴」快照：只包含尚未写入数据库的流式内容（正在追加的 assistant /
// reasoning 段）。客户端把它拼在历史消息之后，即可从中间无缝续播。
export interface AgentSessionLiveBlock {
  /** 段的稳定标识（快照与后续增量共用），用作列表 key。 */
  id: string;
  kind: string;
  content: string;
  task_id: string;
  streaming: boolean;
}

export interface AgentSessionLive {
  session_id: string;
  /** 这些内容所属的任务：客户端只对同一任务应用 seq 水位线。 */
  task_id: string;
  /** 会话内单调递增序号：已包含到此为止的所有增量。 */
  seq: number;
  blocks: AgentSessionLiveBlock[];
}

// 订阅 / 退订会话实时事件（WS 推送 agent.event）。
//
// 订阅粒度是会话而不是任务：进入会话页时订阅一次，该会话后续每一轮的任务事件都会
// 推给订阅者；离开页面时退订。会话按项目共享，项目内成员都可以订阅。
//
// 响应里的 live 是「未落库的实时尾巴」：刷新 / 中途进入时用它补齐实时块。
// 重复调用是幂等的，可用于刷新快照（如手动 Reload）。
export const subscribeAgentSessionApi = (sessionId: string) => {
  return http.post<{
    ok: boolean;
    session_id: string;
    subscribed: boolean;
    live?: AgentSessionLive;
  }>("/agent/session/subscribe", { session_id: sessionId });
};

// 退订是页面离开时的清理动作，失败没有可操作项（服务端还有连接断开兜底），
// 因此跳过全局错误提示：删除会话后跳转、切换会话时不应弹出错误弹窗。
export const unsubscribeAgentSessionApi = (sessionId: string) => {
  return http.post<{ ok: boolean; session_id: string; subscribed: boolean }>(
    "/agent/session/unsubscribe",
    { session_id: sessionId },
    { skipGlobalError: true }
  );
};
// 会话结果（会话 ↔ 资源的关联）类型。
// analysis 对应 create_analysis_workflow / update_analysis_workflow 创建或修改的分析运行；
// project_report 对应 create_report / update_report 创建或修改的项目报告；
// plan 对应 create_plan / update_plan 创建或修改的 agent 计划（项目级，可被多个会话共享）。
export type AgentSessionResourceType =
  | "script"
  | "workflow"
  | "analysis_node"
  | "analysis"
  | "project_report"
  | "plan";

// 会话结果项：会话创建 / 修改过的脚本、工作流、分析节点、分析运行、项目报告或计划。
export interface AgentSessionResourceItem {
  /** 会话资源关联行 ID（取消关联时使用，不是资源自身 ID）。 */
  id: string;
  resource_id: string;
  resource_type: AgentSessionResourceType;
  /** 资源展示名（资源已删除时为空）。 */
  name: string;
  created_at: string;
}

// 会话结果按资源类型分组后的结构：每个分组始终是数组（无结果时为空数组）。
export type AgentSessionResourceGroups = Record<
  AgentSessionResourceType,
  AgentSessionResourceItem[]
>;

// 一次查询某个会话的全部结果（后端按资源类型分组返回）。
//
// 会话页右侧的各个分区共用同一份数据，不再按资源类型分别请求。
export const listAllAgentSessionResourcesApi = (sessionId: string) => {
  return http.get<{ data: AgentSessionResourceGroups }>("/agent/session/resources/all", {
    params: { session_id: sessionId },
  });
};

// 取消一条会话资源关联：只删除「会话 ↔ 资源」关联，不删除资源本身。
// id 是关联行 ID（列表项里的 id），不是 resource_id。
export const unlinkAgentSessionResourceApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/session/resources/unlink", { id });
};

// 导出成功的资源：分析节点为目录，项目报告为 .md 文件（path 为导出的绝对路径）。
export interface AgentSessionResourceExportItem {
  resource_id: string;
  resource_type: AgentSessionResourceType;
  name: string;
  path: string;
}

// 未导出的资源及原因（资源已删除、输出目录 / 正文文件不存在等）。
export interface AgentSessionResourceExportFailure {
  resource_id: string;
  resource_type: AgentSessionResourceType;
  reason: string;
}

// 导出会话结果到 <会话工作目录>/report 的返回。
export interface AgentSessionResourceExportResult {
  report_dir: string;
  exported: AgentSessionResourceExportItem[];
  failed: AgentSessionResourceExportFailure[];
}

// 把会话关联的分析节点输出与项目报告拷贝到会话工作目录的 report 目录。
//
// 分析节点按 NodeName 建子目录并拷贝输出目录内容；项目报告拷贝为 <标题>.md。
export const exportAgentSessionResourcesApi = (sessionId: string) => {
  return http.post<{ data: AgentSessionResourceExportResult }>(
    "/agent/session/resources/export",
    undefined,
    { params: { session_id: sessionId } }
  );
};

// 下载会话结果压缩包：后端先把分析节点输出与报告汇总到 report 目录，再打包成 zip 返回。
// 压缩包名称由后端按会话标题写入 Content-Disposition，调用方也可用会话标题作为文件名。
// onProgress 会随传输回调 (已下载字节, 总字节)；总字节未知时为 0。
export const downloadAgentSessionResourcesApi = (
  sessionId: string,
  onProgress?: (loaded: number, total: number) => void
) => {
  return http.get<Blob>("/agent/session/resources/export/download", {
    params: { session_id: sessionId },
    responseType: "blob",
    onDownloadProgress: (event) => {
      onProgress?.(event.loaded, event.total ?? 0);
    },
  });
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

// 上下文描述（对应后端 RuntimeContextInfo）。
export interface AgentEnvInfo {
  label?: string;
  working_dir?: string;
  system_prompt?: string;
  /** 渲染系统提示词模板所用的变量（当前为工作目录相关变量）。 */
  vars?: Record<string, unknown> | null;
  /** 用于渲染系统提示词的 Profile 名称。 */
  profile_name?: string;
  /** 用于渲染系统提示词的 Profile ID（雪花 ID，后端以字符串返回）。 */
  profile_id?: string;
  /** Profile 启用的技能名列表；空数组表示不限制技能（使用全部技能）。 */
  skills?: string[] | null;
}

// 解析当前对话的上下文，返回工作目录与按 Profile 渲染后的系统提示词。
export const describeAgentEnvApi = () => {
  return http.post<AgentEnvInfo>("/agent/env/describe", {});
};

// 查看全部技能（内置 + 用户自定义）的元信息，不含指令正文；正文用 getAgentSkillApi 按需拉取。
export const listAgentSkillApi = () => {
  return http.get<AgentSkillItem[]>("/agent/skill/list");
};

// 查看单个技能（含指令正文），用于编辑回填。
export const getAgentSkillApi = (id: string) => {
  return http.get<AgentSkillItem>("/agent/skill/get", { params: { id } });
};

// 技能解析结果（对应后端 skill.AgentSkillDetail）。
// instructions 是用当前业务上下文渲染后的 SKILL.md 正文，与模型调用 get_skill 拿到的内容一致。
// skill_path 只出现在 HTTP 响应里（工具 get_skill 不返回磁盘路径），仅用于详情弹窗展示。
export interface AgentSkillResolveResult {
  name: string;
  description?: string;
  version?: string;
  skill_path?: string;
  resources?: string[];
  instructions: string;
  /** 技能不存在 / 版本不匹配等业务错误（后端以 200 返回）。 */
  error?: string;
}

// 按名称解析技能并用当前业务上下文渲染（对应后端 GET /agent/skill/resolve）。
export const resolveAgentSkillApi = (id: string) => {
  return http.get<AgentSkillResolveResult>("/agent/skill/resolve", { params: { id } });
};

// 创建 / 更新技能：写回 SKILL.md 并热更新后端注册表，运行中即时生效。
export const saveAgentSkillApi = (payload: AgentSkillSaveRequest) => {
  return http.post<AgentSkillItem>("/agent/skill/save", payload);
};

// 删除用户技能（仅允许删除 .skills 目录内的技能）。
export const deleteAgentSkillApi = (id: string) => {
  return http.post<{ ok: boolean; id: string }>("/agent/skill/delete", { id });
};

// ---- Agent 工具目录（对应后端 tool.Definition） ----

// 工具定义：名称 / 描述 / 入参 JSON Schema。
export interface AgentToolItem {
  name: string;
  description?: string;
  /** 工具入参的 JSON Schema（object），用于渲染参数说明。 */
  input_schema?: Record<string, unknown>;
}

// 查看当前工具注册表中的全部工具（内置 + 编码类 + 外部 MCP）。
export const listAgentToolApi = () => {
  return http.get<AgentToolItem[]>("/agent/tool/list");
};

// 按工具名查看单个工具详情（工具不存在时后端返回 404）。
// options.skipGlobalError：调用方自己处理 404（如弹窗内展示空态）时跳过全局错误提示。
export const getAgentToolApi = (
  id: string,
  options?: { skipGlobalError?: boolean }
) => {
  return http.get<AgentToolItem>("/agent/tool/get", {
    params: { id },
    skipGlobalError: options?.skipGlobalError,
  });
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
  /** 本 Profile 启用的工具名白名单；为空表示注入注册表中的全部工具。 */
  tools?: string[];
  context?: AgentProfileContext;
  /**
   * 思考模式与推理强度：none 关闭思考，low / medium / high / max 开启并指定强度。
   * 为空表示不指定（沿用模型配置 agent.providers.<model>.reasoning_effort）。
   */
  reasoning_effort?: string;
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
  /** 工具名白名单（为空表示注入全部工具）。 */
  tools?: string[];
  context?: AgentProfileContext;
  /** 思考模式与推理强度（none / low / medium / high / max；为空表示不指定）。 */
  reasoning_effort?: string;
  is_default?: boolean;
}

// Profile 编辑弹窗的模型下拉选项（对应后端 /agent/profile/options 的 models 项）。
export interface AgentProfileModelOption {
  /** 模型名（agent.providers 的 key，写入 Profile.model）。 */
  name: string;
  /** 展示名。 */
  label: string;
  /** 模型厂商标识（openai / deepseek / anthropic …）。 */
  provider?: string;
  /** 是否支持推理 / 思考过程。 */
  can_reason?: boolean;
  /** 该模型配置的默认推理强度。 */
  reasoning_effort?: string;
}

// Profile 编辑选项（对应后端 /agent/profile/options）。
export interface AgentProfileOptionsResponse {
  models: AgentProfileModelOption[];
  /** 推理强度可选值（none / low / medium / high / max）。 */
  reasoning_efforts: string[];
}

export const listAgentProfileApi = () => {
  return http.get<AgentProfileItem[]>("/agent/profile/list");
};

// Profile 编辑选项：模型下拉（来自 agent.providers）与推理强度可选值。
export const getAgentProfileOptionsApi = () => {
  return http.get<AgentProfileOptionsResponse>("/agent/profile/options");
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

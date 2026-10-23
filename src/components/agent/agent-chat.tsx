import { FC, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Empty, Flex, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import {
  CheckOutlined,
  ClearOutlined,
  CloseOutlined,
  EditOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  AgentPermissionStatus,
  AgentQuestionStatus,
  AgentTaskStatus,
  answerAgentQuestionApi,
  approveAgentPermissionApi,
  cancelAgentTaskApi,
  chatAgentApi,
  denyAgentPermissionApi,
  describeAgentEnvApi,
  getAgentPendingPermissionsApi,
  getAgentPendingQuestionsApi,
  listAgentProfileApi,
  type AgentProfileItem,
  getAgentTaskApi,
  getConversationApi,
  pageConversationApi,
  type AgentAskUserAnswer,
  type AgentConversationItem,
  type AgentEnvInfo,
  type AgentEventItem,
  type AgentPermissionItem,
  type AgentQuestionItem,
  resumeAgentTaskApi,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";
import { useDispatch, useSelector } from "react-redux";
import {
  getCurrentUserApi,
  updateAgentEnvApi,
  updateUserProfileApi,
  type AgentUserConfig,
} from "@/api/auth";
import { setUserItem } from "@/store/userSlice";
import { useComponentStore } from "@/event-bus/stores/components";
import { useRouterStore } from "@/event-bus/stores/router";
import { invoke } from "@/core/ui-system/invokeV2";
import AgentTaskStream from "./agent-task-stream";
import AgentAskUserCard from "./agent-ask-user";
import AgentSender from "./agent-sender";
import { renderAssistantMessage } from "./agent-message-render";
import UnifiedDiff from "@/components/common/unified-diff";

const { Text } = Typography;

/**
 * 后端 WS 推送的 agent 事件信封（对应 handler.agentWSEvent）。
 */
interface AgentWSMessage {
  type?: string;
  task_id?: string;
  event?: AgentEventItem;
}

// 任务终态事件类型。
const TERMINAL_EVENT_TYPES = new Set(["task.completed", "task.failed", "task.canceled"]);

// 本地聊天消息（user / assistant 气泡）。
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: string;
  taskId?: string;
  data?: unknown;
  error?: boolean;
}

// 后端用字符串 "0" 表示“无当前任务”，需一并视为空。
function isValidTaskId(id?: string): id is string {
  return !!id && id !== "0";
}

// 生成会话在切换下拉中的显示标签：优先取首条用户消息，过长则截断。
function conversationLabel(c: AgentConversationItem): string {
  const first = c.messages?.find((m) => m.role === "user");
  const title = first?.content?.trim();
  if (title) {
    return title.length > 30 ? `${title.slice(0, 30)}…` : title;
  }
  return c.id;
}

// 活跃轮次（running / waiting_permission）的中间态，按 taskID 索引，
// 跨会话切换与浏览器刷新保留，以便恢复实时流。
interface ActiveTurn {
  taskId: string;
  convId: string;
  waiting: boolean; // 是否处于等待权限状态
  sending: boolean; // 是否有一轮进行中
}

interface AgentChatProps {
  /** 初始会话 ID；传入则续接已有历史。 */
  conversationId?: string;
  /** 由 invoke 系统注入：关闭承载该视图的 Modal / Drawer。 */
  onCancel?: () => void;
}

/**
 * Agent 多轮对话 UI。
 *
 * 职责：
 *   - 发送消息：调用 POST /agent/chat，拿到 task_id + conversation_id；
 *   - 通过全局 WS（HybridRealtimeClient）跟踪任务状态变化（waiting/terminal）；
 *   - 进行中的任务用 AgentTaskStream 渲染完整过程（reasoning/tool/message 流式）；
 *   - 任务终态后刷新会话，展示后端投影后的 assistant_final/reasoning/tool_* 历史。
 *
 * 历史恢复：发送后先按 task_id 增量拉取事件（GetTaskEvents），
 * 避免错过 WS 推送早于 HTTP 响应的早期状态事件；实时事件按 id 去重。
 */
const AgentChat: FC<AgentChatProps> = ({ conversationId: initialConversationId, onCancel }) => {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  // 业务上下文：后端从当前用户记录（agent_config.env_id / env_type）读取，
  // 这里只镜像展示；刷新时通过 describeAgentEnvApi() 拉取可读名称。
  // 当前登录用户：Agent Profile 只能来自 userInfo（切换时同步更新 UserState）。
  const userInfo = useSelector((state: any) => state.user.userInfo);
  const llmEnv = useSelector((state: any) => state.user.llmEnv);
  const dispatch = useDispatch();
  // 解析后的人类可读上下文（类型 + 名称 + 工作目录），用于顶部展示当前对话环境。
  const [envInfo, setEnvInfo] = useState<AgentEnvInfo | null>(null);
  // 业务上下文解析中的加载态（供刷新按钮展示）。
  const [envLoading, setEnvLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  // 当前选中会话是否有一轮进行中（running / waiting_permission）。
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // 当前用户的会话列表（用于切换）。
  const [conversations, setConversations] = useState<AgentConversationItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  // 当前会话重新拉取的加载态（供刷新按钮展示）。
  const [reloadingConversation, setReloadingConversation] = useState(false);

  // 当前选中会话活跃任务的待确认权限（可同时存在多个）。
  const [pendingPermissions, setPendingPermissions] = useState<AgentPermissionItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string>();
  // 当前选中会话活跃任务的待作答提问（AskUser，可同时存在多个）。
  const [pendingQuestions, setPendingQuestions] = useState<AgentQuestionItem[]>([]);
  const [answeringId, setAnsweringId] = useState<string>();
  // 当前进行中的任务 ID（用于 Cancel 按钮）。
  const [currentTaskId, setCurrentTaskId] = useState<string>();
  // 可续跑的中断任务 ID：后端重启 / 进程崩溃后任务处于 failed 且存在检查点。
  const [resumableTaskId, setResumableTaskId] = useState<string>();
  const [resumingTask, setResumingTask] = useState(false);

  // 可选的 Agent Profile 列表（顶部选择框数据源）。
  const [profiles, setProfiles] = useState<AgentProfileItem[]>([]);
  // Profile 切换中的加载态（避免重复提交）。
  const [switchingProfile, setSwitchingProfile] = useState(false);
  // 清空当前用户业务上下文（env）的加载态。
  const [clearingEnv, setClearingEnv] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  // 当前选中的会话 ID（ref 镜像，供 WS 回调读取最新值）。
  const selectedConvIdRef = useRef<string | undefined>(initialConversationId);
  // 活跃轮次表：taskID → 该轮次中间态，跨会话切换与浏览器刷新保留。
  const activeTurnsRef = useRef<Map<string, ActiveTurn>>(new Map());
  const seenRef = useRef<Set<string>>(new Set());

  // 自动滚动到底部。
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting, currentTaskId]);

  // 加载可用 Agent Profile 列表（顶部选择框数据源）。
  useEffect(() => {
    listAgentProfileApi()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => setProfiles([]));
  }, []);

  // 向后端解析人类可读的业务上下文（如节点名/报告标题）用于顶部展示。
  // 返回解析结果，供 Profile 编辑弹窗保存后刷新展示（vars / 渲染后的 system_prompt）。
  //
  // 依赖为空：本函数引用保持稳定，既便于注册到 component store 供外部调用，
  // 也避免因 llmEnv 引用变化而重建；业务上下文变化后的重新解析改由下方 effect 触发。
  const loadEnvInfo = useCallback(async (): Promise<AgentEnvInfo | null> => {
    setEnvLoading(true);
    try {
      // 业务上下文后端从当前用户记录读取，无需传参。
      const res = await describeAgentEnvApi();
      setEnvInfo(res.data ?? null);
      return res.data ?? null;
    } catch {
      setEnvInfo(null);
      return null;
    } finally {
      setEnvLoading(false);
    }
  }, []);

  // 当前业务上下文变化时，自动解析一次。
  useEffect(() => {
    void loadEnvInfo();
  }, [llmEnv, loadEnvInfo]);

  // 注册本组件实例到 component store（id = "agent-chat"），对外暴露
  // loadEnvInfo / reload。外部（如 utils/llm-env.ts 的 setLLMEnv）通过
  // ActionDispatcher.dispatch("component.invoke", { category: "store", id: "agent-chat", method: "loadEnvInfo" })
  // 调用，从而在“业务上下文已写入后端”之后主动触发解析。
  const { register: registerComponent, unregister: unregisterComponent } = useComponentStore();
  useEffect(() => {
    registerComponent("store", "agent-chat", { loadEnvInfo });
    return () => {
      unregisterComponent("store", "agent-chat");
    };
  }, [loadEnvInfo, registerComponent, unregisterComponent]);

  // 加载会话列表（挂载时 + 轮次结束时刷新）。
  const loadConversations = async () => {
    setLoadingConversations(true);
    try {
      const res = await pageConversationApi({ page: 1, page_size: 100 });
      setConversations(res.data?.data ?? []);
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setLoadingConversations(false);
    }
  };

  // 把后端消息映射为本地气泡。
  // kind=error 是后端在任务失败时写入历史的错误消息，需要以错误样式渲染。
  const mapMessages = (conv: AgentConversationItem): ChatMessage[] =>
    conv.messages.map((m, i) => ({
      id: `${conv.id}-${m.task_id ?? "0"}-${m.kind ?? "assistant"}-${i}`,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      kind: m.kind,
      taskId: m.task_id,
      data: m.data,
      error: m.kind === "error",
    }));

  // 错误消息（如模型未配置 / 厂商鉴权失败）提供「配置 Agent」入口：
  // 先关闭承载本视图的 Modal / Drawer，再跳到配置页的 AI Agent 段。
  const goAgentConfig = useCallback(() => {
    onCancel?.();
    useRouterStore.getState().go("/config?tab=agent");
  }, [onCancel]);

  const renderAssistantHistory = (m: ChatMessage) => {
    return renderAssistantMessage({
      kind: m.kind,
      content: m.content,
      data: m.data,
      error: m.error,
    });
  };

  // 该任务是否已由历史消息投影出内容（token / reasoning / tool），
  // 是则不再额外渲染 AgentTaskStream，避免同一任务的时间线出现两份。
  const streamedByHistory = (taskId: string) =>
    messages.some(
      (m) => m.taskId === taskId && m.role === "assistant" && !!m.kind && m.kind !== "assistant_final" && m.kind !== "assistant"
    );

  // 拉取任务待确认的权限请求（仅保留 pending 状态）。
  const loadPermissions = async (taskId: string) => {
    if (!taskId) return;
    try {
      const res = await getAgentPendingPermissionsApi(taskId);
      const items = res.data ?? [];
      setPendingPermissions(items.filter((p) => p.status === AgentPermissionStatus.Pending));
    } catch {
      // API errors are shown globally by the http interceptor.
    }
  };

  const handleApprove = async (perm: AgentPermissionItem) => {
    setResolvingId(perm.id);
    try {
      await approveAgentPermissionApi(perm.id);
      getGlobalMessage()?.success("Permission approved");
      await loadPermissions(perm.task_id);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  const handleDeny = async (perm: AgentPermissionItem) => {
    setResolvingId(perm.id);
    try {
      await denyAgentPermissionApi(perm.id);
      getGlobalMessage()?.success("Permission denied");
      await loadPermissions(perm.task_id);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResolvingId(undefined);
    }
  };

  // 拉取任务待作答的提问（仅保留 pending 状态）。
  const loadQuestions = async (taskId: string) => {
    if (!taskId) return;
    try {
      const res = await getAgentPendingQuestionsApi(taskId);
      const items = res.data ?? [];
      setPendingQuestions(items.filter((q) => q.status === AgentQuestionStatus.Pending));
    } catch {
      // API errors are shown globally by the http interceptor.
    }
  };

  // 提交用户对一次提问的作答，唤醒 Agent 继续执行。
  const handleAnswerQuestion = async (question: AgentQuestionItem, answer: AgentAskUserAnswer) => {
    setAnsweringId(question.id);
    try {
      await answerAgentQuestionApi(question.id, answer);
      getGlobalMessage()?.success("Answer submitted");
      await loadQuestions(question.task_id);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setAnsweringId(undefined);
    }
  };

  // 取消当前进行中的任务（终态事件会通过 WS 触发 finalizeTurn 清理状态）。
  const handleCancelTask = async () => {
    if (!currentTaskId) return;
    try {
      await cancelAgentTaskApi(currentTaskId);
      getGlobalMessage()?.success("Task canceled");
    } catch {
      // API errors are shown globally by the http interceptor.
    }
  };

  // 从持久化检查点继续执行一个被中断的任务。
  //
  // 后端会复用同一 taskID 重新启动执行循环；这里把本地活跃轮次重新登记，
  // 让 WS 事件继续路由到本轮，并清掉该任务已投影的历史气泡，避免
  // streamedByHistory 把新的实时流隐藏掉。
  const handleResumeTask = async () => {
    const taskId = resumableTaskId;
    if (!taskId || sending) return;

    setResumingTask(true);
    try {
      await resumeAgentTaskApi(taskId);

      const convId = selectedConvIdRef.current ?? conversationId;
      if (convId) {
        activeTurnsRef.current.set(taskId, {
          taskId,
          convId,
          waiting: false,
          sending: true,
        });
      }
      seenRef.current.clear();
      setMessages((prev) => prev.filter((m) => m.taskId !== taskId));
      setCurrentTaskId(taskId);
      setSending(true);
      setWaiting(false);
      setResumableTaskId(undefined);
      getGlobalMessage()?.success("Task resumed");
      void loadPermissions(taskId);
      void loadQuestions(taskId);
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setResumingTask(false);
    }
  };

  // 操作摘要：优先展示 Provider 提供的人类可读 description，其次回退到
  // Path / Command / Content（Provider 未提供 description 时的原生操作）。
  const renderOperation = (op: AgentPermissionItem["operation"]) => {
    if (!op) return "-";
    return (
      (op.description && op.description.trim()) ||
      op.path ||
      op.command ||
      op.content ||
      "-"
    );
  };

  // 展示 Provider 提供的工具名（metadata.tool），便于用户判断来源。
  const operationTool = (op: AgentPermissionItem["operation"]): string => {
    const value = op?.metadata?.tool;
    return typeof value === "string" ? value : "";
  };

  // 从 Operation.Metadata 提取 diff（opencode edit / write 权限请求透传，供批准前查看）。
  const operationDiff = (op: AgentPermissionItem["operation"]): string => {
    const value = op?.metadata?.diff;
    return typeof value === "string" ? value : "";
  };

  // 切换会话：加载对应消息；若存在活跃轮次则恢复实时流。
  const handleSwitchConversation = async (id: string) => {
    if (!id || id === conversationId) return;
    try {
      const res = await getConversationApi(id);
      const conv = res.data;

      selectedConvIdRef.current = conv.id;
      setConversationId(conv.id);
      setMessages(mapMessages(conv));
      // 切换会话时先重置续跑提示，后续按目标任务状态重新判定。
      setResumableTaskId(undefined);

      const taskId = conv.current_task_id;
      if (!isValidTaskId(taskId)) {
        setCurrentTaskId(undefined);
        setSending(false);
        setWaiting(false);
        setPendingPermissions([]);
        setPendingQuestions([]);
        return;
      }

      // 已有活跃轮次：复用或新建。
      let turn = activeTurnsRef.current.get(taskId);
      if (!turn) {
        turn = { taskId, convId: conv.id, waiting: false, sending: true };
        activeTurnsRef.current.set(taskId, turn);
        try {
          const t = await getAgentTaskApi(taskId);
          const st = t.data.status;
          if (
            st === AgentTaskStatus.Completed ||
            st === AgentTaskStatus.Failed ||
            st === AgentTaskStatus.Canceled
          ) {
            // 任务已终态：清掉活跃轮次，不再恢复；failed 且存在检查点时提供继续入口。
            activeTurnsRef.current.delete(taskId);
            setCurrentTaskId(undefined);
            setSending(false);
            setWaiting(false);
            setPendingPermissions([]);
            setPendingQuestions([]);
            setResumableTaskId(
              st === AgentTaskStatus.Failed && t.data.resumable ? taskId : undefined
            );
            return;
          }
          turn.waiting = st === AgentTaskStatus.WaitingPermission;
        } catch {
          // 查询任务失败时按 running 处理，避免丢失实时流。
        }
      }

      setCurrentTaskId(taskId);
      setSending(turn.sending);
      setWaiting(turn.waiting);
      setResumableTaskId(undefined);

      // 恢复该任务待确认的权限，保证刷新后切换到会话时按钮仍在。
      loadPermissions(taskId);
      // 恢复该任务待作答的提问，保证刷新后提问卡片仍在。
      loadQuestions(taskId);
    } catch {
      // 错误由全局拦截器提示。
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialConversationId) return;
    handleSwitchConversation(initialConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  // 手动刷新对话时同步任务的可续跑状态（failed + resumable）。
  const refreshResumableTask = async (taskId: string) => {
    if (!isValidTaskId(taskId)) {
      setResumableTaskId(undefined);
      return;
    }
    try {
      const res = await getAgentTaskApi(taskId);
      const task = res.data;
      setResumableTaskId(
        task?.status === AgentTaskStatus.Failed && task.resumable ? taskId : undefined
      );
    } catch {
      setResumableTaskId(undefined);
    }
  };

  // 重新拉取当前会话（含完整历史消息）：用于手动同步后端最新状态。
  const handleReloadConversation = async () => {
    const id = conversationId;
    if (!id) return;
    setReloadingConversation(true);
    try {
      const res = await getConversationApi(id);
      const conv = res.data;
      // 仅在仍是同一会话时回填，避免请求期间用户已切换会话造成覆盖。
      if (conv.id !== selectedConvIdRef.current) return;
      setMessages(mapMessages(conv));
      // 同步刷新待确认权限 / 待作答提问，保证按钮与卡片与后端一致。
      if (isValidTaskId(conv.current_task_id)) {
        void loadPermissions(conv.current_task_id);
        void loadQuestions(conv.current_task_id);
        void refreshResumableTask(conv.current_task_id);
      } else {
        setResumableTaskId(undefined);
      }
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setReloadingConversation(false);
    }
  };

  // task.failed 兜底：若历史里没有 kind=error 的消息（旧数据 / 落库异常），
  // 用任务记录上的 error 字段补一条错误气泡，保证错误信息稳定可见。
  const appendTaskError = async (list: ChatMessage[], taskId: string) => {
    if (list.some((m) => m.taskId === taskId && (m.kind === "error" || m.error))) return;
    try {
      const res = await getAgentTaskApi(taskId);
      const text = (res.data?.error ?? "").trim();
      if (!text) return;
      list.push({
        id: `error-${taskId}`,
        role: "assistant",
        kind: "error",
        content: text,
        taskId,
        error: true,
      });
    } catch {
      // 兜底查询失败时忽略：后端写入的 error 消息仍会展示。
    }
  };

  // 轮次结束：把 assistant 回复固化到消息列表（若为选中会话），并清理活跃轮次。
  const finalizeTurn = async (turn: ActiveTurn, type: string) => {
    const selected = turn.convId === selectedConvIdRef.current;
    if (selected) {
      try {
        const res = await getConversationApi(turn.convId);
        const nextMessages = mapMessages(res.data);
        if (type === "task.failed") {
          await appendTaskError(nextMessages, turn.taskId);
          // 后端重启 / 崩溃导致的中断可以续跑：保留一个 Continue 入口。
          await refreshResumableTask(turn.taskId);
        } else {
          setResumableTaskId(undefined);
        }
        setMessages(nextMessages);
      } catch {
        // API errors are shown globally by the http interceptor.
      }
      setCurrentTaskId(undefined);
      setSending(false);
      setWaiting(false);
      setPendingPermissions([]);
      setPendingQuestions([]);
    }
    activeTurnsRef.current.delete(turn.taskId);
    // 本轮结束后刷新会话列表（标题 / 顺序 / 消息数可能变化）。
    loadConversations();
  };

  // 统一处理一个任务事件（实时 WS 推送与历史恢复共用）。
  const applyEvent = (ev: AgentEventItem) => {
    const turn = activeTurnsRef.current.get(ev.task_id);
    if (!turn) return;

    const key = ev.id ?? "";
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    const selected = turn.convId === selectedConvIdRef.current;

    if (ev.type === "stream") return;
    if (ev.type === "task.started") {
      turn.waiting = false;
      if (selected) {
        setWaiting(false);
        setSending(true);
      }
      return;
    }
    if (ev.type === "task.waiting") {
      turn.waiting = true;
      if (selected) setWaiting(true);
      return;
    }
    if (ev.type === "permission.created" || ev.type === "permission.resolved") {
      // 权限创建 / 解决后刷新待确认权限，保证按钮实时出现 / 消失。
      if (selected) loadPermissions(ev.task_id);
      return;
    }
    if (ev.type === "question.created" || ev.type === "question.resolved") {
      // 提问创建 / 解决后刷新待作答提问，保证提问卡片实时出现 / 消失。
      if (selected) loadQuestions(ev.task_id);
      return;
    }
    if (ev.type && TERMINAL_EVENT_TYPES.has(ev.type)) {
      void finalizeTurn(turn, ev.type);
    }
  };

  // 全局订阅 WS：把 agent.event 路由到对应活跃轮次。
  useEffect(() => {
    const unsubscribe = sseClient.onMessage((raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const msg = raw as AgentWSMessage;
      if (msg.type !== "agent.event" || !msg.event) return;
      applyEvent(msg.event);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 直接切换 Profile：调用专用接口只修改 profile_id（不动 Permissions），
  // 成功后从后端拉取最新 userInfo（刷新 agent_profile DTO 与 Profile 展示名）。
  const handleProfileSelect = async (profileId?: string) => {
    if (!userInfo) return;
    setSwitchingProfile(true);
    try {
      const res = await updateUserProfileApi(profileId ?? "");
      const fresh = res.data?.user;
      if (fresh) dispatch(setUserItem({ userInfo: fresh }));
      getGlobalMessage()?.success("Profile updated");
      // Profile 变化会影响当前上下文渲染的系统提示词，重新解析一次。
      void loadEnvInfo();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setSwitchingProfile(false);
    }
  };

  // 切换 Profile / Agent 配置：通过 invokeV2 弹窗展示并编辑当前用户的
  // agent_config（Profile + Permissions），保存后同步更新 Redux 中的 userInfo。
  const handleProfileChange = () => {
    invoke.agentConfigModal
      .openAsync({
        config: userInfo?.agent_config ?? null,
      }, { footer: null })
      .then((next?: AgentUserConfig) => {
        if (!next || !userInfo) return;
        // 乐观更新 agent_config；随后从后端拉取最新的 agent_profile（DTO）。
        dispatch(setUserItem({ userInfo: { ...userInfo, agent_config: next } }));
        getCurrentUserApi()
          .then((res) => {
            const fresh = res.data?.data?.user;
            if (fresh) dispatch(setUserItem({ userInfo: fresh }));
          })
          .catch(() => {
            // 忽略：agent_config 已乐观更新。
          });
      })
      .catch(() => {
        // 用户取消，无需处理。
      });
  };

  // 查看当前上下文渲染后的 system_prompt：通过 invoke 弹窗以 Markdown 展示。
  const handleViewSystemPrompt = () => {
    invoke.agentSystemPromptModal.open(
      { envInfo },
      { title: "System prompt", width: 800, footer: null }
    );
  };

  // 编辑当前上下文解析出的 Profile：通过 invoke 打开独立的 Profile 编辑弹窗，
  // 只传 profile_id（弹窗内部按 ID 查询回填）。保存成功后刷新上下文，
  // 因为 Profile 变化会影响系统提示词渲染。
  const handleEditProfile = () => {
    const profileId = envInfo?.profile_id;
    if (!profileId) return;
    invoke.agentProfileEditModal
      .openAsync(
        { profileId, envInfo, loadEnvInfo },
        { title: "Edit Profile", footer: null, width: 800 }
      )
      .then(() => {
        void loadEnvInfo();
      })
      .catch(() => {
        // 用户取消，无需处理。
      });
  };

  // 清空当前用户绑定的业务上下文（env_id / env_type）：调用 /auth/agent-env 写入空值，
  // 后端 RuntimeContextResolver.Resolve 会因 type 为空回退到 resolveDefaultWorkingDirectory
  // （当前激活项目的默认工作目录），即“走默认”。
  const handleClearEnv = async () => {
    setClearingEnv(true);
    try {
      const res = await updateAgentEnvApi({ env_id: "", env_type: "" });
      const fresh = res.data?.user;
      if (fresh) dispatch(setUserItem({ userInfo: fresh }));
      // 同步清空本地镜像的 llmEnv，避免业务页面残留旧上下文。
      dispatch(setUserItem({ llmEnv: undefined }));
      getGlobalMessage()?.success("Context cleared");
      // 重新解析上下文，顶部标签应回退为默认工作目录。
      void loadEnvInfo();
    } catch {
      // API errors are shown globally by the http interceptor.
    } finally {
      setClearingEnv(false);
    }
  };

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", kind: "user", content: text },
    ]);
    setSending(true);
    setWaiting(false);
    setResumableTaskId(undefined);

    try {
      const res = await chatAgentApi({
        conversation_id: conversationId,
        message: text,
      });
      const { task_id, conversation_id } = res.data;

      selectedConvIdRef.current = conversation_id;
      setConversationId(conversation_id);

      // 登记本轮活跃状态，供切换 / 刷新后恢复。
      const turn: ActiveTurn = {
        taskId: task_id,
        convId: conversation_id,
        waiting: false,
        sending: true,
      };
      activeTurnsRef.current.set(task_id, turn);
      seenRef.current.clear();
      setCurrentTaskId(task_id);

      // 本轮任务可能很快进入等待权限，提前拉取待确认权限。
      loadPermissions(task_id);
      // 本轮任务也可能很快发起提问，提前拉取待作答提问。
      loadQuestions(task_id);
    } catch {
      // API 错误由全局拦截器提示。
      setSending(false);
      setWaiting(false);
    }
  };

  const handleClear = () => {
    selectedConvIdRef.current = undefined;
    seenRef.current.clear();
    setConversationId(undefined);
    setCurrentTaskId(undefined);
    setMessages([]);
    setSending(false);
    setWaiting(false);
    setPendingPermissions([]);
    setPendingQuestions([]);
    setResumableTaskId(undefined);
    setInput("");
  };

  // 当前用户选中的 Profile 展示名（由 /auth/me 解析的 agent_profile DTO 提供）。
  const currentProfileId = userInfo?.agent_config?.profile_id;

  return (
    <Flex vertical style={{ height: "100%", minHeight: 480 }}>
      {/* 头部：拆成两行，避免单行信息过载。
          第一行 = 身份 / 上下文（业务上下文 + 运行状态 + 当前 Profile）；
          第二行 = 会话导航（切换下拉 + 刷新）与全局操作（Close / New Chat）。 */}
      <Flex
        vertical
        gap={10}
        style={{
          flexShrink: 0,
          paddingBottom: 10,
          marginBottom: 12,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {/* 第一行：左侧业务上下文与运行状态，右侧当前 Profile */}
        <Flex align="center" justify="space-between" gap={12}>
          <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
            {envInfo?.label ? (
              <Space.Compact style={{ minWidth: 0 }}>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  title={`View system prompt (${envInfo.type})`}
                  onClick={handleViewSystemPrompt}
                  style={{ maxWidth: 280, minWidth: 0 }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      verticalAlign: "bottom",
                    }}
                  >
                    {envInfo.label}
                  </span>
                </Button>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={envLoading}
                  title="Refresh context"
                  onClick={() => void loadEnvInfo()}
                />
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  disabled={!envInfo.profile_id}
                  title={envInfo.profile_id ? "Edit profile" : "No profile bound"}
                  onClick={handleEditProfile}
                />
                {envInfo?.type && (
                  <Popconfirm
                    title="Clear context?"
                    description="Unbind the current env so the default working directory is used."
                    okText="Clear"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                    onConfirm={handleClearEnv}
                  >
                    <Button
                      size="small"
                      // danger
                      icon={<ClearOutlined />}
                      loading={clearingEnv}
                      title="Clear context (use default working directory)"
                    />
                  </Popconfirm>
                )}
              </Space.Compact>
            ) : (
              <Space size={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  No context bound
                </Text>
                {/* 仅在没有绑定业务上下文（envInfo.type 不存在）时，才提供“清空上下文”入口。 */}

              </Space>
            )}
            {sending && (
              <Flex align="center" gap={6} style={{ minWidth: 0, overflow: "hidden" }}>
                <Spin size="small" indicator={<LoadingOutlined spin />} />
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {waiting ? "Waiting for permission…" : "Agent is running…"}
                </Text>
              </Flex>
            )}
          </Flex>
          <Flex align="center" gap={8} style={{ flexShrink: 0 }}>
            <Select
              size="small"
              value={currentProfileId}
              placeholder="Select profile"
              loading={switchingProfile}
              showSearch
              optionFilterProp="label"
              disabled={!userInfo}
              onChange={(id) => void handleProfileSelect(id)}
              style={{ width: 200 }}
              options={profiles.map((p) => ({
                value: p.id,
                label: `${p.name}${p.is_default ? " (default)" : ""}`,
              }))}
            />
            <Button
              size="small"
              icon={<SettingOutlined />}
              title="Edit permissions"
              onClick={handleProfileChange}
            >
              Permissions
            </Button>
          </Flex>
        </Flex>

        {/* 第二行：会话切换下拉 + 刷新 + 全局操作 */}
        <Flex align="center" gap="small">
          <Select
            value={conversationId}
            placeholder="Select a conversation"
            onChange={(id) => {
              if (!id) {
                handleClear();
                return;
              }
              handleSwitchConversation(id);
            }}
            loading={loadingConversations}
            allowClear
            size="small"
            showSearch
            optionFilterProp="label"
            style={{ flex: 1 }}
            options={conversations.map((c) => ({
              value: c.id,
              label: (
                <Flex align="center" gap={6} style={{ width: "100%" }}>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conversationLabel(c)}
                  </span>
                  {isValidTaskId(c.current_task_id) && <Badge status="processing" />}
                </Flex>
              ),
            }))}
          />
          <Button
            size="small"
            icon={<ReloadOutlined spin={reloadingConversation} />}
            title="Reload current conversation"
            onClick={handleReloadConversation}
            disabled={!conversationId}
          />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            title="Refresh conversations"
            onClick={loadConversations}
            loading={loadingConversations}
          />
          {onCancel && (
            <Button size="small" onClick={onCancel}>
              Close
            </Button>
          )}
          <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>
            New Chat
          </Button>
        </Flex>
      </Flex>

      {/* 消息区域：历史消息气泡始终展示；存在进行中的任务（currentTaskId）时，
          最后一条 assistant 回复位置替换为该任务的实时事件流（AgentTaskStream），
          否则展示流式输出气泡。 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa",
        }}
      >
        {messages.length === 0 && !currentTaskId ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Start a conversation with the agent"
            style={{ marginTop: 48 }}
          />
        ) : (
          <Flex vertical gap="small">
            {messages.map((m) => (
              <Flex
                key={m.id}
                justify={m.role === "user" ? "flex-end" : "flex-start"}
                align="flex-start"
                gap={8}
              >
                {m.role === "assistant" && (
                  <RobotOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                )}
                <div
                  style={
                    m.role === "user"
                      ? {
                        maxWidth: "78%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#1677ff",
                        color: "#fff",
                        border: "none",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }
                      // 助手气泡按百分比取宽，需要一个确定的可用宽度作参照，否则折叠
                      // 时的 nowrap 预览会把容器撑宽。
                      : { flex: 1, minWidth: 0 }
                  }
                >
                  {m.role === "assistant" ? (
                    // 错误消息附上「配置 Agent」跳转，便于用户直接去修正模型配置后重试。
                    m.error ? (
                      <Flex vertical gap={6} align="flex-start">
                        {renderAssistantHistory(m)}
                        <Button
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={goAgentConfig}
                        >
                          配置 Agent
                        </Button>
                      </Flex>
                    ) : (
                      renderAssistantHistory(m)
                    )
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && <UserOutlined style={{ color: "#1677ff", marginTop: 4 }} />}
              </Flex>
            ))}

            {/* 进行中的任务兜底展示完整实时事件流（reasoning/tool/message）。
                历史已投影出内容时不重复渲染，避免同一任务出现两份时间线。
                嵌入模式下由 AgentTaskStream 委托父容器滚动，避免嵌套滚动条。 */}
            {currentTaskId && !streamedByHistory(currentTaskId) && (
              <AgentTaskStream taskId={currentTaskId} scrollContainerRef={listRef} />
            )}
            {/* {
              sending && (
                <Flex align="flex-start" gap={8}>
                  <RobotOutlined style={{ color: "#1677ff", marginTop: 4 }} />
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#ffffff",
                      border: "1px solid #f0f0f0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {waiting ? (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Waiting for permission…
                      </Text>
                    ) : (
                      <Spin size="small" indicator={<LoadingOutlined spin />} />
                    )}
                  </div>
                </Flex>
              )
            } */}
          </Flex>
        )}
      </div>


      {/* 中断可续跑提示：后端重启 / 进程崩溃后，任务处于 failed 但保留了检查点。 */}
      {resumableTaskId && !sending && (
        <Flex
          align="center"
          justify="space-between"
          gap={12}
          style={{
            marginTop: 12,
            padding: "8px 12px",
            border: "1px solid #91caff",
            borderRadius: 8,
            background: "#e6f4ff",
          }}
        >
          <Flex vertical gap={2} style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 13 }}>
              Task interrupted
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              The agent can continue from its last execution checkpoint.
            </Text>
          </Flex>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={resumingTask}
            onClick={() => void handleResumeTask()}
          >
            Continue
          </Button>
        </Flex>
      )}

      {/* 待作答提问（AskUser）：固定在输入区上方，提交后 Agent 继续执行。
          提问由后端持久化，刷新 / 切回会话后仍会恢复展示。 */}
      {pendingQuestions.length > 0 && (
        <Flex
          vertical
          gap={8}
          style={{
            marginTop: 12,
            padding: "8px 12px",
            border: "1px solid #91caff",
            borderRadius: 8,
            background: "#e6f4ff",
          }}
        >
          <Flex align="center" gap={6}>
            <QuestionCircleOutlined style={{ color: "#1677ff", fontSize: 13 }} />
            <Text style={{ fontSize: 12, color: "#1677ff" }}>
              需要你的确认 ({pendingQuestions.length})
            </Text>
          </Flex>
          {pendingQuestions.map((q) => (
            <AgentAskUserCard
              key={q.id}
              question={q}
              submitting={answeringId === q.id}
              onSubmit={(answer) => handleAnswerQuestion(q, answer)}
            />
          ))}
        </Flex>
      )}

      {/* 待确认权限：固定在输入区上方，便于快速 Approve / Deny。
          存在进行中的任务时，权限由 AgentTaskStream 统一展示，避免重复。 */}
      {pendingPermissions.length > 0 && (
        <Flex
          vertical
          gap={8}
          style={{
            marginTop: 12,
            padding: "8px 12px",
            border: "1px solid #ffd666",
            borderRadius: 8,
            background: "#fffbe6",
          }}
        >

          <Flex align="center" gap={6}>
            <WarningOutlined style={{ color: "#faad14", fontSize: 13 }} />
            <Text type="warning" style={{ fontSize: 12 }}>
              Pending permissions ({pendingPermissions.length})
            </Text>
          </Flex>
          {pendingPermissions.map((perm) => {
            const pendingLoading = resolvingId === perm.id;
            const diff = operationDiff(perm.operation);
            const tool = operationTool(perm.operation);
            const description = perm.operation?.description?.trim();
            const target = renderOperation(perm.operation);
            return (
              <Flex
                key={perm.id}
                vertical
                gap={6}
                style={{
                  background: "#ffffff",
                  border: "1px solid #ffe58f",
                  borderRadius: 6,
                  padding: "6px 10px",
                }}
              >
                <Flex align="center" justify="space-between" gap={8}>
                  <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Flex align="center" gap={6} wrap>
                      <Text strong style={{ fontSize: 13 }}>
                        {perm.operation?.type || "Permission"}
                      </Text>
                      {tool && (
                        <Tag
                          color="default"
                          style={{ margin: 0, fontSize: 11, lineHeight: "16px" }}
                        >
                          {tool}
                        </Tag>
                      )}
                    </Flex>
                    {/* 优先展示 Provider 的人类可读描述；描述与目标一致时只显示一条。 */}
                    {description && (
                      <Text style={{ fontSize: 12, wordBreak: "break-word" }}>
                        {description}
                      </Text>
                    )}
                    {(!description || target !== description) && (
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, wordBreak: "break-all" }}
                      >
                        {target}
                      </Text>
                    )}
                  </Flex>
                  <Space size={4}>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleApprove(perm)}
                      icon={<CheckOutlined />}
                      loading={pendingLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      danger
                      size="small"
                      onClick={() => handleDeny(perm)}
                      icon={<CloseOutlined />}
                      loading={pendingLoading}
                    >
                      Deny
                    </Button>
                  </Space>
                </Flex>
                {/* 有 diff 时在批准前展示改动，便于用户据 diff 决策。 */}
                {diff && <UnifiedDiff diff={diff} maxHeight={240} />}
              </Flex>
            );
          })}
        </Flex>
      )}

      {/* 输入区：独立的 AgentSender 组件，目前只提供「文件引用」功能按钮。
          发送 / 停止由 Sender 内置按钮负责，发送中锁定输入。 */}
      <AgentSender
        value={input}
        onChange={setInput}
        onSubmit={(text) => void handleSend(text)}
        loading={sending}
        onCancel={handleCancelTask}
        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
      />
    </Flex>
  );
};

export default AgentChat;

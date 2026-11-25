import { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Divider, Empty, Flex, Popconfirm, Select, Space, Spin, Tag, Typography } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  ForkOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RedoOutlined,
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
  getConversationApi,
  forkConversationApi,
  deleteAgentTurnApi,
  retryAgentTurnApi,
  type AgentAskUserAnswer,
  type AgentActiveTaskStatus,
  type AgentConversationItem,
  type AgentEnvInfo,
  type AgentEventItem,
  type AgentPermissionItem,
  type AgentQuestionItem,
  resumeAgentTaskApi,
  subscribeAgentSessionApi,
  unsubscribeAgentSessionApi,
} from "@/api/agent";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { sseClient } from "@/sse";
import { useDispatch, useSelector } from "react-redux";
import {
  getCurrentUserApi,
  updateUserProfileApi,
  type AgentUserConfig,
} from "@/api/auth";
import { setUserItem } from "@/store/userSlice";
import { useComponentStore } from "@/event-bus/stores/components";
import { useRouterStore } from "@/event-bus/stores/router";
import { invoke } from "@/core/ui-system/invokeV2";
import { useLiveStream } from "./agent-live-stream";
import AgentAskUserCard from "./agent-ask-user";
import AgentSender from "./agent-sender";
import { asRecord, renderAssistantMessage } from "./agent-message-render";
import { loadAgentConversations, ensureAgentConversations, upsertConversation } from "./agent-conversation-store";
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

// 会话消息分页大小：首屏 / 每次向上滚动加载的条数（与后端默认值对齐）。
const MESSAGE_PAGE_SIZE = 30;

// 本地聊天消息（user / assistant 气泡）。
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: string;
  taskId?: string;
  /** 会话内序号（后端分页游标）：fork from here 用它定位截止消息。 */
  seq?: number;
  data?: unknown;
  error?: boolean;
  /** 是否仍在追加（仅内存实时块使用；历史消息恒为 false）。 */
  streaming?: boolean;
  /** 用户消息发起人显示名（后端回填），展示在用户头像下方。 */
  username?: string;
  /** Agent 侧消息执行 Profile 展示名（后端回填），展示在助手头像下方。 */
  profileName?: string;
}

// 工具调用 / 结果的消息类型（历史与实时两侧同名）。
const isCallKind = (kind?: string) => kind === "tool_call" || kind === "skill_call";
const isToolResultKind = (kind?: string) => kind === "tool_result" || kind === "skill_result";

// 后端用字符串 "0" 表示“无当前任务”，需一并视为空。
function isValidTaskId(id?: string): id is string {
  return !!id && id !== "0";
}

// 由会话快照推导本轮 UI 状态。
//
// 三态返回值：
//   - null      → 没有活跃轮次（current_task_id 为空）；
//   - undefined → 有活跃任务但快照缺失（任务行被外删 / 查询失败），调用方保持现状；
//   - 对象      → 已知状态：running / waiting / resumable 三者互斥。
//
// canceled 与 failed 一样可能保留检查点（后端 keepCurrentTask = Resumable），因此
// 可续跑判定只看 resumable 而不只看 failed。
function deriveTurnState(
  taskId?: string,
  active?: AgentActiveTaskStatus,
): { running: boolean; waiting: boolean; resumable: boolean } | null | undefined {
  if (!isValidTaskId(taskId)) return null;
  if (!active) return undefined;
  const resumable = !!active.resumable && active.status !== AgentTaskStatus.Completed;
  const terminal =
    active.status === AgentTaskStatus.Failed || active.status === AgentTaskStatus.Canceled;
  return {
    running: active.status === AgentTaskStatus.Running || active.status === AgentTaskStatus.Created,
    waiting: active.status === AgentTaskStatus.WaitingPermission,
    resumable: resumable && terminal,
  };
}

// 把后端消息映射为本地气泡。
//
// 分页拼接（向上加载更早消息）时索引会变化，因此 key 优先用消息雪花 ID；
// 缺失时回退到 seq / 下标，保证同一消息在多次拼接后仍是同一个 key。
// kind=error 是后端在任务失败时写入历史的错误消息，需要以错误样式渲染。
const mapMessages = (conv: AgentConversationItem): ChatMessage[] =>
  (conv.messages ?? []).map((m, i) => ({
    id: m.id ?? `${conv.id}-${m.task_id ?? "0"}-${m.kind ?? "assistant"}-${m.seq ?? i}`,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    kind: m.kind,
    taskId: m.task_id,
    seq: m.seq,
    data: m.data,
    error: m.kind === "error",
    username: m.username,
    profileName: m.profile_name,
  }));

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
  /**
   * 会话变化（新建 / 切换 / 分叉）时通知宿主。
   * 会话页用它把地址同步成 `/session/:sessionId`，保证刷新与左侧列表高亮一致。
   */
  onConversationChange?: (conversationId?: string) => void;
}

/**
 * 单条消息行（历史与实时共用）。
 *
 * 为什么要抽成组件并与实时块共用：
 *   - 实时流与历史必须**长得完全一样**（同样的左对齐、气泡、Tool Call 合并规则），
 *     否则用户会看到「刷新前一个样、刷新后另一个样」；
 *   - 用 memo 包住后，token 级追加只会重渲染「末尾那条正在流式的消息」，
 *     其余历史行引用不变直接跳过，长任务下不会掉帧。
 */
const MessageRow = memo(function MessageRow({
  message: m,
  result,
  conversationId,
  isTurnEnd,
  forking,
  forkDisabled,
  turnBusy,
  onFork,
  onDeleteTurn,
  onRetryTurn,
  onGoConfig,
}: {
  message: ChatMessage;
  result?: ChatMessage;
  conversationId?: string;
  isTurnEnd: boolean;
  forking: boolean;
  /** 该轮正在删除 / 重试：只锁住被点击的那条按钮。 */
  turnBusy: boolean;
  forkDisabled: boolean;
  onFork: (message: ChatMessage) => void;
  onDeleteTurn: (message: ChatMessage) => void;
  onRetryTurn: (message: ChatMessage) => void;
  onGoConfig: () => void;
}) {
  // 结果形状与历史和实时两侧一致（content / is_error / metadata）。
  const renderResult = result
    ? (() => {
        const data = asRecord(result.data);
        return {
          content: typeof data?.content === "string" ? data.content : result.content,
          is_error: !!data?.is_error || !!result.error,
          metadata: data?.metadata,
        };
      })()
    : undefined;

  return (
    <Flex
      className="agent-chat-msg"
      justify={m.role === "user" ? "flex-end" : "flex-start"}
      align="flex-start"
      gap={8}
    >
      {m.role === "assistant" && (
        <Flex vertical align="center" style={{ flexShrink: 0, width: 64, marginTop: 4 }}>
          <RobotOutlined style={{ color: "#1677ff" }} />
          {/* Profile 名称：后端按消息的 Profile ID 回填，展示在助手头像下方。 */}
          {m.profileName && (
            <Text
              type="secondary"
              style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, textAlign: "center" }}
            >
              {m.profileName}
            </Text>
          )}
        </Flex>
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
            : // 助手气泡按百分比取宽，需要一个确定的可用宽度作参照，
              // 否则折叠时的 nowrap 预览会把容器撑宽。
              { flex: 1, minWidth: 0 }
        }
      >
        <div>
          {m.role === "assistant" ? (
            m.error ? (
              // 错误消息附上「配置 Agent」跳转，便于用户直接去修正模型配置后重试。
              <Flex vertical gap={6} align="flex-start">
                {renderAssistantMessage(
                  { kind: m.kind, content: m.content, data: m.data, error: m.error },
                  { conversationId, result: renderResult },
                )}
                <Button size="small" icon={<SettingOutlined />} onClick={onGoConfig}>
                  配置 Agent
                </Button>
              </Flex>
            ) : (
              renderAssistantMessage(
                {
                  kind: m.kind,
                  content: m.content,
                  data: m.data,
                  error: m.error,
                  streaming: m.streaming,
                },
                { conversationId, result: renderResult },
              )
            )
          ) : (
            m.content
          )}
        </div>
        {/* 分叉入口挂在消息内容下方：只在「每轮结束」的消息上出现，
            行高常驻以保证布局稳定，鼠标悬停该条消息时才可见
            （见文件末尾注入的 hover 样式）。 */}
        {isTurnEnd && (
          <Flex
            className="agent-chat-msg-actions"
            justify={m.role === "user" ? "flex-end" : "flex-start"}
            style={{ height: 22, marginTop: 2 }}
          >
            <Button
              type="text"
              size="small"
              icon={<ForkOutlined />}
              title="Fork from here (after this turn)"
              loading={forking}
              disabled={forkDisabled}
              style={{
                height: 22,
                padding: "0 4px",
                fontSize: 12,
                color: m.role === "user" ? "rgba(255,255,255,0.85)" : "#8c8c8c",
              }}
              onClick={() => onFork(m)}
            >
              Fork
            </Button>
            {/* 按任务删除 / 重试这一轮：删除会连同该轮的 user 消息一起移除，重试则用原输入重新生成。 */}
            <Popconfirm
              title="Delete this turn?"
              description="Removes this turn's user message and the agent output."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDeleteTurn(m)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                title="Delete this turn (with the user message)"
                loading={turnBusy}
                disabled={forkDisabled}
                style={{ height: 22, padding: "0 4px", fontSize: 12 }}
              >
                Delete
              </Button>
            </Popconfirm>
            <Button
              type="text"
              size="small"
              icon={<RedoOutlined />}
              title="Retry this turn (regenerate with the same user message)"
              loading={turnBusy}
              disabled={forkDisabled}
              style={{
                height: 22,
                padding: "0 4px",
                fontSize: 12,
                color: m.role === "user" ? "rgba(255,255,255,0.85)" : "#8c8c8c",
              }}
              onClick={() => onRetryTurn(m)}
            >
              Retry
            </Button>
          </Flex>
        )}
      </div>
      {m.role === "user" && (
        <Flex vertical align="center" style={{ flexShrink: 0, width: 64, marginTop: 4 }}>
          <UserOutlined style={{ color: "#1677ff" }} />
          {/* 发起人用户名：后端按 user_id 回填，展示在用户头像下方。 */}
          {m.username && (
            <Text style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, textAlign: "center", color: "#595959" }}>
              {m.username}
            </Text>
          )}
        </Flex>
      )}
    </Flex>
  );
});

/**
 * Agent 多轮对话 UI。
 *
 * 职责：
 *   - 发送消息：调用 POST /agent/chat，拿到 task_id + conversation_id；
 *   - 通过全局 WS（HybridRealtimeClient）接收 `agent.event`（增量 + 状态 + 权限 / 提问）；
 *   - 进行中的轮次把「内存增量」直接追加到同一份消息列表渲染；
 *   - 任务终态后刷新会话，展示后端投影后的 assistant / reasoning / tool_* 历史。
 *
 * 数据分层（保持简单）：
 *   1) 数据库历史：getConversationApi，分页加载，渲染为 messages；
 *   2) 实时增量：WS `stream` 事件折叠成块，存在本组件的 useState 里，只对本轮有效。
 *
 * 实时块不跨页面保留：离开会话页时服务端会退订，本来就收不到期间的增量；
 * 未落库的部分由后端补齐后经历史接口恢复，前端不做模块级缓存与跨来源去重。
 * 历史重新加载（切会话 / 手动刷新 / 轮次结束）后即清空实时块，避免与历史重复。
 *
 * 渲染统一（与历史完全一致）：
 *   实时块会被转换成与历史消息相同的形状，走同一个 `MessageRow`，
 *   因此对齐方式、气泡样式、Tool Call / Tool Result 合并规则完全一致；
 *   只有「正在流式追加的那一条」会被单独重渲染（memo + StreamedText）。
 */
const AgentChat: FC<AgentChatProps> = ({
  conversationId: initialConversationId,
  onCancel,
  onConversationChange,
}) => {
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  // 当前登录用户：Agent Profile 只能来自 userInfo（切换时同步更新 UserState）。
  const userInfo = useSelector((state: any) => state.user.userInfo);
  const dispatch = useDispatch();
  // 解析后的人类可读上下文（类型 + 名称 + 工作目录），用于顶部展示当前对话环境。
  const [envInfo, setEnvInfo] = useState<AgentEnvInfo | null>(null);
  // 业务上下文解析中的加载态（供刷新按钮展示）。
  const [envLoading, setEnvLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // 当前会话是否还有更早的历史消息（向上滚动时继续加载）。
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  // 向上加载更早消息的进行中状态（顶部展示 loading）。
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [input, setInput] = useState("");
  // 当前选中会话是否有一轮进行中（running / waiting_permission）。
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  // 当前会话重新拉取的加载态（供刷新按钮展示）。
  const [reloadingConversation, setReloadingConversation] = useState(false);
  // 正在从哪条消息 fork（seq），用于只锁住被点击的那条按钮。
  const [forkingFromSeq, setForkingFromSeq] = useState<number>();
  // 正在删除 / 重试哪一轮（task ID），同样只锁住被点击的那条按钮。
  const [busyTaskId, setBusyTaskId] = useState<string>();

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

  const listRef = useRef<HTMLDivElement>(null);
  // 向上翻页游标：已加载的最早一条消息的 seq（后端 next_cursor）。
  const oldestSeqRef = useRef(0);
  // 向上加载的去重锁（state 只用于展示，避免并发重复请求）。
  const loadingMoreRef = useRef(false);
  // prepend 历史消息后恢复滚动位置，避免视口跳动。
  const scrollRestoreRef = useRef<{ height: number; top: number } | null>(null);
  // 上一次的 scrollTop：用于区分「用户向上滚动」与「程序化贴底」。
  const lastScrollTopRef = useRef(0);
  // 当前选中的会话 ID（ref 镜像，供 WS 回调读取最新值）。
  const selectedConvIdRef = useRef<string | undefined>(initialConversationId);
  // 已经真正加载过（消息已回填）的会话 ID。
  // 直接以 /session/:sessionId 挂载时，state 初值等于 prop，仅靠「id === conversationId」
  // 会把首次加载误判成重复切换而跳过，因此需要单独记录「是否加载过」。
  const loadedConvIdRef = useRef<string | undefined>(undefined);
  // 活跃轮次表：taskID → 该轮次中间态，仅用于本次页面会话的运行状态跟踪。
  const activeTurnsRef = useRef<Map<string, ActiveTurn>>(new Map());
  // 是否正处于「新建会话发送中」：此时还没有会话 ID，但要先接收该轮的首批事件。
  const pendingChatRef = useRef(false);

  // 本轮实时块：只存在当前组件里，页面卸载即丢弃（已落库的由历史恢复，
  // 未落库的由订阅时下发的快照补齐）。
  const {
    blocks: liveBlocks,
    enqueue: enqueueLiveEvent,
    applySnapshot: applyLiveSnapshot,
    start: startLiveStream,
    reset: resetLiveStream,
    finishTask: finishLiveTask,
  } = useLiveStream();

  // 实时订阅：会话页进入 / 切换时登记，离开时撤销。
  const subscribedConvIdRef = useRef<string | undefined>(undefined);

  // 登记会话订阅并把「未落库的尾巴」补进实时块。
  //
  // force=true 用于手动刷新：重复订阅是幂等的，响应里带的是最新快照。
  const subscribeSession = useCallback(
    async (id: string, force = false) => {
      if (subscribedConvIdRef.current === id && !force) return;
      const prev = subscribedConvIdRef.current;
      subscribedConvIdRef.current = id;
      if (prev && prev !== id) {
        void unsubscribeAgentSessionApi(prev).catch(() => {});
      }
      try {
        const res = await subscribeAgentSessionApi(id);
        // 请求期间又切换了会话：丢弃这次结果。
        if (subscribedConvIdRef.current !== id) return;
        applyLiveSnapshot(res.data?.live);
      } catch {
        // 订阅失败不阻塞页面：历史仍可正常展示，放行实时流队列即可。
        if (subscribedConvIdRef.current === id) startLiveStream();
      }
    },
    [applyLiveSnapshot, startLiveStream],
  );

  // 卸载时退订（服务端还有连接断开兜底，失败无需提示）。
  useEffect(
    () => () => {
      const id = subscribedConvIdRef.current;
      subscribedConvIdRef.current = undefined;
      if (id) void unsubscribeAgentSessionApi(id).catch(() => {});
    },
    [],
  );

  // 消息变化时的滚动策略：
  //   - 向上加载更早消息（prepend）后恢复原视口位置，避免页面跳动；
  //   - 其余情况（新消息）保持贴底；
  //   - 内容不足一屏且还有更早消息时继续加载，保证滚动条出现后仍可向上翻。
  //
  // 注意不依赖内存流：token 级追加非常频繁，强制贴底会打断用户回看之前的输出。
  // 实时区自身不做滚动，用户停留位置由这里的历史变化决定。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const restore = scrollRestoreRef.current;
    if (restore) {
      scrollRestoreRef.current = null;
      el.scrollTop = el.scrollHeight - restore.height + restore.top;
      // 同步基准值：恢复位置本身不应被当成一次「向上滚动」。
      lastScrollTopRef.current = el.scrollTop;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    if (hasMoreMessages && el.scrollHeight <= el.clientHeight + 8) {
      void loadOlderMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, waiting, currentTaskId, hasMoreMessages]);

  // 加载可用 Agent Profile 列表（顶部选择框数据源）。
  useEffect(() => {
    listAgentProfileApi()
      .then((res) => setProfiles(res.data ?? []))
      .catch(() => setProfiles([]));
  }, []);

  // 向后端解析当前工作目录与渲染后的系统提示词，用于顶部展示。
  // 返回解析结果，供 Profile 编辑弹窗保存后刷新展示（vars / 渲染后的 system_prompt）。
  const loadEnvInfo = useCallback(async (): Promise<AgentEnvInfo | null> => {
    setEnvLoading(true);
    try {
      // 工作目录与系统提示词由后端解析，无需传参。
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

  // 挂载时自动解析一次。
  useEffect(() => {
    void loadEnvInfo();
  }, [loadEnvInfo]);

  // 注册本组件实例到 component store（id = "agent-chat"），对外暴露
  // loadEnvInfo / reload，供 Profile 等 UI 在保存后主动触发解析。
  const { register: registerComponent, unregister: unregisterComponent } = useComponentStore();
  useEffect(() => {
    registerComponent("store", "agent-chat", { loadEnvInfo });
    return () => {
      unregisterComponent("store", "agent-chat");
    };
  }, [loadEnvInfo, registerComponent, unregisterComponent]);

  // 加载会话首屏 / 最新一页：切换会话、手动刷新、轮次结束时使用（重置分页状态）。
  const applySessionPage = useCallback((conv: AgentConversationItem) => {
    loadedConvIdRef.current = conv.id;
    setMessages(mapMessages(conv));
    setHasMoreMessages(!!conv.has_more);
    oldestSeqRef.current = conv.next_cursor ?? 0;
    scrollRestoreRef.current = null;
    lastScrollTopRef.current = 0;
  }, []);

  // 向上加载更早的一页历史消息（滚动到顶部时触发）。
  //
  // 请求前记录 scrollHeight / scrollTop，合并后由消息变更 effect 恢复视口，
  // 使用户停留在原本阅读的位置；按消息 ID 去重，避免与实时追加的消息重复。
  const loadOlderMessages = async () => {
    const el = listRef.current;
    const convId = selectedConvIdRef.current;
    const cursor = oldestSeqRef.current;
    if (!el || !convId || !cursor || !hasMoreMessages || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMoreMessages(true);
    const restore = { height: el.scrollHeight, top: el.scrollTop };
    try {
      const res = await getConversationApi(convId, {
        before_seq: cursor,
        limit: MESSAGE_PAGE_SIZE,
      });
      const conv = res.data;
      // 请求期间用户已切换会话：丢弃本次结果。
      if (conv.id !== selectedConvIdRef.current) return;
      const older = mapMessages(conv);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      scrollRestoreRef.current = restore;
      setHasMoreMessages(!!conv.has_more);
      if (conv.next_cursor) oldestSeqRef.current = conv.next_cursor;
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreMessages(false);
    }
  };

  // 鼠标向上滚动到接近顶部时加载更早的消息。
  // 只处理向上滚动：程序化贴底（切换会话 / 新消息）是向下增大 scrollTop，不触发翻页。
  const handleListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const prev = lastScrollTopRef.current;
    lastScrollTopRef.current = top;
    if (top > prev || top > 80) return;
    void loadOlderMessages();
  };

  // 错误消息（如模型未配置 / 厂商鉴权失败）提供「配置 Agent」入口：
  // 先关闭承载本视图的 Modal / Drawer，再跳到配置页的 AI Agent 段。
  const goAgentConfig = useCallback(() => {
    onCancel?.();
    useRouterStore.getState().go("/config?tab=agent");
  }, [onCancel]);

  // 历史的「行计划」：tool_call 行与它的 tool_result 合并成一行。
  //
  // 聊天里只显示「Tool Call + 工具名 + 目的」，输出正文放在点击打开的右侧标签里，
  // 所以 tool_result 不再单独成行，而是把结果挂到对应调用上：
  //  - 调用行据此显示 Executing...（无结果）或已完成（有结果、不再显示正文）；
  //  - 点击时把入参与输出一起带给标签页的详情视图。
  //
  // 配对规则：优先按 call_id 精确对应；缺 call id 时按「其后、同名、按顺序」退化对应。
  const historyRows = useMemo(() => {
    const isResult = (kind?: string) => kind === "tool_result" || kind === "skill_result";
    const isCall = (kind?: string) => kind === "tool_call" || kind === "skill_call";

    const resultByCallId = new Map<string, ChatMessage>();
    const resultByName = new Map<string, ChatMessage[]>();
    messages.forEach((m) => {
      if (!isResult(m.kind)) return;
      const data = asRecord(m.data);
      // 后端统一用 tool_call_id 关联对应的 tool_call（data.id）。
      const callId = typeof data?.tool_call_id === "string" ? data.tool_call_id : "";
      if (callId) {
        if (!resultByCallId.has(callId)) resultByCallId.set(callId, m);
        return;
      }
      const name = typeof data?.name === "string" ? data.name : "";
      const queue = resultByName.get(name) ?? [];
      queue.push(m);
      resultByName.set(name, queue);
    });

    const consumed = new Set<ChatMessage>();
    const takeResult = (call: ChatMessage): ChatMessage | undefined => {
      const id = asRecord(call.data)?.id;
      const exact = typeof id === "string" ? resultByCallId.get(id) : undefined;
      if (exact && !consumed.has(exact)) {
        consumed.add(exact);
        return exact;
      }
      const name = asRecord(call.data)?.name;
      const queue = typeof name === "string" ? resultByName.get(name) : undefined;
      const next = queue?.find((candidate) => !consumed.has(candidate));
      if (next) {
        consumed.add(next);
        return next;
      }
      return undefined;
    };

    const rows: { message: ChatMessage; result?: ChatMessage }[] = [];
    for (const m of messages) {
      // 已经配对到某个 tool_call 的结果不再单独成行（它只在调用详情标签里展示）。
      if (isResult(m.kind) && consumed.has(m)) continue;
      rows.push({ message: m, result: isCall(m.kind) ? takeResult(m) : undefined });
    }
    return rows;
  }, [messages]);

  // 「轮次结束」消息的 id 集合：每个 task 的最后一条消息。
  //
  // fork 入口只挂在这些位置（每个 task 一个按钮），语义是「从这一轮结束后分叉」。
  // 仍然进行中的轮次（currentTaskId）不展示：它的最后一条消息还会继续增长，
  // 此时分叉会得到一个不完整的轮次。
  const turnEndMessageIds = useMemo(() => {
    const lastByTask = new Map<string, string>();
    for (const m of messages) {
      // 没有 taskId 的消息（如本地乐观插入的 user 气泡）不参与分组。
      if (!m.taskId) continue;
      lastByTask.set(m.taskId, m.id);
    }
    const ids = new Set<string>();
    for (const [taskId, id] of lastByTask) {
      if (taskId === currentTaskId) continue;
      ids.add(id);
    }
    return ids;
  }, [messages, currentTaskId]);

  // 该消息是否是某一轮（task）结束后的位置，且当前会话可 fork。
  const isTurnEndMessage = (m: ChatMessage) =>
    !!conversationId && m.seq !== undefined && turnEndMessageIds.has(m.id);

  // 权限 / 提问决策后兜底登记「活跃轮次」。
  //
  // 刷新页面后 activeTurnsRef 是空的：只有 handleSwitchConversation 会重建它，且仅当
  // conv.current_task_id 有效。若用户此时直接批准权限，后端会从 TaskWaitingPermission
  // 续跑到 TaskRunning 并继续推流，但本地 applyEvent 因找不到 turn 而丢弃全部事件，
  // 表现为「批准后时间线不动、收不到实时流」。因此决策后必须重新登记。
  const ensureActiveTurn = (taskId: string) => {
    const convId = selectedConvIdRef.current;
    if (!isValidTaskId(taskId) || !convId) return;
    if (activeTurnsRef.current.has(taskId)) return;
    activeTurnsRef.current.set(taskId, {
      taskId,
      convId,
      waiting: false,
      sending: true,
    });
  };

  // 按会话快照同步本轮 UI 状态（切换会话 / 刷新 / 轮次结束统一走这里）。
  //
  // 快照来自 /agent/conversation/get 的 active_task：一次请求即可判定
  // running / waiting_permission / 可续跑，无需再按 taskId 单独查询任务。
  const applySessionSnapshot = useCallback((conv: AgentConversationItem) => {
    const taskId = conv.current_task_id;
    const turn = deriveTurnState(taskId, conv.active_task);
    if (turn === null) {
      // 没有活跃轮次：清空运行态。
      if (isValidTaskId(taskId)) activeTurnsRef.current.delete(taskId);
      setCurrentTaskId(undefined);
      setSending(false);
      setWaiting(false);
      setResumableTaskId(undefined);
      return;
    }
    if (!turn) return; // 快照缺失：保持现状，避免把正在运行的一轮误判为已结束。
    if (!isValidTaskId(taskId)) return;

    if (turn.running || turn.waiting) {
      activeTurnsRef.current.set(taskId, {
        taskId,
        convId: conv.id,
        waiting: turn.waiting,
        sending: true,
      });
      setCurrentTaskId(taskId);
      setSending(true);
      setWaiting(turn.waiting);
      setResumableTaskId(undefined);
      return;
    }
    // 终态（completed / failed / canceled）：撤销活跃轮次；可续跑时保留 Continue 入口。
    activeTurnsRef.current.delete(taskId);
    setCurrentTaskId(undefined);
    setSending(false);
    setWaiting(false);
    setResumableTaskId(turn.resumable ? taskId : undefined);
  }, []);

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
      // 后端会唤醒执行循环并重新推流：重新登记活跃轮次，否则后续事件无人路由。
      ensureActiveTurn(perm.task_id);
      setWaiting(false);
      setSending(true);
      setCurrentTaskId(perm.task_id);
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
      ensureActiveTurn(perm.task_id);
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
  // 让 WS 事件继续路由到本轮，并清掉该任务的旧历史气泡与内存流，
  // 避免续跑后的新输出被历史残影遮挡。
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
      setMessages((prev) => prev.filter((m) => m.taskId !== taskId));
      resetLiveStream();
      // 续跑同样是新一轮输出：重新取一次快照，让实时块恢复"等待快照"后的追加状态。
      if (convId) void subscribeSession(convId, true);
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

  // 切换会话：加载最新一页消息；若存在活跃轮次则恢复实时流。
  const handleSwitchConversation = async (id: string) => {
    // 同一会话且已经加载过才跳过；直接带 ID 挂载时 loadedConvIdRef 还是空，需要真正拉一次。
    if (!id || (id === conversationId && loadedConvIdRef.current === id)) return;
    try {
      const res = await getConversationApi(id);
      const conv = res.data;
      // 详情自带最新 title：回填共享缓存，顶部标题不必再依赖会话列表。
      upsertConversation(conv);

      selectedConvIdRef.current = conv.id;
      setConversationId(conv.id);
      applySessionPage(conv);
      // 历史是权威：切会话后上一轮的实时块一律丢弃。
      resetLiveStream();
      pendingChatRef.current = false;
      // 登记实时订阅：响应里的「未落库尾巴」会补进实时块（刷新 / 中途进入不丢内容）。
      void subscribeSession(conv.id);
      // 切换会话时先重置续跑提示，后续按目标任务状态重新判定。
      setResumableTaskId(undefined);

      // 运行态直接由会话详情里的快照推导（不再按 taskId 单独查任务）。
      applySessionSnapshot(conv);

      const taskId = conv.current_task_id;
      if (!isValidTaskId(taskId)) {
        setPendingPermissions([]);
        setPendingQuestions([]);
        return;
      }
      if (!activeTurnsRef.current.has(taskId)) {
        // 终态轮次：无需恢复权限 / 提问卡片。
        setPendingPermissions([]);
        setPendingQuestions([]);
        return;
      }

      // 恢复该任务待确认的权限，保证刷新后切换到会话时按钮仍在。
      loadPermissions(taskId);
      // 恢复该任务待作答的提问，保证刷新后提问卡片仍在。
      loadQuestions(taskId);
    } catch {
      // 错误由全局拦截器提示。
    }
  };

  // 清空为「新会话」状态：New Chat（/session）以及宿主要求重置时使用。
  const handleClear = () => {
    // 新建会话：撤销上一个会话的实时订阅（订阅按会话生效）。
    const prevConvId = subscribedConvIdRef.current;
    subscribedConvIdRef.current = undefined;
    if (prevConvId) void unsubscribeAgentSessionApi(prevConvId).catch(() => {});
    selectedConvIdRef.current = undefined;
    loadedConvIdRef.current = undefined;
    pendingChatRef.current = false;
    resetLiveStream();
    setConversationId(undefined);
    setCurrentTaskId(undefined);
    setMessages([]);
    // 新建会话：重置分页状态，避免把上个会话的游标带入。
    setHasMoreMessages(false);
    oldestSeqRef.current = 0;
    scrollRestoreRef.current = null;
    lastScrollTopRef.current = 0;
    setSending(false);
    setWaiting(false);
    setPendingPermissions([]);
    setPendingQuestions([]);
    setResumableTaskId(undefined);
    setInput("");
  };

  // 会话列表由左侧「Agent 会话」面板共享：挂载时只在尚未加载过时兜底拉一次
  // （列表自己的面板已挂载时会先拉，这里不再重复请求）。
  useEffect(() => {
    void ensureAgentConversations();
  }, []);

  // 外部会话变化（左侧会话列表点击 / New Chat）时同步内容：
  // - 有 ID → 续接该会话；
  // - 没有 ID（/session）→ 清空成新会话。
  useEffect(() => {
    if (!initialConversationId) {
      handleClear();
      return;
    }
    handleSwitchConversation(initialConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  // 重新拉取当前会话（最新一页消息）：用于手动同步后端最新状态。
  //
  // 用 selectedConvIdRef 而不是 conversationId state：本函数会被 WS 回调（首次渲染
  // 时注册的闭包）间接调用，state 可能已经过期（例如从 /session 新建会话后跳转）。
  //
  // resetStream=false 仅用于「别人发起一轮」时补拉用户消息：此时实时块刚收到第一条，
  // 不应因为这次补拉而丢掉。
  const handleReloadConversation = async (resetStream = true) => {
    const id = selectedConvIdRef.current;
    if (!id) return;
    setReloadingConversation(true);
    try {
      const res = await getConversationApi(id);
      const conv = res.data;
      // 仅在仍是同一会话时回填，避免请求期间用户已切换会话造成覆盖。
      if (conv.id !== selectedConvIdRef.current) return;
      upsertConversation(conv);
      applySessionPage(conv);
      // 历史重新加载后清空实时块，避免与历史重复；随后重新订阅拿最新快照，
      // 把仍未被落库的尾部补回来。
      if (resetStream) {
        resetLiveStream();
        void subscribeSession(conv.id, true);
      }
      // 同步运行态 / 续跑提示。WS 的中间态事件不落库，
      // 刷新 / 重连后由会话快照补回 waiting，避免丢失实时流。
      applySessionSnapshot(conv);
      // 同步刷新待确认权限 / 待作答提问，保证按钮与卡片与后端一致。
      const taskId = conv.current_task_id;
      if (isValidTaskId(taskId) && activeTurnsRef.current.has(taskId)) {
        void loadPermissions(taskId);
        void loadQuestions(taskId);
      } else {
        setPendingPermissions([]);
        setPendingQuestions([]);
      }
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setReloadingConversation(false);
    }
  };

  // task.failed 兜底：若历史里没有 kind=error 的消息（旧数据 / 落库异常），
  // 用会话快照携带的任务 error 补一条错误气泡，保证错误信息稳定可见。
  const appendTaskError = (
    list: ChatMessage[],
    taskId: string,
    error?: string,
  ) => {
    if (list.some((m) => m.taskId === taskId && (m.kind === "error" || m.error))) return;
    const text = (error ?? "").trim();
    if (!text) return;
    list.push({
      id: `error-${taskId}`,
      role: "assistant",
      kind: "error",
      content: text,
      taskId,
      error: true,
    });
  };

  // 轮次结束：把 assistant 回复固化到消息列表（若为选中会话），并清理活跃轮次。
  const finalizeTurn = async (turn: ActiveTurn, type: string) => {
    const selected = turn.convId === selectedConvIdRef.current;
    if (selected) {
      let historyApplied = false;
      try {
        const res = await getConversationApi(turn.convId);
        const conv = res.data;
        // 首轮对话后后端才会生成 title：轮次结束回填一次，头部标题随之更新。
        upsertConversation(conv);
        const nextMessages = mapMessages(conv);
        if (type === "task.failed") {
          appendTaskError(nextMessages, turn.taskId, conv.active_task?.error);
        }
        setMessages(nextMessages);
        historyApplied = true;
        // 终态后按快照同步「是否可续跑」（failed / canceled 且保留检查点）。
        applySessionSnapshot(conv);
        // 轮次结束后回到最新一页（与后续向上滚动加载的游标保持一致）。
        setHasMoreMessages(!!conv.has_more);
        oldestSeqRef.current = conv.next_cursor ?? 0;
        scrollRestoreRef.current = null;
      } catch {
        // API errors are shown globally by the http interceptor.
      }
      setCurrentTaskId(undefined);
      setSending(false);
      setWaiting(false);
      setPendingPermissions([]);
      setPendingQuestions([]);
      // 历史已回填则清空本轮实时块，避免与历史重复；
      // 拉取失败时保留实时块，避免正在展示的输出凭空消失。
      if (historyApplied) finishLiveTask(turn.taskId);
    }
    activeTurnsRef.current.delete(turn.taskId);
    // 本轮结束后刷新会话列表（标题 / 顺序 / 消息数可能变化）。
    void loadAgentConversations();
  };

  // 事件是否属于当前打开的会话。
  //
  // 服务端已按会话订阅推送，这里再按 session_id 兜底过滤：同一条 WS 连接上可能
  // 还有其他来源的事件（例如旧订阅尚未撤销），不能把别的会话的事件记到当前轮次。
  const isSelectedConversationEvent = (ev: AgentEventItem) =>
    !ev.session_id || ev.session_id === selectedConvIdRef.current;

  // 收到「别人发起」的一轮任务时，在本地补登记活跃轮次。
  //
  // A 发起一轮后，B 的页面只收到 WS 事件，本地没有对应的 turn 记录。
  // 这里用事件自带的 session_id 判断它属于当前会话，补一条 turn，后续
  // 权限卡片 / 终态收尾就能正常路由。
  //
  // 终态事件不补登记：这一轮已经结束，只需要刷新会话拿到最终投影。
  const adoptForeignTurn = (ev: AgentEventItem): ActiveTurn | undefined => {
    const convId = ev.session_id ?? selectedConvIdRef.current;
    if (!convId || convId !== selectedConvIdRef.current || !isValidTaskId(ev.task_id)) {
      return undefined;
    }
    if (TERMINAL_EVENT_TYPES.has(ev.type ?? "")) return undefined;

    const turn: ActiveTurn = {
      taskId: ev.task_id,
      convId,
      waiting: ev.type === "task.waiting",
      sending: true,
    };
    activeTurnsRef.current.set(ev.task_id, turn);
    setCurrentTaskId(ev.task_id);
    setSending(true);
    setWaiting(turn.waiting);
    setResumableTaskId(undefined);
    // 事件里不带用户输入，拉一次会话补上对方刚发出的那条 user 消息。
    // 不重置实时块：第一条增量刚到，这次补拉不应把它抹掉。
    void handleReloadConversation(false);
    return turn;
  };

  // 处理一个任务事件（生命周期收尾；stream 增量交给本组件的实时块状态）。
  //
  // 事件流是广播语义：同一会话的所有在线客户端都会收到，因此不再按「谁发起」过滤。
  // 分两路：
  //   1) stream → 追加到 `liveBlocks`，只渲染当前会话这一轮；
  //   2) task.started / task.waiting / 权限 / 提问 / 终态 → 同步发送状态与卡片。
  const applyEvent = (ev: AgentEventItem) => {
    if (!ev?.type) return;

    // 新建会话的首批事件可能早于 /agent/chat 响应到达：此时还没有会话 ID，
    // 但已经处于「发送中」，先按当前轮接收（响应回来后不会再重置实时块）。
    const awaitingNewChat = !selectedConvIdRef.current && pendingChatRef.current;
    if (!isSelectedConversationEvent(ev) && !awaitingNewChat) return;

    if (ev.type === "stream") enqueueLiveEvent(ev);

    let turn = activeTurnsRef.current.get(ev.task_id);
    if (!turn) {
      turn = adoptForeignTurn(ev);
      if (!turn) {
        // 只收到终态（订阅前任务已结束 / 页面加载竞态）：刷新会话把最终结果投影出来。
        if (TERMINAL_EVENT_TYPES.has(ev.type ?? "")) {
          void handleReloadConversation();
        }
        return;
      }
    }

    if (ev.type === "task.started") {
      setWaiting(false);
      return;
    }
    if (ev.type === "task.waiting") {
      setWaiting(true);
      return;
    }

    const selected = turn.convId === selectedConvIdRef.current;

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
      if (selected) {
        // 终态同时意味着本轮的「等待权限」结束：同步本地状态，避免 UI 卡在 waiting。
        setWaiting(false);
      }
      void finalizeTurn(turn, ev.type);
    }
  };

  // 全局订阅 WS：把 agent.event 转成当前会话页的实时块，并驱动生命周期收尾。
  //
  // 订阅只在组件挂载期间生效（卸载即退订）：页面离开后本来就收不到该会话的事件，
  // 未落库的增量由后端补齐后经历史接口恢复，这里不做跨页面缓存。
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

    // 新一轮开始：先清空上一轮的实时块。必须在 await 之前，
    // 否则会把响应返回前已经到达的首批 token 一并抹掉（新建会话时尤其明显）。
    resetLiveStream();
    pendingChatRef.current = true;
    // 已有会话：刷新一次订阅快照，实时块进入「等快照」状态后再生效，
    // 避免新轮增量与未清理的旧块拼接出现空档。
    if (conversationId) void subscribeSession(conversationId, true);

    try {
      const res = await chatAgentApi({
        conversation_id: conversationId,
        message: text,
      });
      const { task_id, conversation_id } = res.data;
      pendingChatRef.current = false;

      selectedConvIdRef.current = conversation_id;
      setConversationId(conversation_id);
      // 新会话刚创建，本地已有乐观消息：标记为已加载，避免地址同步后重新拉取把消息冲掉。
      loadedConvIdRef.current = conversation_id;
      // 新建会话后同步地址（/session/:sessionId）并刷新左侧会话列表。
      onConversationChange?.(conversation_id);
      void loadAgentConversations();
      // 登记订阅：新会话的首批增量可能已经到达，快照会把它们补齐。
      void subscribeSession(conversation_id);

      // 登记本轮活跃状态，供切换后恢复运行标志。
      const turn: ActiveTurn = {
        taskId: task_id,
        convId: conversation_id,
        waiting: false,
        sending: true,
      };
      activeTurnsRef.current.set(task_id, turn);
      setCurrentTaskId(task_id);

      // 本轮任务可能很快进入等待权限，提前拉取待确认权限。
      loadPermissions(task_id);
      // 本轮任务也可能很快发起提问，提前拉取待作答提问。
      loadQuestions(task_id);
    } catch {
      // API 错误由全局拦截器提示。
      pendingChatRef.current = false;
      setSending(false);
      setWaiting(false);
    }
  };

  // 切换到 fork 出来的新会话：它是一个干净的顶层会话，
  // 没有活跃轮次、没有权限 / 提问、没有可续跑任务。
  const switchToForkedConversation = useCallback(
    async (conv: AgentConversationItem) => {
      selectedConvIdRef.current = conv.id;
      setConversationId(conv.id);
      onConversationChange?.(conv.id);
      upsertConversation(conv);
      applySessionPage(conv);
      resetLiveStream();
      void subscribeSession(conv.id);
      setCurrentTaskId(undefined);
      setSending(false);
      setWaiting(false);
      setPendingPermissions([]);
      setPendingQuestions([]);
      setResumableTaskId(undefined);
      void loadAgentConversations();
    },
    [applySessionPage, onConversationChange, resetLiveStream, subscribeSession],
  );

  // 按任务删除这一轮：连同该轮的 user 消息与时间线一起删除（任务记录保留）。
  const handleDeleteTurn = async (message: ChatMessage) => {
    const id = selectedConvIdRef.current;
    const taskId = message.taskId;
    if (!id || !isValidTaskId(taskId)) return;
    setBusyTaskId(taskId);
    try {
      await deleteAgentTurnApi(taskId);
      getGlobalMessage()?.success("Turn deleted");
      void handleReloadConversation(false);
      void loadAgentConversations();
    } catch {
      // 错误由全局拦截器提示。
    } finally {
      setBusyTaskId(undefined);
    }
  };

  // 重试这一轮：后端删除该轮消息并用原用户输入重新发起一轮，这里接上新的实时流。
  const handleRetryTurn = async (message: ChatMessage) => {
    const taskId = message.taskId;
    if (!isValidTaskId(taskId) || sending) return;
    setBusyTaskId(taskId);
    // 新一轮开始：先清掉上一轮的实时块（后端已删除该轮消息），
    // 同时把本地列表里这一轮的旧消息去掉；新任务的增量会直接追加到末尾。
    resetLiveStream();
    setMessages((prev) => prev.filter((item) => item.taskId !== taskId));
    pendingChatRef.current = true;
    const convId = selectedConvIdRef.current;
    if (convId) void subscribeSession(convId, true);
    try {
      const res = await retryAgentTurnApi(taskId);
      const { task_id, conversation_id } = res.data;
      pendingChatRef.current = false;
      selectedConvIdRef.current = conversation_id;
      setConversationId(conversation_id);
      loadedConvIdRef.current = conversation_id;
      onConversationChange?.(conversation_id);
      void loadAgentConversations();
      void subscribeSession(conversation_id);

      activeTurnsRef.current.set(task_id, {
        taskId: task_id,
        convId: conversation_id,
        waiting: false,
        sending: true,
      });
      setCurrentTaskId(task_id);
      setSending(true);
      setWaiting(false);
      setResumableTaskId(undefined);
      void loadPermissions(task_id);
      void loadQuestions(task_id);
    } catch {
      // 错误由全局拦截器提示；恢复列表为服务端的真实状态（可能已删除旧消息）。
      pendingChatRef.current = false;
      setSending(false);
      setWaiting(false);
      void handleReloadConversation(false);
    } finally {
      setBusyTaskId(undefined);
    }
  };

  // 从某轮结束处分叉：只复制该消息（含）之前的历史到新会话。
  // 这样可以在不改动原会话的前提下，回到某个轮次结束后重新提问。
  // 回调保持引用稳定，避免每次 token 刷新都把历史行的 memo 冲掉。
  const handleForkFromMessage = useCallback(
    async (message: ChatMessage) => {
      const id = selectedConvIdRef.current;
      const seq = message.seq;
      if (!id || seq === undefined) return;
      setForkingFromSeq(seq);
      try {
        const res = await forkConversationApi(id, { up_to_seq: seq, copy_files: true });
        await switchToForkedConversation(res.data);
        getGlobalMessage()?.success("Forked after this turn");
      } catch {
        // 错误由全局拦截器提示。
      } finally {
        setForkingFromSeq(undefined);
      }
    },
    [switchToForkedConversation],
  );

  // 当前用户选中的 Profile 展示名（由 /auth/me 解析的 agent_profile DTO 提供）。
  const currentProfileId = userInfo?.agent_config?.profile_id;

  // 把实时块转成与「历史消息」完全相同的形状，直接拼进同一个列表渲染。
  //
  // 为什么这样做（而不是单独一个面板）：
  //   - 用户看到的气泡样式、左对齐、Tool Call / Tool Result 合并规则，
  //     全部与刷新后的历史一致，不存在「刷新前一个样、刷新后一个样」；
  //   - tool_result 在写入时已经并入调用块（见 agent-live-stream 的 attachToolResult），
  //     配不上的结果（中途进入时手里没有调用行）留给历史行回填，不单独成行。
  const liveRows = useMemo(
    () =>
      liveBlocks
        .filter((block) => !isToolResultKind(block.kind))
        .map<{ message: ChatMessage; result?: ChatMessage }>((block) => {
          const inlineResult = asRecord(asRecord(block.data)?.result);
          return {
            message: {
              // 稳定 key：同一块在多次渲染中保持一致，避免列表重挂。
              id: `live-${block.key}`,
              role: "assistant",
              content: block.content,
              kind: block.kind,
              data: block.data,
              error: !!block.error,
              streaming: !!block.streaming,
              taskId: block.taskId,
            },
            result: inlineResult
              ? {
                  id: `live-${block.key}-result`,
                  role: "assistant",
                  kind: "tool_result",
                  content: "",
                  data: inlineResult,
                }
              : undefined,
          };
        }),
    [liveBlocks],
  );

  // 实时 tool_result 索引（call_id → data）：中途进入时调用行来自历史，
  // 结果只存在于实时流里，用它把历史行从「执行中」切换到「已完成」。
  const liveResults = useMemo(() => {
    const map = new Map<string, unknown>();
    liveBlocks.forEach((block) => {
      if (!isToolResultKind(block.kind)) return;
      const callId = asRecord(block.data)?.tool_call_id;
      if (typeof callId === "string" && callId && !map.has(callId)) {
        map.set(callId, block.data);
      }
    });
    return map;
  }, [liveBlocks]);

  // 历史在前、实时在后。两边形状相同，共用同一个 MessageRow。
  // 历史重载后实时块会被清空（见 resetLiveStream 的调用点），因此不需要跨来源去重。
  const allRows = useMemo(() => {
    if (liveResults.size === 0) return [...historyRows, ...liveRows];
    const enriched = historyRows.map((row) => {
      if (row.result || !isCallKind(row.message.kind)) return row;
      const callId = asRecord(row.message.data)?.id;
      const data = typeof callId === "string" ? liveResults.get(callId) : undefined;
      if (data === undefined) return row;
      return {
        ...row,
        result: {
          id: `live-${callId}-result`,
          role: "assistant" as const,
          kind: "tool_result",
          content: "",
          data,
        },
      };
    });
    return [...enriched, ...liveRows];
  }, [historyRows, liveRows, liveResults]);

  // 列表是否为空：历史与实时都没有内容时展示占位符。
  const hasAnyRow = allRows.length > 0;

  return (
    <Flex vertical style={{ height: "100%", minHeight: 480 }}>
      {/* 头部：单行解决「会话操作 + 上下文 + Profile」，窄屏时自动换行。
          会话切换 / New Chat 在左侧「Agent 会话」面板，不占用这里。 */}
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
        <Flex align="center" justify="space-between" gap={12} wrap>
          {/* 左侧：业务上下文与运行状态 */}
          <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
            {envInfo?.profile_name ? (
              <Space.Compact style={{ minWidth: 0 }}>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  title="View system prompt"
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
                    {envInfo.profile_name}
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
          {/* 右侧：Profile 选择与配置，Reload 固定在行尾（最右） */}
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
            {/* 关闭仅在 Modal / Drawer 宿主中由 invoke 注入。 */}
            {onCancel && (
              <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
                Close
              </Button>
            )}
            <Divider type="vertical" style={{ margin: 0, height: 18 }} />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={reloadingConversation}
              title="Reload current conversation"
              onClick={() => void handleReloadConversation()}
              disabled={!conversationId}
            >
              Reload
            </Button>
          </Flex>
        </Flex>
      </Flex>

      {/* 消息区域：历史消息与实时块共用同一个列表；实时块只在当前轮存在，
          轮次结束 / 切换会话 / 重新加载历史后清空。 */}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa",
        }}
      >
        {!hasAnyRow && !currentTaskId ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Start a conversation with the agent"
            style={{ marginTop: 48 }}
          />
        ) : (
          <Flex vertical gap="small">
            {/* 向上加载更早消息：滚动到顶部自动触发，同时保留手动入口。 */}
            {loadingMoreMessages ? (
              <Flex justify="center" style={{ padding: "4px 0" }}>
                <Spin size="small" indicator={<LoadingOutlined spin />} />
              </Flex>
            ) : (
              hasMoreMessages && (
                <Flex justify="center">
                  <Button type="link" size="small" onClick={() => void loadOlderMessages()}>
                    Load earlier messages
                  </Button>
                </Flex>
              )
            )}
            {allRows.map(({ message: m, result }) => (
              <MessageRow
                key={m.id}
                message={m}
                result={result}
                conversationId={conversationId}
                isTurnEnd={isTurnEndMessage(m)}
                forking={forkingFromSeq === m.seq}
                turnBusy={busyTaskId === m.taskId}
                forkDisabled={forkingFromSeq !== undefined || busyTaskId !== undefined}
                onFork={handleForkFromMessage}
                onDeleteTurn={handleDeleteTurn}
                onRetryTurn={handleRetryTurn}
                onGoConfig={goAgentConfig}
              />
            ))}
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

// 消息内的操作（Fork）：默认隐藏，鼠标悬停该条消息时才显示。
const AGENT_CHAT_MSG_STYLE = `
.agent-chat-msg .agent-chat-msg-actions { visibility: hidden; }
.agent-chat-msg:hover .agent-chat-msg-actions { visibility: visible; }
`;

// 注入一次全局样式（仅浏览器环境）；模块级常量保证重复渲染不会插入多个 <style>。
if (typeof document !== "undefined") {
  const styleId = "agent-chat-msg-style";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = AGENT_CHAT_MSG_STYLE;
    document.head.appendChild(styleEl);
  }
}

export default AgentChat;

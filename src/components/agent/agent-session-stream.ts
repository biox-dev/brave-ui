import { useRef, useSyncExternalStore } from "react";
import type { AgentEventItem } from "@/api/agent";

/**
 * 会话级实时流仓库（纯内存，不落库、不发请求）。
 *
 * 设计目标（长任务 + 随时切换查看进度）：
 *
 *   - Agent 任务在后台长时间运行，用户会频繁切换页面 / 会话再回来。切换页面会卸载
 *     聊天组件，local state 里的增量文本就丢了；因此流式增量必须存在一个**模块级**
 *     仓库里，只要页面没刷新就一直在。
 *   - 数据来源只有两条：① `getConversationApi` 返回的数据库消息（进会话时展示）；
 *     ② WS 推送的 `agent.event`（`stream` 增量 / 完整块）。**不再调用
 *     `/agent/task/timeline` 回填**——数据库里有的是历史，内存里的是增量，两者拼接。
 *   - 浏览器刷新后内存清空：此时先展示数据库消息，任务仍在运行时继续接收 WS 增量
 *     追加。刷新前的增量文本（不在库里）会丢失，表现为「新的消息块从头开始」，
 *     这是当前已知的取舍，等增量入库后再消除。
 *
 * 为什么要独立于 React：WS 订阅必须与组件生命周期解耦。组件卸载（切走页面）后
 * 增量仍然写入仓库，回来时一次性渲染出来，不会因为「切换期间无人订阅」而丢事件。
 */

/** 一条流式块（reasoning / assistant / tool_call / ...），形状与历史消息一致。 */
export interface StreamBlock {
  /** 稳定 key：WS 事件 id，或由事件 id + 序号拼出。 */
  key: string;
  kind: string;
  content: string;
  data?: unknown;
  /** 所属任务：历史消息按 task_id 落库，实时块也带上同一归属，供逐任务去重。 */
  taskId?: string;
  /** 是否仍在追加（渲染层据此展示光标 / streaming 标记）。 */
  streaming?: boolean;
  error?: boolean;
}

interface SessionStreamState {
  /** 属于哪个会话的多轮任务事件（用于跨会话渲染时兜底校验）。 */
  convId?: string;
  blocks: StreamBlock[];
  /** 由事件投影出的任务状态：running / waiting / task.completed ... */
  status: string;
  /**
   * 已取到的增量块数量。
   *
   * 历史消息里可能已经包含同样内容的落库块（后端把完整块即时写入 agent_messages），
   * 展示时按「数据库消息在前、内存增量在后」拼接，并用该值把历史已覆盖的前缀切掉，
   * 避免同一段内容出现两份（见 agent-chat.tsx 的 realtimeRows）。
   */
  blockCount: number;
}

interface SessionStreamEntry {
  state: SessionStreamState;
  /** 当前正在写入的任务 ID：新块带上它，渲染层据此与同任务的历史消息比对去重。 */
  currentTaskId?: string;
  /** 每个任务的处理游标：用于丢弃重复投递的事件 id。 */
  cursors: Map<string, Set<string>>;
  /** 每个任务的重新渲染节流（token 级事件量很大）。 */
  trailing: Map<string, ReturnType<typeof setTimeout>>;
  /** 是否还有未触发的立即刷新。 */
  leadScheduled: boolean;
}

/** 增量刷新节流间隔：token 流每几毫秒一条，节流后才能保持渲染流畅。 */
const FLUSH_INTERVAL_MS = 60;

/** 工具结果的 kind 映射：结果并入对应的调用行，不单独成行。 */
const resultKindOf = (kind: string): string => (kind === "skill_result" ? "skill_call" : "tool_call");

const EMPTY_STATE: SessionStreamState = { blocks: [], status: "created", blockCount: 0 };

const entries = new Map<string, SessionStreamEntry>();
/// 结构变化（新块）时递增，供 useSyncExternalStore 判断快照是否变化。
let version = 0;
const listeners = new Set<() => void>();

/**
 * 全局订阅入口（引用稳定）。
 *
 * 必须定义在模块级：如果每次渲染新建 `subscribe` 函数，useSyncExternalStore 会
 * 反复退订 / 重订，配合节流通知容易漏掉更新。
 */
const subscribeAll = (onStoreChange: () => void) => {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
};

const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

/**
 * 当前快照：每次都返回新对象（节流后才会调用），组件按引用变化重渲染。
 *
 * 数组需要浅拷贝，避免订阅方拿到可变的内部数组。块对象本身在写入时已改为
 * **不可变替换**（见 appendStreaming / attachToolResult / closeStreaming），
 * 因此这里不需要再复制块：未变的块保持同一引用，下游 `memo` 照常跳过渲染。
 */
const snapshot = (entry?: SessionStreamEntry): SessionStreamState => {
  if (!entry) return EMPTY_STATE;
  return { ...entry.state, blocks: [...entry.state.blocks] };
};

const getVersion = () => version;

// 供调试 / 测试读取：某个会话当前内存里的流。
export const peekSessionStream = (convId?: string): SessionStreamState =>
  convId ? snapshot(entries.get(convId)) : EMPTY_STATE;

const ensureEntry = (convId: string): SessionStreamEntry => {
  let entry = entries.get(convId);
  if (!entry) {
    entry = {
      state: { convId, blocks: [], status: "created", blockCount: 0 },
      cursors: new Map(),
      trailing: new Map(),
      leadScheduled: false,
    };
    entries.set(convId, entry);
  }
  return entry;
};

const touch = (entry: SessionStreamEntry) => {
  entry.state.blockCount = entry.state.blocks.length;
};

/**
 * 状态优先级：数字越大越「新」。用于合并「实时事件推导的状态」与「后端任务快照」，
 * 避免刷新后按旧快照把已完成的轮次回退成 running。
 */
const STATUS_RANK: Record<string, number> = {
  created: 0,
  running: 1,
  waiting: 2,
  "task.completed": 3,
  "task.failed": 3,
  "task.canceled": 3,
};

/** 取两者中更新的状态（终态不可回退）。 */
const mergeStatus = (current: string, next: string) =>
  (STATUS_RANK[next] ?? 0) >= (STATUS_RANK[current] ?? 0) ? next : current;

const pushBlock = (entry: SessionStreamEntry, block: StreamBlock) => {
  entry.state.blocks.push(
    block.taskId || !entry.currentTaskId ? block : { ...block, taskId: entry.currentTaskId },
  );
  touch(entry);
};

/** 关闭所有仍在追加的块（轮次结束时使用）。 */
const closeStreaming = (entry: SessionStreamEntry) => {
  let changed = false;
  entry.state.blocks = entry.state.blocks.map((block) => {
    if (!block.streaming) return block;
    changed = true;
    return { ...block, streaming: false };
  });
  return changed;
};

/** 找到最后一个仍在追加的同类型块，追加文本；没有则新起一块。 */
const appendStreaming = (entry: SessionStreamEntry, key: string, kind: string, delta: string) => {
  if (!delta) return false;
  const blocks = entry.state.blocks;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind !== kind || !block.streaming) continue;
    // 不可变更新：替换为新对象，让下游 memo 能感知内容变化。
    blocks[i] = { ...block, content: block.content + delta };
    return true;
  }
  pushBlock(entry, { key, kind, content: delta, streaming: true });
  return true;
};

/**
 * 用完整块内容替换仍在追加的同类型块（`message` / `reasoning` 结束事件）。
 * 找不到时按一条新块追加。
 */
const finalizeStreaming = (
  entry: SessionStreamEntry,
  key: string,
  kind: string,
  content: string,
  data?: unknown,
) => {
  const blocks = entry.state.blocks;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind !== kind || !block.streaming) continue;
    blocks[i] = {
      ...block,
      streaming: false,
      ...(content ? { content } : null),
      ...(data !== undefined ? { data } : null),
    };
    return;
  }
  if (content || data !== undefined) {
    pushBlock(entry, { key, kind, content: content || "", data, streaming: false });
  }
};

/**
 * 把工具结果并入对应的调用块（而不是单独追加一行）。
 *
 * 实时流里 tool_call / tool_result 是两条独立事件；如果各成一行，列表配对一旦失败
 * 就会出现孤立的「Tool Result」气泡。这里在写入时就按 call_id（缺省按同名未完成调用）
 * 合并，调用行据此从「执行中」切到「已完成」。
 */
const attachToolResult = (entry: SessionStreamEntry, kind: string, content: string, data: unknown) => {
  const callKind = resultKindOf(kind);
  const resultData = (data ?? {}) as Record<string, unknown>;
  const callId = typeof resultData.tool_call_id === "string" ? resultData.tool_call_id : "";

  for (let i = entry.state.blocks.length - 1; i >= 0; i--) {
    const block = entry.state.blocks[i];
    if (block.kind !== callKind) continue;
    const callData = (block.data ?? {}) as Record<string, unknown>;
    if (callData.result !== undefined) continue;
    const matchesId = !!callId && callData.id === callId;
    const matchesName = !callId && callData.name === resultData.name;
    if (!matchesId && !matchesName) continue;

    // 不可变更新：替换为新对象，让下游 memo 感知「已执行完」。
    entry.state.blocks[i] = {
      ...block,
      data: {
        ...callData,
        result: { content, is_error: !!resultData.is_error, metadata: resultData.metadata },
      },
    };
    return true;
  }
  return false;
};

/** 把一条 stream 事件折叠进块列表。返回是否有内容变化。 */
const applyStreamPayload = (entry: SessionStreamEntry, key: string, payload: unknown) => {
  const p = (payload ?? {}) as Record<string, unknown>;
  const pType = typeof p.type === "string" ? p.type : "";
  const content = typeof p.content === "string" ? p.content : "";

  switch (pType) {
    case "text":
      return appendStreaming(entry, key, "assistant", content);
    case "reasoning_delta":
      return appendStreaming(entry, key, "reasoning", content);
    case "message": {
      const data = (p.data ?? {}) as Record<string, unknown>;
      const text = typeof data.content === "string" ? data.content : "";
      const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : [];
      let changed = false;
      toolCalls.forEach((tc, index) => {
        pushBlock(entry, {
          key: `${key}#tc${index}`,
          kind: "tool_call",
          content: "",
          data: tc,
          streaming: false,
        });
        changed = true;
      });
      if (text) {
        finalizeStreaming(entry, key, "assistant", text, p.data);
        changed = true;
      }
      return changed;
    }
    case "reasoning": {
      const data = (p.data ?? {}) as Record<string, unknown>;
      const text = typeof data.content === "string" ? data.content : "";
      finalizeStreaming(entry, key, "reasoning", text, p.data);
      return true;
    }
    case "tool_call":
    case "skill_call": {
      pushBlock(entry, { key, kind: pType, content, data: p.data, streaming: false });
      return true;
    }
    case "tool_result":
    case "skill_result": {
      // 工具结果的正文在 `data.content` 里：`StreamEvent.Content` 只用于增量事件
      // （text / reasoning_delta），完整块（tool_result）的 content 恒为空。
      // 只读 p.content 会让内联到调用块的 result.content 为空，表现为详情页
      // 一直显示 No output（刷新后从历史消息读到 data.content 才恢复）。
      const resultData = (p.data ?? {}) as Record<string, unknown>;
      const resultContent =
        typeof resultData.content === "string" ? resultData.content : content;
      if (attachToolResult(entry, pType, resultContent, p.data)) return true;
      pushBlock(entry, {
        key,
        kind: pType,
        content: resultContent,
        data: p.data,
        streaming: false,
      });
      return true;
    }
    case "error": {
      const data = (p.data ?? {}) as Record<string, unknown>;
      const text = content || (typeof data.error === "string" ? data.error : "") || "Stream error";
      pushBlock(entry, { key, kind: "assistant", content: text, error: true, streaming: false });
      return true;
    }
    case "done": {
      // 结束事件只负责收尾：把仍在追加的块关掉，避免光标一直闪。
      return closeStreaming(entry);
    }
    default:
      return false;
  }
};

/** 立刻通知订阅者（用于结构性变化：新块 / 状态切换）。 */
const flushNow = (entry: SessionStreamEntry) => {
  entry.leadScheduled = false;
  notify();
};

/** 节流通知：token 级追加合并到 ~60ms 一批。 */
const scheduleFlush = (entry: SessionStreamEntry) => {
  if (entry.leadScheduled) return;
  entry.leadScheduled = true;
  setTimeout(() => {
    if (!entry.leadScheduled) return;
    flushNow(entry);
  }, FLUSH_INTERVAL_MS);
};

/**
 * 消费一条 agent.event。
 *
 * 事件是**广播**语义：所有在线客户端都收到同一份。因此这里只按键去重（幂等），
 * 不像旧实现那样由「谁发起请求」决定要不要接收。
 */
export const ingestAgentEvent = (ev: AgentEventItem) => {
  if (!ev || !ev.type) return;
  const convId = ev.session_id;
  const taskId = ev.task_id;
  if (!convId || !taskId) return;

  const entry = ensureEntry(convId);
  if (entry.state.convId !== convId) entry.state.convId = convId;
  // 本事件的块归属到这个任务：渲染时按 task_id 与历史消息比对（详见 agent-chat.tsx）。
  entry.currentTaskId = taskId;

  // 终止型终态事件不可逆：任务结束后再收到的旧事件（重连补发）一律忽略。
  const status = entry.state.status;
  const terminal = status === "task.completed" || status === "task.failed" || status === "task.canceled";

  // 去重：按任务维护已处理的事件 id。
  let seen = entry.cursors.get(taskId);
  if (!seen) {
    seen = new Set<string>();
    entry.cursors.set(taskId, seen);
  }
  const key = ev.id ?? `${taskId}:${ev.type}:${ev.created_at}`;
  if (seen.has(key)) return;
  seen.add(key);

  if (ev.type === "task.started" || ev.type === "task.waiting") {
    // 已在等待中的会话收到一次「运行中」不算变化；反之亦然。
    const next = ev.type === "task.waiting" ? "waiting" : "running";
    if (terminal || entry.state.status === next) {
      // 仍然要排一次刷新：可能刚好有未提交的增量。
      scheduleFlush(entry);
      return;
    }
    entry.state.status = next;
    flushNow(entry);
    return;
  }

  if (ev.type === "task.completed" || ev.type === "task.failed" || ev.type === "task.canceled") {
    if (terminal) return;
    const changed = closeStreaming(entry);
    entry.state.status = ev.type;
    if (changed) flushNow(entry);
    else flushNow(entry);
    return;
  }

  if (ev.type !== "stream") {
    // 权限 / 提问事件不进流（由聊天组件驱动卡片）。
    return;
  }

  if (terminal) return;

  // 任务一旦开始产出增量，状态至少是运行中（避免头部一直显示 created）。
  if (entry.state.status === "created") entry.state.status = "running";

  const changed = applyStreamPayload(entry, key, ev.payload);
  if (!changed) return;
  scheduleFlush(entry);
};

/**
 * 新一轮开始（用户刚发出消息）：清空该会话内存里上一轮的残留。
 *
 * 只在「确实还残留已结束的轮次」时清空；如果上一轮仍在进行（并发调度），
 * 保留现场，避免把正在输出的内容抹掉。
 */
export const beginSessionStream = (convId: string) => {
  const entry = entries.get(convId);
  if (!entry) return;
  const status = entry.state.status;
  const running = status === "created" || status === "running" || status === "waiting";
  if (running) return;
  entry.state.blocks = [];
  entry.state.blockCount = 0;
  entry.state.status = "created";
  entry.currentTaskId = undefined;
  entry.cursors.clear();
  flushNow(entry);
};

/**
 * 会话被删除 / 用户主动清空时丢弃内存流。
 */
export const clearSessionStream = (convId?: string) => {
  if (!convId) return;
  const entry = entries.get(convId);
  if (!entry) return;
  entries.delete(convId);
  notify();
};

/**
 * 单轮结束后收尾：只清该任务的事件游标，保留块。
 *
 * 为什么不清块：终态到达时数据库**未必**已经写完这一轮的全部投影，
 * 若立刻清空，`AgentChat` 下一次拉取的会话可能还没有内容，界面就会短暂空白。
 * 块由 `realtimeBlocks` 与历史逐块比对去重，重复内容不会渲染两次；
 * 真正的清理发生在进入下一轮（beginSessionStream）或会话切换时。
 */
export const finishTaskStream = (convId?: string, taskId?: string) => {
  if (!convId || !taskId) return;
  const entry = entries.get(convId);
  if (!entry) return;
  // 该任务不再接收新事件（去重表保留，避免重连补发把已结束的块再加回来）。
  const seen = entry.cursors.get(taskId);
  if (seen) seen.add(`${taskId}:__finished__`);
};

/**
 * 用后端任务状态同步内存流的 status（刷新 / 切换会话时使用）。
 *
 * 为什么需要：增量事件（含 task.started / task.waiting）只走 WS 广播，
 * 刷新页面后这些事件已经错过，仓库里只有默认值 `created`，
 * 实时区就会一直显示 "Starting / Waiting for output…"。
 * 进入会话时按任务真实状态补齐，UI 才能正确显示 Running / Waiting permission。
 *
 * 只做「单调前进」：已经通过实时事件走到终态时不会被旧快照回退。
 */
export const syncSessionStreamStatus = (convId: string, taskStatus?: string) => {
  if (!convId || !taskStatus) return;

  // 后端 TaskStatus → 前端流状态（与 STATUS_TEXT 对应）。
  const next =
    taskStatus === "waiting_permission"
      ? "waiting"
      : taskStatus === "completed"
        ? "task.completed"
        : taskStatus === "failed"
          ? "task.failed"
          : taskStatus === "canceled"
            ? "task.canceled"
            : taskStatus === "running"
              ? "running"
              : "created";

  const entry = ensureEntry(convId);
  const merged = mergeStatus(entry.state.status, next);
  if (merged === entry.state.status) {
    // 状态没变但可能是首次建桶（例如刷新后直接进入会话，需要让订阅者拿到最新快照）。
    flushNow(entry);
    return;
  }
  entry.state.status = merged;
  flushNow(entry);
};

/** 是否还有未结束的轮次（供页面判断要不要显示「运行中」）。 */
export const isSessionStreamRunning = (convId?: string): boolean => {
  if (!convId) return false;
  const status = entries.get(convId)?.state.status;
  return status === "created" || status === "running" || status === "waiting";
};

/**
 * 订阅某个会话的内存流。
 *
 * 快照缓存必须**按订阅者独立**：`cachedVersion` 全局共享时，第一个组件消费完
 * 版本号后，第二个组件（或会话切换后的同一组件）会命中旧缓存，拿到别处的快照，
 * 表现为「流式内容不更新」。因此这里用 useRef 持有每个实例自己的缓存。
 *
 * `getSnapshot` 只在「版本号变化」或「会话切换」时重建对象，其余情况返回同一引用，
 * useSyncExternalStore 据此跳过无变化的重渲染。
 */
export const useSessionStream = (convId?: string): SessionStreamState => {
  const cacheRef = useRef<{ version: number; convId?: string; state: SessionStreamState }>({
    version: -1,
    convId,
    state: EMPTY_STATE,
  });

  const getSnapshot = (): SessionStreamState => {
    const cache = cacheRef.current;
    const nextVersion = getVersion();
    // 版本没变且会话没变：复用同一引用（避免无限重渲染）。
    if (cache.version === nextVersion && cache.convId === convId) {
      return cache.state;
    }
    cache.version = nextVersion;
    cache.convId = convId;
    cache.state = snapshot(convId ? entries.get(convId) : undefined);
    return cache.state;
  };

  return useSyncExternalStore(subscribeAll, getSnapshot, getSnapshot);
};

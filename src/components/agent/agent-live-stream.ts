import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEventItem, AgentSessionLive } from "@/api/agent";

/**
 * 当前会话页的实时流（纯组件级状态，不跨页面保留）。
 *
 * 职责只有三件事：
 *   1) 把 WS 的 `stream` 事件折叠成块列表；
 *   2) 进入会话时用后端下发的「未落库尾巴」快照补齐（刷新 / 中途进入不丢内容）；
 *   3) 把块列表交给聊天组件与历史消息拼在同一个列表里渲染。
 *
 * 页面卸载即丢弃：已落库的内容由历史接口恢复，未落库的部分由后端快照补上。
 */

/** 一条流式块（reasoning / assistant / tool_call / ...），形状与历史消息一致。 */
export interface StreamBlock {
  /** 稳定 key：WS 事件 id，或后端快照给的段 ID。 */
  key: string;
  kind: string;
  content: string;
  data?: unknown;
  taskId?: string;
  /** 是否仍在追加（渲染层据此展示光标 / streaming 标记）。 */
  streaming?: boolean;
  error?: boolean;
}

/** 快照水位线：同一任务下，seq ≤ 该值的推送都已被快照包含。 */
interface Watermark {
  taskId?: string;
  seq: number;
}

/** token 级事件合并到 ~60ms 一批，避免每个 token 都触发一次 Markdown 重渲染。 */
const FLUSH_INTERVAL_MS = 60;

const resultKindOf = (kind: string): string => (kind === "skill_result" ? "skill_call" : "tool_call");

const eventKey = (ev: AgentEventItem) =>
  ev.id ?? `${ev.task_id}:${ev.type}:${ev.created_at ?? ""}`;

/** 追加到最后一条仍在流式的同类型块；没有则新起一块。 */
const appendStreaming = (
  blocks: StreamBlock[],
  taskId: string,
  key: string,
  kind: string,
  delta: string,
): StreamBlock[] => {
  if (!delta) return blocks;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind !== kind || !block.streaming) continue;
    // 不同任务的增量不合并：避免上一轮残留的流式块吞掉新一轮的开头。
    if (block.taskId && block.taskId !== taskId) continue;
    const next = blocks.slice();
    next[i] = { ...block, content: block.content + delta };
    return next;
  }
  return [...blocks, { key, kind, content: delta, streaming: true, taskId }];
};

/** 用完整块内容替换仍在追加的同类型块（`message` / `reasoning` 结束事件）。 */
const finalizeStreaming = (
  blocks: StreamBlock[],
  taskId: string,
  key: string,
  kind: string,
  content: string,
  data?: unknown,
): StreamBlock[] => {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind !== kind || !block.streaming) continue;
    if (block.taskId && block.taskId !== taskId) continue;
    const next = blocks.slice();
    next[i] = {
      ...block,
      streaming: false,
      ...(content ? { content } : null),
      ...(data !== undefined ? { data } : null),
    };
    return next;
  }
  if (!content && data === undefined) return blocks;
  return [...blocks, { key, kind, content: content || "", data, streaming: false, taskId }];
};

/**
 * 把工具结果并入对应的调用块（而不是单独成行）。
 *
 * 配不上调用时返回 undefined：孤立的结果没有可读信息（正文在调用详情里），
 * 直接丢弃，避免出现「Tool Result」气泡。刷新后历史已含调用、实时只剩结果的
 * 情况也算配不上，由历史接口在下次加载时补全。
 */
const attachToolResult = (
  blocks: StreamBlock[],
  kind: string,
  content: string,
  data: unknown,
): StreamBlock[] | undefined => {
  const callKind = resultKindOf(kind);
  const resultData = (data ?? {}) as Record<string, unknown>;
  const callId = typeof resultData.tool_call_id === "string" ? resultData.tool_call_id : "";

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.kind !== callKind) continue;
    const callData = (block.data ?? {}) as Record<string, unknown>;
    if (callData.result !== undefined) continue;
    const matchesId = !!callId && callData.id === callId;
    const matchesName = !callId && callData.name === resultData.name;
    if (!matchesId && !matchesName) continue;

    const next = blocks.slice();
    next[i] = {
      ...block,
      data: {
        ...callData,
        result: { content, is_error: !!resultData.is_error, metadata: resultData.metadata },
      },
    };
    return next;
  }
  return undefined;
};

/** 关闭所有仍在追加的块（`done` 事件）。 */
const closeStreaming = (blocks: StreamBlock[]): StreamBlock[] => {
  let changed = false;
  const next = blocks.map((block) => {
    if (!block.streaming) return block;
    changed = true;
    return { ...block, streaming: false };
  });
  return changed ? next : blocks;
};

/** 把一条 `stream` 事件折叠进块列表；无变化时返回原数组，避免无意义重渲染。 */
export const applyStreamEvent = (blocks: StreamBlock[], ev: AgentEventItem): StreamBlock[] => {
  const payload = (ev.payload ?? {}) as Record<string, unknown>;
  const pType = typeof payload.type === "string" ? payload.type : "";
  const content = typeof payload.content === "string" ? payload.content : "";
  const key = eventKey(ev);
  const taskId = ev.task_id;

  switch (pType) {
    case "text":
      return appendStreaming(blocks, taskId, key, "assistant", content);
    case "reasoning_delta":
      return appendStreaming(blocks, taskId, key, "reasoning", content);
    case "message": {
      const data = (payload.data ?? {}) as Record<string, unknown>;
      const text = typeof data.content === "string" ? data.content : "";
      const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : [];
      let next = blocks;
      toolCalls.forEach((tc, index) => {
        next = [
          ...next,
          { key: `${key}#tc${index}`, kind: "tool_call", content: "", data: tc, streaming: false, taskId },
        ];
      });
      if (text) next = finalizeStreaming(next, taskId, key, "assistant", text, payload.data);
      return next;
    }
    case "reasoning": {
      const data = (payload.data ?? {}) as Record<string, unknown>;
      const text = typeof data.content === "string" ? data.content : "";
      return finalizeStreaming(blocks, taskId, key, "reasoning", text, payload.data);
    }
    case "tool_call":
    case "skill_call":
      return [...blocks, { key, kind: pType, content, data: payload.data, streaming: false, taskId }];
    case "tool_result":
    case "skill_result": {
      const resultData = (payload.data ?? {}) as Record<string, unknown>;
      const resultContent =
        typeof resultData.content === "string" ? resultData.content : content;
      // 能配对本轮调用就并入调用行；配不上时保留为独立块——
      // 中途进入的客户端手里没有调用行，结果需要靠它回填历史里的那一行。
      return (
        attachToolResult(blocks, pType, resultContent, payload.data) ?? [
          ...blocks,
          { key, kind: pType, content: resultContent, data: payload.data, streaming: false, taskId },
        ]
      );
    }
    case "error": {
      const data = (payload.data ?? {}) as Record<string, unknown>;
      const text = content || (typeof data.error === "string" ? data.error : "") || "Stream error";
      return [...blocks, { key, kind: "assistant", content: text, error: true, streaming: false, taskId }];
    }
    case "done":
      return closeStreaming(blocks);
    default:
      return blocks;
  }
};

/**
 * 当前会话页的实时块状态。
 *
 * - `enqueue`：接收 WS 事件，按事件 id / 快照水位线去重后进入 60ms 批量队列；
 * - `applySnapshot`：应用后端下发的「未落库尾巴」，并从此刻起丢弃已被它包含的推送；
 * - `reset`：新一轮 / 切换会话 / 新建会话时清空；
 * - `finishTask`：本轮结束且历史已回填后清空，并忽略该任务的迟到事件。
 */
export const useLiveStream = () => {
  const [blocks, setBlocks] = useState<StreamBlock[]>([]);
  const pendingRef = useRef<AgentEventItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 事件 id 去重：WS 重连补发同一条事件时不会把内容追加两次。
  const seenRef = useRef<Set<string>>(new Set());
  // 已结束的任务：终态之后补发的增量一律忽略。
  const finishedTaskRef = useRef<string | undefined>(undefined);
  // 快照水位线：seq ≤ 水位线的推送已被快照包含，直接丢弃。
  const markRef = useRef<Watermark>({ seq: 0 });
  // 是否已经拿到过快照：没有快照前只排队、不渲染，避免"先画半段再被快照覆盖"。
  const readyRef = useRef(false);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!readyRef.current || pendingRef.current.length === 0) return;
    const mark = markRef.current;
    const events = pendingRef.current.filter(
      (ev) => !(mark.taskId === ev.task_id && (ev.seq ?? 0) <= mark.seq),
    );
    pendingRef.current = [];
    if (events.length === 0) return;
    setBlocks((prev) => events.reduce(applyStreamEvent, prev));
  }, []);

  const enqueue = useCallback(
    (ev: AgentEventItem) => {
      if (!ev || ev.type !== "stream" || !ev.payload) return;
      const key = eventKey(ev);
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      if (finishedTaskRef.current && ev.task_id === finishedTaskRef.current) return;

      pendingRef.current.push(ev);
      if (timerRef.current !== null) return;
      timerRef.current = setTimeout(flush, FLUSH_INTERVAL_MS);
    },
    [flush],
  );

  /**
   * 应用后端快照：用「未落库的尾巴」替换当前仍在追加的块。
   *
   * 保留已经关闭的块（已落库、但历史可能还没拉回来的内容）；打开中的段整体以快照为准
   * （快照必然包含它们到此为止的全部内容）。拿到快照后，队列里 seq 不大于快照的增量
   * 会被丢弃，其余的继续追加——因此即使增量先于快照到达也不会重复或丢字。
   */
  const applySnapshot = useCallback(
    (live?: AgentSessionLive) => {
      const incoming = live?.blocks ?? [];
      if (live) markRef.current = { taskId: live.task_id, seq: live.seq ?? 0 };
      readyRef.current = true;
      const opened = incoming.map<StreamBlock>((block) => ({
        key: block.id,
        kind: block.kind,
        content: block.content,
        taskId: block.task_id,
        streaming: !!block.streaming,
      }));
      setBlocks((prev) => {
        const closed = prev.filter((block) => !block.streaming);
        if (closed.length === 0 && opened.length === 0) return prev;
        return [...closed, ...opened];
      });
      flush();
    },
    [flush],
  );

  /** 拿不到快照时（订阅失败）也要放行队列，否则实时流会一直不显示。 */
  const start = useCallback(() => {
    readyRef.current = true;
    flush();
  }, [flush]);

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = [];
    seenRef.current.clear();
    finishedTaskRef.current = undefined;
    markRef.current = { seq: 0 };
    readyRef.current = false;
    setBlocks((prev) => (prev.length === 0 ? prev : []));
  }, []);

  const finishTask = useCallback((taskId?: string) => {
    if (taskId) finishedTaskRef.current = taskId;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = [];
    setBlocks((prev) => (prev.length === 0 ? prev : []));
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return { blocks, enqueue, applySnapshot, start, reset, finishTask };
};

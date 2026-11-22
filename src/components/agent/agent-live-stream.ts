import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEventItem } from "@/api/agent";

/**
 * 当前会话页的实时流（纯组件级状态，不跨页面保留）。
 *
 * 职责只有两件事：
 *   1) 把 WS 的 `stream` 事件折叠成块列表；
 *   2) 把块列表交给聊天组件与历史消息拼在同一个列表里渲染。
 *
 * 页面卸载即丢弃。离开页面期间未落库的增量本来也收不到（服务端会按会话退订），
 * 这部分由后端补齐后经历史接口恢复，UI 不做跨页面缓存与去重。
 */

/** 一条流式块（reasoning / assistant / tool_call / ...），形状与历史消息一致。 */
export interface StreamBlock {
  /** 稳定 key：WS 事件 id，或由事件 id + 序号拼出。 */
  key: string;
  kind: string;
  content: string;
  data?: unknown;
  taskId?: string;
  /** 是否仍在追加（渲染层据此展示光标 / streaming 标记）。 */
  streaming?: boolean;
  error?: boolean;
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
      return attachToolResult(blocks, pType, resultContent, payload.data) ?? blocks;
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
 * - `enqueue`：接收 WS 事件，按事件 id 去重后进入 60ms 批量队列；
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

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current.length === 0) return;
    const events = pendingRef.current;
    pendingRef.current = [];
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

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = [];
    seenRef.current.clear();
    finishedTaskRef.current = undefined;
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

  return { blocks, enqueue, reset, finishTask };
};

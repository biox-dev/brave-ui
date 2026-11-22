import type { StreamBlock } from "./agent-session-stream";

/**
 * 实时流与历史消息的去重规则（纯函数）。
 *
 * 两条数据源结构不同：
 *   - 历史（agent_messages）把 tool_call / tool_result 拆成两条消息；
 *   - 实时流（WS 完整块）会把 tool_result 内联进调用块的 `data.result`。
 *
 * 文本块两侧都使用 kind = assistant（实时块由 text / message 事件合成）。
 *
 * 因此只能按身份匹配，不能按下标比较。这里只依赖消息的最少字段，
 * 方便独立验证，也避免把规则散落在聊天组件里。
 */

/** 去重只关心这些字段，与 agent-chat 的 ChatMessage 结构兼容。 */
export interface DedupeMessage {
  content: string;
  kind?: string;
  data?: unknown;
  taskId?: string;
  error?: boolean;
}

/** 某个任务已经落库的内容索引。 */
export interface TaskHistoryCoverage {
  /** 已落库的 tool_call id。 */
  callIds: Set<string>;
  /** 已落库的 tool_result 对应的 tool_call id。 */
  resultCallIds: Set<string>;
  /** 缺 call id 的 tool_result：name + content → 次数。 */
  resultsByKey: Map<string, number>;
  /** 文本 / 推理块：归一化 kind + content → 次数。 */
  texts: Map<string, number>;
  /** 错误消息正文 → 次数。 */
  errors: Map<string, number>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const isCallKind = (kind?: string) => kind === "tool_call" || kind === "skill_call";
const isResultKind = (kind?: string) => kind === "tool_result" || kind === "skill_result";

const coverageKey = (kind: string, content: string) => `${kind}\u0000${content}`;

const bumpCount = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) ?? 0) + 1);
};

const takeCount = (map: Map<string, number>, key: string): boolean => {
  const count = map.get(key) ?? 0;
  if (count <= 0) return false;
  map.set(key, count - 1);
  return true;
};

/** 按 task_id 汇总历史里已经落库的块，供实时区裁剪重复内容。 */
export const buildTaskCoverage = (
  messages: readonly DedupeMessage[],
): Map<string, TaskHistoryCoverage> => {
  const coverageByTask = new Map<string, TaskHistoryCoverage>();

  messages.forEach((message) => {
    const taskId = message.taskId;
    if (!taskId) return;

    let coverage = coverageByTask.get(taskId);
    if (!coverage) {
      coverage = {
        callIds: new Set(),
        resultCallIds: new Set(),
        resultsByKey: new Map(),
        texts: new Map(),
        errors: new Map(),
      };
      coverageByTask.set(taskId, coverage);
    }

    const data = asRecord(message.data);
    if (message.error || message.kind === "error") {
      bumpCount(coverage.errors, message.content ?? "");
      return;
    }
    if (isCallKind(message.kind)) {
      const callId = typeof data?.id === "string" ? data.id : "";
      if (callId) coverage.callIds.add(callId);
      return;
    }
    if (isResultKind(message.kind)) {
      const callId = typeof data?.tool_call_id === "string" ? data.tool_call_id : "";
      if (callId) {
        coverage.resultCallIds.add(callId);
        return;
      }
      const name = typeof data?.name === "string" ? data.name : "";
      const content = typeof data?.content === "string" ? data.content : message.content ?? "";
      bumpCount(coverage.resultsByKey, coverageKey(name, content));
      return;
    }
    bumpCount(coverage.texts, coverageKey(message.kind ?? "", message.content ?? ""));
  });

  return coverageByTask;
};

/**
 * 判断一个实时块是否「已经被历史完整覆盖」，可以不再渲染。
 *
 * - tool_call：按 call id；若实时块已内联结果，历史里必须也有该调用的结果；
 * - tool_result：按 tool_call_id（缺 id 时按 name + content）；
 * - 文本 / 推理 / 错误：按归一化 kind + content 计数匹配。
 *
 * 注意：文本类的 `takeCount` 会消耗计数，调用方应按顺序对前缀逐个判断，
 * 匹配失败立即停止，避免把后面的块误判为已覆盖。
 */
export const isBlockCoveredByHistory = (
  block: StreamBlock,
  coverage: TaskHistoryCoverage,
): boolean => {
  const data = asRecord(block.data);

  if (isCallKind(block.kind)) {
    const callId = typeof data?.id === "string" ? data.id : "";
    if (!callId || !coverage.callIds.has(callId)) return false;
    // 结果已内联时必须确认历史里也有结果：否则裁掉实时块会把 output 一起丢掉。
    const hasInlineResult = !!asRecord(data?.result);
    return !hasInlineResult || coverage.resultCallIds.has(callId);
  }

  if (isResultKind(block.kind)) {
    const callId = typeof data?.tool_call_id === "string" ? data.tool_call_id : "";
    if (callId) return coverage.resultCallIds.has(callId);
    const name = typeof data?.name === "string" ? data.name : "";
    return takeCount(coverage.resultsByKey, coverageKey(name, block.content ?? ""));
  }

  if (block.error) {
    return takeCount(coverage.errors, block.content ?? "");
  }

  return takeCount(coverage.texts, coverageKey(block.kind, block.content ?? ""));
};

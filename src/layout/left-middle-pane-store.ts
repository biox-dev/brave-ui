/**
 * 左侧「二级面板」（leftMiddle）请求通道（纯内存）。
 *
 * 左侧栏里的列表页（例如项目报告）选中一行后，需要把详情渲染到列表右侧。
 * 面板本身由布局层的 `SplitWorkspace` 提供（leftMiddle 槽位）；列表页只负责
 * 声明「当前要展示哪个视图 + 参数」，从而把「布局能力」和「具体页面」解耦：
 *
 * - 布局层订阅本 store，用 `ViewResolver` 渲染 `view + params`；
 * - 任意左侧列表页调用 `openLeftMiddlePane(...)` 即可复用同一块面板；
 * - 组件卸载时（如切换活动栏图标）自动关闭，避免残留上一个页面的详情。
 *
 * 不保存 ReactNode：只保存视图名与参数，渲染由布局层完成，
 * 这样面板内组件的状态、hooks 和刷新逻辑都在 React 正常渲染流程里。
 */
export type LeftMiddlePaneRequest = {
  /** 注册在 `ViewRegistry` 里的视图名。 */
  view: string;
  /** 视图参数（如 `{ reportId }`）。 */
  params?: Record<string, unknown>;
};

let pane: LeftMiddlePaneRequest | null = null;
const listeners = new Set<() => void>();

/** 参数浅比较：内容相同就不触发布局重渲染。 */
const sameParams = (
  left?: Record<string, unknown>,
  right?: Record<string, unknown>,
): boolean => {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
};

const commit = (next: LeftMiddlePaneRequest | null) => {
  if (
    pane === next ||
    (pane &&
      next &&
      pane.view === next.view &&
      sameParams(pane.params, next.params))
  ) {
    return;
  }
  pane = next;
  listeners.forEach((listener) => listener());
};

/** 订阅面板请求变化，返回取消订阅函数（配合 `useSyncExternalStore` 使用）。 */
export const subscribeLeftMiddlePane = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 当前面板请求快照（引用稳定：内容变化时才更换对象）。 */
export const getLeftMiddlePane = (): LeftMiddlePaneRequest | null => pane;

/** 打开（或更新）左侧二级面板。 */
export const openLeftMiddlePane = (request: LeftMiddlePaneRequest): void => {
  commit({ view: request.view, params: request.params });
};

/**
 * 关闭左侧二级面板。
 * 传入 `ownerView` 时只关闭「自己打开」的面板，避免误关其他页面的内容。
 */
export const closeLeftMiddlePane = (ownerView?: string): void => {
  if (!pane) {
    return;
  }
  if (ownerView && pane.view !== ownerView) {
    return;
  }
  commit(null);
};

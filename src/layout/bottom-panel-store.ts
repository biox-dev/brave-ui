import { create } from 'zustand';
import { updateBottomPanelApi, type UserBottomPanel } from '@/api/auth';

/**
 * 主区域底部面板（终端 / 日志 …）的共享状态。
 *
 * 数据流与主区域标签页（MainTabs）保持一致：
 * - 唯一数据源是后端 `users.menu_config.bottom`，`/auth/me` 返回后由 `hydrateBottomPanel` 回填；
 * - 之后的每次打开 / 关闭 / 切换 / 拖动高度都先更新本地状态（乐观更新），
 *   再由 `scheduleSave` 防抖异步落库，不阻塞 UI、失败也不打扰用户；
 * - 刷新即从接口重建，不做 localStorage 缓存，避免本地与后端不一致。
 *
 * 这里用 zustand 而不是 React state：左侧栏列表（container-template-list）需要在任意位置
 * 打开底部标签，而面板本身渲染在布局层，中间隔着几层组件，用 props 传递会污染一大片。
 */

/** 底部面板的一个标签页。`kind` 决定用哪个渲染器，`params` 是该渲染器的入参。 */
export type BottomTab = {
  key: string;
  kind: string;
  title?: string;
  params?: Record<string, unknown>;
};

type BottomPanelStore = {
  /** 已打开的标签，顺序即标签栏顺序。 */
  tabs: BottomTab[];
  /** 当前激活标签的 key（'' = 没有激活标签）。 */
  active: string;
  /** 是否展开。收起时只保留标签栏，面板内容保持挂载（终端连接不会断）。 */
  open: boolean;
  /** 展开时的高度（px）。 */
  height: number;
  /** `/auth/me` 是否已回填过：未回填前任何变更都不落库，避免用空列表覆盖后端。 */
  hydrated: boolean;
};

export const MIN_BOTTOM_PANEL_HEIGHT = 120;
export const MAX_BOTTOM_PANEL_HEIGHT = 800;
export const DEFAULT_BOTTOM_PANEL_HEIGHT = 320;
/** 与后端 `types.MaxUserBottomTabs` 保持一致。 */
export const MAX_BOTTOM_TABS = 8;
/** 落库防抖窗口：连续开关标签 / 拖动高度只提交最后一次。 */
const SAVE_DELAY = 800;

const clampHeight = (height?: number): number => {
  if (!Number.isFinite(height) || !height) {
    return DEFAULT_BOTTOM_PANEL_HEIGHT;
  }
  return Math.min(MAX_BOTTOM_PANEL_HEIGHT, Math.max(MIN_BOTTOM_PANEL_HEIGHT, Math.round(height)));
};

export const useBottomPanelStore = create<BottomPanelStore>(() => ({
  tabs: [],
  active: '',
  open: false,
  height: DEFAULT_BOTTOM_PANEL_HEIGHT,
  hydrated: false,
}));

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 防抖落库：调用方不 await、不提示、不驱动 loading（失败下次变更会整份重发）。 */
const scheduleSave = () => {
  const state = useBottomPanelStore.getState();
  if (!state.hydrated) {
    return;
  }
  const payload: UserBottomPanel = {
    open: state.open,
    active: state.active,
    height: state.height,
    tabs: state.tabs.map((tab) => ({
      key: tab.key,
      kind: tab.kind,
      title: tab.title ?? '',
      params: tab.params,
    })),
  };
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    updateBottomPanelApi(payload).catch(() => {
      // 忽略：底部面板属体验性数据，不打扰用户
    });
  }, SAVE_DELAY);
};

let hydratedUserId: string | null = null;

/**
 * 用 `/auth/me` 返回的 `menu_config.bottom` 回填一次。
 *
 * 与 MainTabs 的坑一致：从未保存过时后端返回 `menu_config: {}`（Bottom 为 undefined），
 * 因此回填只看「用户 ID 是否变化」，不能因为 bottom 为空就跳过，否则永远不会 hydrate，
 * 后续变更也会被 `hydrated` 门控挡住、一次都不落库。
 */
export const hydrateBottomPanel = (
  userId: string | null | undefined,
  panel?: UserBottomPanel | null,
) => {
  if (!userId || hydratedUserId === userId) {
    return;
  }
  hydratedUserId = userId;

  const serverTabs: BottomTab[] = (panel?.tabs ?? [])
    .filter((tab) => Boolean(tab && tab.key?.trim() && tab.kind?.trim()))
    .map((tab) => ({
      key: tab.key.trim(),
      kind: tab.kind.trim(),
      title: (tab.title ?? '').trim(),
      params: tab.params,
    }));
  // 兼容回填前就打开过标签的情况（/auth/me 返回前点了列表项）：本地标签排在后面并去重。
  const local = useBottomPanelStore.getState();
  const merged = [...serverTabs];
  local.tabs.forEach((tab) => {
    if (!merged.some((item) => item.key === tab.key)) {
      merged.push(tab);
    }
  });
  const tabs = merged.slice(-MAX_BOTTOM_TABS);

  const preferredActive = local.active || panel?.active || '';
  const active = tabs.some((tab) => tab.key === preferredActive)
    ? preferredActive
    : tabs[0]?.key ?? '';

  useBottomPanelStore.setState({
    tabs,
    active,
    open: local.tabs.length > 0 ? local.open : panel?.open ?? tabs.length > 0,
    height: clampHeight(panel?.height),
    hydrated: true,
  });

  if (local.tabs.length > 0) {
    // 回填前就打开过标签：合并结果需要补一次落库（这些标签后端还不知道）。
    scheduleSave();
  }
};

/** 打开（或聚焦）一个底部标签。已存在则只更新标题 / 参数并激活。 */
export const openBottomTab = (tab: BottomTab) => {
  const state = useBottomPanelStore.getState();
  const exists = state.tabs.some((item) => item.key === tab.key);
  const tabs = exists
    ? state.tabs.map((item) => (item.key === tab.key ? { ...item, ...tab } : item))
    : [...state.tabs, tab].slice(-MAX_BOTTOM_TABS);
  useBottomPanelStore.setState({ tabs, active: tab.key, open: true });
  scheduleSave();
};

/**
 * 打开容器模板临时终端。
 *
 * key 用 `terminal:<templateId>`：同一模板重复点击只会聚焦已有标签，
 * 不会重复创建容器终端（后端每次 WebSocket 连接都会新建一个临时容器）。
 */
export const openBottomTerminal = (templateId: string | number, name?: string) => {
  const id = String(templateId);
  if (!id) {
    return;
  }
  const title = (name ?? '').trim() || `Terminal ${id}`;
  openBottomTab({
    key: `terminal:${id}`,
    kind: 'terminal',
    title,
    params: { template_id: id },
  });
};

export const setActiveBottomTab = (key: string) => {
  const state = useBottomPanelStore.getState();
  if (!key || state.active === key) {
    return;
  }
  useBottomPanelStore.setState({ active: key, open: true });
  scheduleSave();
};

export const closeBottomTab = (key: string) => {
  const state = useBottomPanelStore.getState();
  const index = state.tabs.findIndex((tab) => tab.key === key);
  if (index < 0) {
    return;
  }
  const tabs = state.tabs.filter((tab) => tab.key !== key);
  // 关闭当前标签：优先切到右侧相邻标签，没有则切到左侧，全部关闭后收起面板。
  const active =
    state.active === key ? tabs[index]?.key ?? tabs[index - 1]?.key ?? '' : state.active;
  useBottomPanelStore.setState({
    tabs,
    active,
    open: tabs.length > 0 ? state.open : false,
  });
  scheduleSave();
};

export const setBottomPanelOpen = (open: boolean) => {
  const state = useBottomPanelStore.getState();
  if (state.open === open) {
    return;
  }
  useBottomPanelStore.setState({ open });
  scheduleSave();
};

export const setBottomPanelHeight = (height: number) => {
  const next = clampHeight(height);
  const state = useBottomPanelStore.getState();
  if (state.height === next) {
    return;
  }
  useBottomPanelStore.setState({ height: next });
  scheduleSave();
};

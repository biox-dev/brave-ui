import { create } from 'zustand';
import { updateBottomPanelApi, type UserBottomPanel } from '@/api/auth';

/**
 * 主区域底部面板（终端 / 日志 …）的共享状态。
 *
 * 数据流与主区域标签页（MainTabs）保持一致：
 * - 唯一数据源是后端 `user_project.menu_config.bottom`（当前激活项目），`/auth/me` 返回后由 `hydrateBottomPanel` 回填；
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

/**
 * 丢弃尚未发出的底部面板保存请求。
 *
 * 与 `cancelPendingMenuTabsSave` 同理：菜单配置写入「服务端当前激活项目」，
 * 切项目必须在 activate 之前调用，避免旧项目的面板状态被写到新项目。
 */
export const cancelPendingBottomPanelSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
};

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

/**
 * 已回填过的 `userId::projectId`。
 * 菜单配置是项目维度的：切换激活项目后需要按新项目重新回填。
 */
let hydratedKey: string | null = null;

/**
 * 用 `/auth/me` 返回的 `menu_config.bottom` 回填。
 *
 * 与 MainTabs 的坑一致：从未保存过时后端返回 `menu_config: {}`（Bottom 为 undefined），
 * 因此回填只看「用户 + 项目」是否变化，不能因为 bottom 为空就跳过，否则永远不会 hydrate，
 * 后续变更也会被 `hydrated` 门控挡住、一次都不落库。
 *
 * 首次回填（登录 / 刷新）会把回填前已打开的本地标签合并进来；
 * 切换项目后的回填直接整体替换，避免把上一个项目的标签写到新项目。
 */
export const hydrateBottomPanel = (
  userId: string | null | undefined,
  projectId: string | null | undefined,
  panel?: UserBottomPanel | null,
) => {
  const key = `${userId ?? ''}::${projectId ?? ''}`;
  if (!userId || hydratedKey === key) {
    return;
  }
  const isFirstHydration = hydratedKey === null;
  hydratedKey = key;

  // 切换项目：丢弃上一个项目尚未落库的防抖请求，避免写入新项目。
  if (!isFirstHydration && saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const serverTabs: BottomTab[] = (panel?.tabs ?? [])
    .filter((tab) => Boolean(tab && tab.key?.trim() && tab.kind?.trim()))
    .map((tab) => ({
      key: tab.key.trim(),
      kind: tab.kind.trim(),
      title: (tab.title ?? '').trim(),
      params: tab.params,
    }));
  // 首次回填时兼容「回填前就打开过标签」的情况（/auth/me 返回前点了列表项）：
  // 本地标签排在后面并去重；切换项目时不做合并。
  const local = useBottomPanelStore.getState();
  const tabs = (
    isFirstHydration
      ? [
          ...serverTabs,
          ...local.tabs.filter((tab) => !serverTabs.some((item) => item.key === tab.key)),
        ]
      : serverTabs
  ).slice(-MAX_BOTTOM_TABS);

  const preferredActive = (isFirstHydration ? local.active : '') || panel?.active || '';
  const active = tabs.some((tab) => tab.key === preferredActive)
    ? preferredActive
    : tabs[0]?.key ?? '';

  useBottomPanelStore.setState({
    tabs,
    active,
    open:
      isFirstHydration && local.tabs.length > 0
        ? local.open
        : panel?.open ?? tabs.length > 0,
    height: clampHeight(panel?.height),
    hydrated: true,
  });

  if (isFirstHydration && local.tabs.length > 0) {
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
 * 打开容器模板终端会话。
 *
 * key 用 `terminal:<sessionId>`：终端会话由后端 create 接口创建（容器已启动），
 * 这里只是按会话 ID 打开（或聚焦）对应的底部标签；同一会话重复点击不会重复连接。
 *
 * 连接地址只取决于 `session_id`，不需要也不保存模板 ID。
 */
export const openBottomTerminal = (
  sessionId: string | number,
  name?: string,
) => {
  const id = String(sessionId);
  if (!id) {
    return;
  }
  const title = (name ?? '').trim() || `Terminal ${id}`;
  openBottomTab({
    key: `terminal:${id}`,
    kind: 'terminal',
    title,
    params: { session_id: id },
  });
};

/**
 * 激活一个底部标签；点击（含点击当前标签）始终确保面板展开。
 *
 * 面板收起时标签栏仍可见，此时点击标签应当先展开面板 —— 所以
 * 只有「已经是当前标签且已展开」才视为无变化。
 */
export const setActiveBottomTab = (key: string) => {
  const state = useBottomPanelStore.getState();
  if (!key || (state.active === key && state.open)) {
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
  // 注意：这里只关闭前端标签，不调用 DELETE。
  // 终端会话是「持久会话」，断开 WebSocket 不会回收容器；显式释放（关闭 shell + 删除容器）
  // 只能由左侧栏「终端会话」列表的删除按钮触发（它显式调用 closeContainerTerminalSessionApi），
  // 否则关闭标签就会误删仍在使用的容器。
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

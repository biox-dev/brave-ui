import { normalizeMainTabPath } from './main-tab-title';

/**
 * 主区域标签页「显示名称」通道（统一格式）。
 *
 * 约定：任何组件/页面都可以用 `toMainTabKey(pathname + search)` 得到标签页 key，
 * 再用 `setMainTabTitle(key, 可读名称)` 登记名称。MainTabs 渲染标签时优先使用
 * 这里登记的名称，只有没登记时才回退到 `resolveMainTabTitle` 的静态规则。
 *
 * 名称保存在模块级 Map 中，并同步到 sessionStorage（刷新后仍能显示，会话结束失效）。
 * 组件卸载或标签页关闭时应调用 `clearMainTabTitle` 清理，避免残留旧名称。
 * React 侧的封装见 `@/hooks/useMainTabTitle`。
 */
export type MainTabTitleMap = Record<string, string>;

const STORAGE_KEY = 'mainTabTitles';

/**
 * 把 pathname 或完整路径（含 query/hash）统一成标签页 key。
 * 规则必须与 MainTabs 内部使用的 key 一致：`normalizeMainTabPath(pathname) + search`。
 */
export const toMainTabKey = (pathOrUrl: string): string => {
  const hashIndex = pathOrUrl.indexOf('#');
  const withoutHash = hashIndex >= 0 ? pathOrUrl.slice(0, hashIndex) : pathOrUrl;
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  return `${normalizeMainTabPath(pathname)}${search}`;
};

const readStoredTitles = (): MainTabTitleMap => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && entry[1].trim() !== '',
      ),
    );
  } catch {
    return {};
  }
};

let titles: MainTabTitleMap = readStoredTitles();
const listeners = new Set<() => void>();

const persist = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (Object.keys(titles).length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
    }
  } catch {
    // 忽略存储失败（隐私模式 / 配额不足）
  }
};

const commit = (next: MainTabTitleMap) => {
  titles = next;
  persist();
  listeners.forEach((listener) => listener());
};

/** 订阅名称表变化，返回取消订阅函数。 */
export const subscribeMainTabTitles = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 当前名称表快照（引用稳定：只有内容变化时才更换对象）。 */
export const getMainTabTitles = (): MainTabTitleMap => titles;

/** 读取某个标签页登记的名称；未登记时返回 undefined。 */
export const getMainTabTitle = (key: string): string | undefined => {
  const tabKey = toMainTabKey(key);
  return titles[tabKey];
};

/** 登记标签页名称；传入空值等价于清除。 */
export const setMainTabTitle = (key: string, title?: string | null): void => {
  const tabKey = toMainTabKey(key);
  const next = (title ?? '').trim();
  if (!next) {
    clearMainTabTitle(tabKey);
    return;
  }
  if (titles[tabKey] === next) {
    return;
  }
  commit({ ...titles, [tabKey]: next });
};

/** 清除标签页登记的名称，回退到静态标题规则。 */
export const clearMainTabTitle = (key: string): void => {
  const tabKey = toMainTabKey(key);
  if (!(tabKey in titles)) {
    return;
  }
  const next = { ...titles };
  delete next[tabKey];
  commit(next);
};

/** 清除名称表中所有已不存在的标签页（MainTabs 启动时清理历史残留）。 */
export const pruneMainTabTitles = (validKeys: string[]): void => {
  const valid = new Set(validKeys.map((key) => toMainTabKey(key)));
  const next = Object.fromEntries(
    Object.entries(titles).filter(([key]) => valid.has(key)),
  );
  if (Object.keys(next).length === Object.keys(titles).length) {
    return;
  }
  commit(next);
};

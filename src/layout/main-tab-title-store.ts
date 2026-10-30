import { normalizeMainTabPath } from './main-tab-title';

/**
 * 主区域标签页「显示名称」通道（纯内存）。
 *
 * 标签页列表（顺序 + url + 名称）的唯一数据源是后端 `users.menu_config`：
 * MainTabs 在 `/auth/me` 返回时用 `seedMainTabTitles` 回填一次，之后页面可以用
 * `setMainTabTitle(key, 可读名称)` 登记运行期的名字（如节点名）。
 * 渲染时优先用这里登记的名称，没登记才回退 `resolveMainTabTitle` 的静态规则。
 *
 * 不做任何本地存储：刷新即从接口重建，避免本地缓存与后端不一致。
 * React 侧的封装见 `@/hooks/useMainTabTitle`。
 */
export type MainTabTitleMap = Record<string, string>;

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

let titles: MainTabTitleMap = {};
const listeners = new Set<() => void>();

/** 提交新名称表：换引用并通知订阅者。 */
const commit = (next: MainTabTitleMap) => {
  titles = next;
  listeners.forEach((listener) => listener());
};

/** 订阅名称表变化，返回取消订阅函数（配合 `useSyncExternalStore` 使用）。 */
export const subscribeMainTabTitles = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 当前名称表快照（引用稳定：只有内容变化时才更换对象）。 */
export const getMainTabTitles = (): MainTabTitleMap => titles;

/**
 * 登记标签页名称：`setMainTabTitle(path, '节点 A')`。
 * 传空值（'' / null / undefined）等价于清除，标签页回退到 `resolveMainTabTitle` 的静态规则。
 */
export const setMainTabTitle = (key: string, title?: string | null): void => {
  const tabKey = toMainTabKey(key);
  const next = (title ?? '').trim();
  if ((titles[tabKey] ?? '') === next) {
    return; // 值没变化，跳过：避免无意义的重渲染与落库
  }
  const draft = { ...titles };
  if (next) {
    draft[tabKey] = next;
  } else {
    delete draft[tabKey];
  }
  commit(draft);
};

/** 清除标签页登记的名称，回退到静态标题规则（等价于 `setMainTabTitle(key, null)`）。 */
export const clearMainTabTitle = (key: string): void => setMainTabTitle(key, null);

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

/**
 * 用后端保存的标签页列表回填名称表。
 *
 * MainTabs 拿到 `/auth/me` 返回的 `user.menu_config.tabs` 后调用一次：标签名在页面数据加载前
 * 就能显示正确，不会先闪静态名称。空标题的项直接跳过（回退到 `resolveMainTabTitle`）。
 */
export const seedMainTabTitles = (tabs: Array<{ url: string; title?: string }>): void => {
  const next = { ...titles };
  let changed = false;
  tabs.forEach((tab) => {
    const key = toMainTabKey(tab.url);
    const value = (tab.title ?? '').trim();
    if (!value || next[key] === value) {
      return;
    }
    next[key] = value;
    changed = true;
  });
  if (changed) {
    commit(next);
  }
};

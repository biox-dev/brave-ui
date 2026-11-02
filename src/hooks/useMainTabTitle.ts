import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  getMainTabTitles,
  setMainTabTitle,
  subscribeMainTabTitles,
  toMainTabKey,
  type MainTabTitleMap,
} from '@/layout/main-tab-title-store';

/** 订阅所有标签页登记的名称（MainTabs 用它渲染标签文案）。 */
export const useMainTabTitles = (): MainTabTitleMap =>
  useSyncExternalStore(subscribeMainTabTitles, getMainTabTitles, getMainTabTitles);

/**
 * 实体名称字段的默认取值顺序：详情接口字段名不统一（name / node_name / script_path …），
 * 这里给一套常见顺序，绝大多数页面直接传实体即可，无需再写 `a || b || c`。
 */
export const TAB_TITLE_FIELDS = [
  'name',
  'node_name',
  'title',
  'workflow_path',
  'script_path',
  'component_id',
  'label',
] as const;

/**
 * 从实体对象里按 `fields` 的顺序取第一个非空字符串作为标签页名称。
 * 只接受字符串：id 之类的数值字段不应该被当成标题。
 */
export const resolveMainTabEntityTitle = (
  entity: unknown,
  fields: readonly string[] = TAB_TITLE_FIELDS,
): string | undefined => {
  if (!entity || typeof entity !== 'object') {
    return undefined;
  }
  const record = entity as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

/** 取 pathname 的最后一段并解码，得到「路由里的实体 id」。 */
const routeIdFromPathname = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '');
  const index = trimmed.lastIndexOf('/');
  const segment = index >= 0 ? trimmed.slice(index + 1) : trimmed;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export type RouteMainTabTitleOptions = {
  /** 关闭登记（例如页面标题由上层控制）。不要用 `if` 包住 hook 调用，用这个开关。 */
  enabled?: boolean;
  /** 名称字段优先级，默认 `TAB_TITLE_FIELDS`。 */
  fields?: readonly string[];
  /** 实体上的 id 字段名，默认 `id`。 */
  idField?: string;
  /** 显式指定路由 id；默认取 pathname 最后一段。 */
  routeId?: string;
};

/**
 * 详情页一行登记标签页名称：`useRouteMainTabTitle(script)`。
 *
 * 相比手写 `useMainTabTitle(entity?.name)`，它内部做了两件容易忘、忘了就出 bug 的事：
 * 1. 只登记「属于当前路由」的数据：实体 id 必须等于路由里的 id（pathname 最后一段）。
 *    路由只变参数时组件不会重新挂载，旧数据会残留一帧，不加判断会把上一个实体的名字
 *    写到新标签页上（表现为「先闪一下旧名称」）。
 * 2. 统一标题取值规则，避免各页面各写一套 `name || xxx || id`。
 *
 * 无 id 的路由（列表页）不会登记；弹窗/抽屉里复用的详情组件也不会误改写当前标签页。
 */
export const useRouteMainTabTitle = (
  entity: unknown,
  options: RouteMainTabTitleOptions = {},
): void => {
  const { enabled = true, fields, idField = 'id', routeId } = options;
  const { pathname, search } = useLocation();
  const key = toMainTabKey(`${pathname}${search}`);
  const expectedId = routeId ?? routeIdFromPathname(pathname);
  const record = (entity ?? {}) as Record<string, unknown>;
  const entityId = record[idField];
  const matches = entityId != null && String(entityId) !== '' && String(entityId) === expectedId;
  const value = matches ? (resolveMainTabEntityTitle(entity, fields) ?? '') : '';

  useEffect(() => {
    if (!enabled || !value) {
      return;
    }
    setMainTabTitle(key, value);
  }, [key, value, enabled]);
};

/**
 * 列表页一行跳转 + 提前登记标签页名称：
 *
 * ```ts
 * const openMainTab = useOpenMainTab();
 * openMainTab(`/c/scripts/${id}`, script);      // 传实体：按 TAB_TITLE_FIELDS 取名
 * openMainTab(`/c/scripts/${id}`, 'My Script'); // 传字符串：直接作为标题
 * openMainTab(`/c/scripts/${id}`);              // 不登记：由目标页自己登记
 * ```
 *
 * 列表侧只是「提前」登记：目标页的 `useRouteMainTabTitle` 在数据加载后会用真实名称覆盖，
 * 所以这里传什么都不影响最终正确性，只影响首次渲染时有没有名称闪现。
 */
export const useOpenMainTab = (): ((
  path: string,
  titleOrEntity?: unknown,
  fields?: readonly string[],
) => void) => {
  const navigate = useNavigate();
  return useCallback(
    (path: string, titleOrEntity?: unknown, fields?: readonly string[]) => {
      const title =
        typeof titleOrEntity === 'string'
          ? titleOrEntity.trim()
          : resolveMainTabEntityTitle(titleOrEntity, fields);
      if (title) {
        setMainTabTitle(path, title);
      }
      navigate(path);
    },
    [navigate],
  );
};

/**
 * 把页面自己的可读名称登记为「当前路由」对应标签页的标题。
 *
 * 用法：在页面组件里 `useMainTabTitle(nodeName)`，数据就绪后标签页自动改名。
 * 名称与标签页（路由 key）绑定，组件卸载后仍然保留，直到标签页被关闭；
 * 不传名称时不登记，标签页沿用已登记的名称，没有则回退到 `resolveMainTabTitle`。
 *
 * 注意：名称必须来自「属于当前路由」的数据。路由只变参数时（如
 * `/analsyis-node-report/:id`）组件实例会被复用，旧数据在切换后的首帧仍然存在，
 * 直接登记就会先把上一个标签页的名称写到新标签上（表现为「先闪一下旧名称」）。
 * 这类页面请按 id 过滤后再传：
 * `useMainTabTitle(node?.id === routeId ? node.node_name : undefined)`。
 *
 * 需要按条件开关时用第二个参数 `enabled`（不要在调用处写 `if (...)`，hook 不能条件调用）：
 * `useMainTabTitle(name, useTitle)`
 *
 * 大多数页面不需要直接用它：
 * - 详情页用 `useRouteMainTabTitle(entity)`（自动做路由 id 校验 + 标题取值）；
 * - 列表页用 `useOpenMainTab()`（跳转 + 登记一步完成）。
 */
export const useMainTabTitle = (title?: string | null, enabled = true): void => {
  const { pathname, search } = useLocation();
  const key = toMainTabKey(`${pathname}${search}`);
  const value = (title ?? '').trim();

  useEffect(() => {
    if (!enabled || !value) {
      return;
    }
    setMainTabTitle(key, value);
  }, [key, value, enabled]);
};

import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
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
 */
export const useMainTabTitle = (title?: string | null): void => {
  const { pathname, search } = useLocation();
  const key = toMainTabKey(`${pathname}${search}`);
  const value = (title ?? '').trim();

  useEffect(() => {
    if (!value) {
      return;
    }
    setMainTabTitle(key, value);
  }, [key, value]);
};

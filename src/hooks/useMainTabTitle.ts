import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import {
  getMainTabTitles,
  setMainTabTitle,
  subscribeMainTabTitles,
  toMainTabKey,
  type MainTabTitleMap,
} from '@/layout/main-tab-title-store';

/** 订阅所有标签页登记的名称（MainTabs 用它渲染标签文案）。 */
export const useMainTabTitles = (): MainTabTitleMap => {
  const [titles, setTitles] = useState<MainTabTitleMap>(getMainTabTitles);

  useEffect(() => {
    // 首帧可能错过了订阅前的更新，挂载时同步一次
    setTitles(getMainTabTitles());
    return subscribeMainTabTitles(() => setTitles(getMainTabTitles()));
  }, []);

  return titles;
};

/**
 * 页面把自己的名称登记为「当前路由」对应的标签页标题。
 *
 * 用法：在页面组件里 `useMainTabTitle(nodeName)`，数据就绪后标签页自动改名。
 * 名称与标签页（路由 key）绑定，组件卸载后仍然保留，直到标签页被关闭；
 * 不传名称时不登记，标签页回退到 `resolveMainTabTitle` 的默认规则。
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

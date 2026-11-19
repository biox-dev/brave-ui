import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  closeLeftMiddlePane,
  getLeftMiddlePane,
  openLeftMiddlePane,
  subscribeLeftMiddlePane,
  type LeftMiddlePaneRequest,
} from '@/layout/left-middle-pane-store';

/** 订阅左侧二级面板当前内容（布局层用它渲染 `SplitWorkspace` 的 leftMiddle）。 */
export const useLeftMiddlePaneState = (): LeftMiddlePaneRequest | null =>
  useSyncExternalStore(
    subscribeLeftMiddlePane,
    getLeftMiddlePane,
    getLeftMiddlePane,
  );

/**
 * 左侧列表页声明「选中项详情」占用 leftMiddle 面板。
 *
 * `params` 为 `null` 时表示当前没有选中项（关闭面板）。参数按 JSON 内容比较：
 * 调用方即使每次渲染新建对象，也不会反复触发打开 / 关闭。
 * 组件卸载时自动关闭自己打开的面板，切换到其他活动栏视图不会残留旧内容。
 */
export const useLeftMiddlePane = (
  view: string,
  params: Record<string, unknown> | null,
): void => {
  const paramsKey = useMemo(() => (params ? JSON.stringify(params) : null), [params]);

  useEffect(() => {
    if (!paramsKey) {
      closeLeftMiddlePane(view);
      return;
    }
    openLeftMiddlePane({
      view,
      params: JSON.parse(paramsKey) as Record<string, unknown>,
    });
    return () => closeLeftMiddlePane(view);
  }, [view, paramsKey]);
};

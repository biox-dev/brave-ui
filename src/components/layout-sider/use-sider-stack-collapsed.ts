import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserItem } from '@/store/userSlice';

const EMPTY_COLLAPSED_KEYS: string[] = [];

/**
 * 读取 / 写入某个左侧栏堆叠视图的折叠状态。
 *
 * 状态存在 redux `user.leftStackCollapsed`（同时同步到 localStorage），
 * 因此切换左侧面板或刷新浏览器后折叠状态都不会丢失。
 *
 * 返回 `[collapsedKeys, setCollapsedKeys]`，直接接到 `SiderStackLayout` 的受控 props 上。
 */
export const useSiderStackCollapsed = (stackKey: string) => {
  const dispatch = useDispatch();
  const collapsedMap = useSelector(
    (state: any) => state?.user?.leftStackCollapsed,
  ) as Record<string, string[]> | undefined;

  const collapsedKeys = collapsedMap?.[stackKey] ?? EMPTY_COLLAPSED_KEYS;

  const setCollapsedKeys = useCallback(
    (keys: string[]) => {
      dispatch(
        setUserItem({
          leftStackCollapsed: {
            ...(collapsedMap ?? {}),
            [stackKey]: keys,
          },
        }),
      );
    },
    [collapsedMap, dispatch, stackKey],
  );

  return [collapsedKeys, setCollapsedKeys] as const;
};

export default useSiderStackCollapsed;

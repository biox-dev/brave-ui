import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserItem } from '@/store/userSlice';

/**
 * 读取 / 写入某个左侧栏堆叠视图的分区显示状态。
 *
 * 状态存在 redux `user.leftStackVisibleSections`（同时同步到 localStorage），
 * 因此切换面板或刷新浏览器后，各分区的显示 / 隐藏状态都不会丢失。
 *
 * 语义区分：
 * - 没有该 stack 的配置 → 回退到 `defaultKeys`（默认全部显示）；
 * - 配置为 `[]` → 用户显式取消了全部分区，表示整个堆叠面板不显示。
 *
 * 返回 `[visibleKeys, setVisibleKeys]`，可直接用于渲染分区列表。
 */
export const useSiderStackVisible = (
  stackKey: string,
  defaultKeys: readonly string[],
) => {
  const dispatch = useDispatch();
  const visibleMap = useSelector(
    (state: any) => state?.user?.leftStackVisibleSections,
  ) as Record<string, string[]> | undefined;

  const configured = Boolean(
    visibleMap && Object.prototype.hasOwnProperty.call(visibleMap, stackKey),
  );
  const visibleKeys: readonly string[] = configured
    ? visibleMap![stackKey]
    : defaultKeys;

  const setVisibleKeys = useCallback(
    (keys: string[]) => {
      dispatch(
        setUserItem({
          leftStackVisibleSections: {
            ...(visibleMap ?? {}),
            [stackKey]: keys,
          },
        }),
      );
    },
    [visibleMap, dispatch, stackKey],
  );

  return [visibleKeys, setVisibleKeys] as const;
};

export default useSiderStackVisible;

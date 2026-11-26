import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setUserItem, type DatasetPathInfo } from '@/store/userSlice';

const EMPTY_DATASET_PATH: DatasetPathInfo | null = null;

/**
 * 读取 / 写入数据集浏览器当前所在路径（进入的数据集）。
 *
 * 状态存在 redux `user.datasetPath`（reducer 内同步 localStorage），
 * 与 `useSiderStackCollapsed` 同一套路：刷新浏览器、切换左侧面板后再回来
 * 仍停在上次的数据集里；多实例（左侧面板 + 路由页）读到的是同一份值。
 *
 * 返回 `[datasetPath, setDatasetPath]`，`setDatasetPath(null)` 表示回到数据集列表。
 */
export const useDatasetProjectPath = () => {
  const dispatch = useDispatch();
  const datasetPath = useSelector(
    (state: any) => state?.user?.datasetPath,
  ) as DatasetPathInfo | null | undefined;

  const setDatasetPath = useCallback(
    (next: DatasetPathInfo | null | undefined) => {
      dispatch(setUserItem({ datasetPath: next ?? null }));
    },
    [dispatch],
  );

  return [datasetPath ?? EMPTY_DATASET_PATH, setDatasetPath] as const;
};

export default useDatasetProjectPath;

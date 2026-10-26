import FileListPage, { type FileListPageProps } from "./file-list-page";

/**
 * 数据集文件（用户上传）面板。
 *
 * 与 `analysis-node-file-page` 合并为同一实现：这里只固定 `source="dataset"`，
 * 具体 UI/逻辑见 `file-list-page.tsx`。保留该模块是为了兼容既有引用：
 * - 路由 `/dataset-file`、`/dataset-file/:id`
 * - 视图键 `datasetFilePage`（`invoke.datasetFilePage.openDrawerAsync(...)`）
 */
export type DatasetFilePageProps = Omit<FileListPageProps, "source">;

const DatasetFilePage = (props: DatasetFilePageProps) => (
  <FileListPage {...props} source="dataset" />
);

export default DatasetFilePage;

import FileListPage, { type FileListPageProps } from "./file-list-page";

/**
 * 分析节点产出文件面板。
 *
 * 与 `dataset-file-page` 合并为同一实现：这里只固定 `source="analysisNode"`，
 * 具体 UI/逻辑见 `file-list-page.tsx`。保留该模块是为了兼容既有的视图键
 * `analysisNodeFilePage`（`invoke.analysisNodeFilePage.openDrawerAsync(...)`）。
 */
export type AnalysisNodeFilePageProps = Omit<FileListPageProps, "source">;

const AnalysisNodeFilePage = (props: AnalysisNodeFilePageProps) => (
  <FileListPage {...props} source="analysisNode" />
);

export default AnalysisNodeFilePage;

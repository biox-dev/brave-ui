import { useMemo, useState } from "react";
import { Segmented } from "antd";
import FileListPage, { type FileListPageProps, type FileListSource } from "./file-list-page";

export type ProjectFilePageProps = Omit<FileListPageProps, "source" | "subHeader">;

/**
 * 项目文件面板：把「用户上传（数据集文件）」与「分析结果（分析节点产出文件）」合并为一个视图。
 *
 * 两个视图复用同一个 `FileListPage` 组件，差别只在底层调用的接口。
 * 布局：顶部操作区（由 FileListPage 渲染）→ 视图切换（本组件注入的 `subHeader`）→ 列表。
 * 切换视图后分页 / 缓存 / 选中态都会重置。
 */
const ProjectFilePage = (props: ProjectFilePageProps) => {
  const [source, setSource] = useState<FileListSource>("dataset");

  const switcher = useMemo(
    () => (
      <Segmented
        block
        size="small"
        value={source}
        options={[
          { label: "User uploads", value: "dataset" },
          { label: "Analysis Result", value: "analysisNode" },
        ]}
        onChange={(value) => setSource(value as FileListSource)}
      />
    ),
    [source]
  );

  return <FileListPage {...props} source={source} subHeader={switcher} />;
};

export default ProjectFilePage;

import { FC } from "react";
import { MonacoEditor } from "../react-monaco-editor";

// ProjectReportFileEditor 用于编辑报告自身文件（工作目录下的 output.md）。
// 这是一个受控组件：内容由父级 state 持有，编辑时通过 onChange 回传最新文本。
const ProjectReportFileEditor: FC<any> = ({ content, onChange }) => {
  return (
    <MonacoEditor
      value={content ?? ""}
      defaultLanguage="markdown"
      onChange={(value: string) => onChange?.(value ?? "")}
    />
  );
};

export default ProjectReportFileEditor;

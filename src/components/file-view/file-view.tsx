import { FC } from "react";
import FilePreviewPanel from "./file-preview-panel";

export interface FileViewProps {
	/** go_file 主键 id。 */
	file_id?: string;
}

/**
 * Agent 会话页右侧标签 / 弹窗使用的文件视图。
 * 具体的拉取与渲染逻辑在 `FilePreviewPanel`，与路由页共用一份实现。
 */
const FileView: FC<FileViewProps> = ({ file_id }) => <FilePreviewPanel fileId={file_id} />;

export default FileView;

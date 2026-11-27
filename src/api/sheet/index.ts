import { http } from "@/api/client/http";

/** go_file 的核心字段，随文件预览响应一起返回。 */
export interface PreviewFileInfo {
	id: string;
	file_name: string;
	path: string;
	format: string;
	size: number;
	md5: string;
	storage: string;
	description: string;
	analysis_node_id: string;
	role: string;
	created_at: string;
	updated_at: string;
}

/**
 * 预览类型：
 * - table：返回分隔文本，由前端解析成表格（csv/tsv，xlsx 由后端转 TSV）；
 * - text：返回原始文本（fasta/gff/md/json/...）；
 * - binary：无法在线预览（gz/rds/bam/...）；
 * - tree：path 是目录，`tree` 返回目录树，由前端渲染文件树。
 */
export type FilePreviewKind = "table" | "text" | "binary" | "tree";

/** 目录预览的树节点（kind = tree）。 */
export interface FilePreviewTreeNode {
	/** 条目名（仅文件名/目录名）。 */
	name: string;
	/** 相对被预览目录的斜杠路径，例如 "/sub/file.txt"。 */
	path: string;
	is_dir: boolean;
	/** 仅文件有大小。 */
	size?: number;
	/** 修改时间（Unix 秒）。 */
	modified?: number;
	children?: FilePreviewTreeNode[];
	/** 目录的子项未完整展开（超出层级或数量上限）。 */
	truncated?: boolean;
}

export interface FilePreviewResponse {
	file_path: string;
	format: string;
	kind: FilePreviewKind;
	/** table 类型的分隔符，例如 "," 或 "\t"。 */
	delimiter?: string;
	content?: string;
	/** kind = tree 时的目录树。 */
	tree?: FilePreviewTreeNode[];
	truncated: boolean;
	/** 预览提示（如二进制格式不可预览、只显示第一个工作表等）。 */
	message?: string;
	file?: PreviewFileInfo;
}

export const previewFileByFileIDApi = (params: { id: string }) => {
	return http.get<FilePreviewResponse>("/file/preview", { params });
};


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
 * - binary：无法在线预览（gz/rds/bam/...）。
 */
export type FilePreviewKind = "table" | "text" | "binary";

export interface FilePreviewResponse {
	file_path: string;
	format: string;
	kind: FilePreviewKind;
	/** table 类型的分隔符，例如 "," 或 "\t"。 */
	delimiter?: string;
	content?: string;
	truncated: boolean;
	/** 预览提示（如二进制格式不可预览、只显示第一个工作表等）。 */
	message?: string;
	file?: PreviewFileInfo;
}

export const previewFileByFileIDApi = (params: { id: string }) => {
	return http.get<FilePreviewResponse>("/file/preview", { params });
};


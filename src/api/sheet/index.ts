import { http } from "@/api/client/http";

/** go_file 的核心字段，随按文件读取工作簿的响应一起返回。 */
export interface WorkbookFileInfo {
	id: string;
	file_id: string;
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

export interface ReadWorkbookByFileIDParams {
	file_id: string;
}

export interface ReadWorkbookResponse {
	file_path: string;
	format: string;
	workbook_data: Record<string, unknown>;
	// file 仅在按 file_id 读取时返回。
	file?: WorkbookFileInfo;
}

export interface WriteWorkbookByFileIDRequest {
	file_id: string;
	workbook_data: Record<string, unknown>;
}

export interface WriteWorkbookResponse {
	file_path: string;
	format: string;
}

export const readSheetWorkbookByFileIDApi = (params: ReadWorkbookByFileIDParams) => {
	return http.get<ReadWorkbookResponse>("/sheet/workbook/by-file-id", { params });
};

export const writeSheetWorkbookByFileIDApi = (payload: WriteWorkbookByFileIDRequest) => {
	return http.post<WriteWorkbookResponse>("/sheet/workbook/save/by-file-id", payload);
};

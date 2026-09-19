import { http } from "@/api/client/http";

/** GET /script/{scriptId}/content 的响应。 */
export interface ScriptContentResponse {
	/** 脚本主文件绝对路径。 */
	path: string;
	/** 脚本主文件内容。 */
	content: string;
}

/** POST /script/{scriptId}/content 的请求体。 */
export interface SaveScriptContentPayload {
	content: string;
	/** 可选：覆盖文件后 git 提交使用的 message，为空时后端使用默认文案。 */
	commit_message?: string;
}

/** 读取脚本主文件内容（scriptId 为脚本 int64 主键）。 */
export const getScriptContentApi = async (scriptId: string | number) => {
	const resp = await http.get<ScriptContentResponse>(`/script/${scriptId}/content`);
	return resp.data;
};

/** 覆盖写入脚本主文件内容，后端会同时重新生成 script.json 并提交 git 改动。 */
export const saveScriptContentApi = async (scriptId: string | number, payload: SaveScriptContentPayload) => {
	const resp = await http.post<{ path: string; message: string }>(`/script/${scriptId}/content`, payload);
	return resp.data;
};

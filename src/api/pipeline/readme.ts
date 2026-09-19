import { http } from "@/api/client/http";

/** GET /script/{scriptId}/readme 与 GET /workflow/{workflowId}/readme 的响应。 */
export interface ReadmeResponse {
	/** README.md 的绝对路径。 */
	path: string;
	/** README.md 原文；为空字符串表示该组件还没有 README.md。 */
	content: string;
}

/** POST /script/{scriptId}/readme 与 POST /workflow/{workflowId}/readme 的请求体。 */
export interface SaveReadmePayload {
	content: string;
	/** 可选：覆盖 README.md 后 git 提交使用的 message，为空时后端使用默认文案。 */
	commit_message?: string;
}

/** 读取脚本目录下的 README.md（scriptId 为脚本 int64 主键）。 */
export const getScriptReadmeApi = async (scriptId: string | number) => {
	const resp = await http.get<ReadmeResponse>(`/script/${scriptId}/readme`);
	return resp.data;
};

/** 覆盖写入脚本目录下的 README.md，后端会提交该目录的 git 改动。 */
export const saveScriptReadmeApi = async (scriptId: string | number, payload: SaveReadmePayload) => {
	const resp = await http.post<ReadmeResponse>(`/script/${scriptId}/readme`, payload);
	return resp.data;
};

/** 读取工作流目录下的 README.md（workflowId 为工作流 int64 主键）。 */
export const getWorkflowReadmeApi = async (workflowId: string | number) => {
	const resp = await http.get<ReadmeResponse>(`/workflow/${workflowId}/readme`);
	return resp.data;
};

/** 覆盖写入工作流目录下的 README.md，后端会提交该目录的 git 改动。 */
export const saveWorkflowReadmeApi = async (workflowId: string | number, payload: SaveReadmePayload) => {
	const resp = await http.post<ReadmeResponse>(`/workflow/${workflowId}/readme`, payload);
	return resp.data;
};

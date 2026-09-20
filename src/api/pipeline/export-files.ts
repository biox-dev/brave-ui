import { http } from "@/api/client/http";

/**
 * 「生成导出文件并提交」接口：
 *
 * - `POST /workflow/save-script-files`   → 生成 script.json 并提交脚本目录改动；
 * - `POST /workflow/save-workflow-files` → 生成 workflow.json（含脚本快照）并提交 workflow 目录改动。
 *
 * 后端保存组件（`/workflow/save-script`、`/workflow/save-workflow`）不再隐式生成导出文件、
 * 也不再隐式提交 git，因此这两个接口是「产生一个版本提交」的唯一显式入口，
 * commit message 可留空（后端使用默认文案）。
 */

/** 生成并提交接口的响应。 */
export interface SaveExportFilesResponse {
	/** 后端返回的结果提示。 */
	message: string;
	/** 脚本接口返回：script_id（uuid）。 */
	script_id?: string;
	/** 脚本接口返回：脚本目录绝对路径。 */
	script_path?: string;
	/** 工作流接口返回：workflow_id（uuid）。 */
	workflow_id?: string;
	/** 工作流接口返回：workflow 目录绝对路径。 */
	workflow_path?: string;
	/** 本次提交实际使用的 message（为空入参时为后端默认文案）。 */
	commit_message: string;
}

/** 生成 script.json 并把脚本目录改动提交为一个 commit（scriptId 为脚本 int64 主键）。 */
export const saveScriptFilesApi = async (scriptId: string | number, commitMessage?: string) => {
	const resp = await http.post<SaveExportFilesResponse>(`/workflow/save-script-files`, {
		script_id: String(scriptId),
		commit_message: commitMessage?.trim() || undefined,
	});
	return resp.data;
};

/** 生成 workflow.json（含脚本快照）并把 workflow 目录改动提交为一个 commit（workflowId 为工作流 int64 主键）。 */
export const saveWorkflowFilesApi = async (workflowId: string | number, commitMessage?: string) => {
	const resp = await http.post<SaveExportFilesResponse>(`/workflow/save-workflow-files`, {
		workflow_id: String(workflowId),
		commit_message: commitMessage?.trim() || undefined,
	});
	return resp.data;
};

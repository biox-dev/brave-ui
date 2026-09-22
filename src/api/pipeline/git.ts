import { http } from "@/api/client/http";

/**
 * 组件目录（script / workflow）的 git 视图：
 *
 * - `git_state` 由 `GetScriptById` / `GetWorkflowById` 返回，与后端 `utils.GitSyncState` 一一对应，
 *   完全由磁盘上的 git 元数据实时推导，不落库；
 * - `git-diff` 由 `GET /script/{id}/git-diff` / `GET /workflow/{id}/git-diff` 返回
 *   （后端 `handler.GitHandler`），本地有变化时才需要调用。
 */

/** 与后端 `utils.GitSyncState` 一一对应。 */
export interface GitSyncState {
	/** 本地脚本/工作流目录（工作区仓库）。 */
	local_dir?: string;
	/** 发布目标（store 裸仓库）目录。 */
	store_dir?: string;
	/** 本地目录是否已初始化为 git 仓库。 */
	local_initialized: boolean;
	/** store 是否已初始化（即是否发布过）。 */
	store_initialized: boolean;
	/** 本地 HEAD commit（尚无提交时为空）。 */
	local_commit?: string;
	/** store HEAD commit（未发布时为空）。 */
	store_commit?: string;
	/** 本地工作区存在未提交改动（含未跟踪文件）。 */
	local_dirty: boolean;
	/** 本地 HEAD 领先 store：有已提交但未发布的改动。 */
	local_ahead: boolean;
	/** store 领先本地：远端有本地没有的提交（需要 install 同步）。 */
	store_ahead: boolean;
	/** 本地有未发布改动 = local_dirty || local_ahead。 */
	has_local_changes: boolean;
	/** store 有本地未同步的提交 = store_ahead。 */
	has_store_changes: boolean;
	/** 本地干净且两侧 commit 一致。 */
	in_sync: boolean;
}

/** 后端 `utils.GitDiffFile` 的文件状态。 */
export type GitDiffFileStatus = "added" | "modified" | "deleted";

/** 与后端 `utils.GitDiffFile` 一一对应。 */
export interface GitDiffFile {
	path: string;
	status: GitDiffFileStatus;
	/** 二进制文件：只标记变化，不返回文本 diff。 */
	binary?: boolean;
	/** 文件过大：未读取内容，只按大小比较。 */
	omitted?: boolean;
	additions: number;
	deletions: number;
	/** 该文件的 unified diff 文本（---/+++ 头 + hunk，不含 `diff --git` 行）。 */
	diff?: string;
}

/** 与后端 `utils.GitDiffSection` 一一对应：一组「旧快照 -> 新快照」的 diff。 */
export interface GitDiffSection {
	/** 旧侧 commit（工作区改动时是本地 HEAD，未出生时为空）。 */
	base_commit?: string;
	/** 新侧 commit（工作区改动时为空：新侧是工作区文件）。 */
	target_commit?: string;
	has_changes: boolean;
	file_count: number;
	additions: number;
	deletions: number;
	/** 文件数或 patch 长度达到上限被截断。 */
	truncated: boolean;
	files: GitDiffFile[];
	/** 完整 unified diff 文本。 */
	patch: string;
}

/** `GET /script/{id}/git-diff`、`GET /workflow/{id}/git-diff` 的响应。 */
export interface GitDiffResponse {
	entity: "script" | "workflow";
	/** 组件 uuid（script.script_id / workflow.workflow_id）。 */
	id: string;
	/** 本地工作区仓库目录（绝对路径）。 */
	repo_dir: string;
	/** 本地目录是否已是 git 仓库；false 时没有可展示的 diff。 */
	initialized: boolean;
	/** 本地 HEAD commit（尚无提交时为空）。 */
	head_commit?: string;
	/** 本地是否有变化（未提交改动 或 已提交未发布）。 */
	has_changes: boolean;
	/** 工作区相对本地 HEAD 的未提交改动（含未跟踪文件）。 */
	worktree: GitDiffSection;
	/** 本地 HEAD 相对 store HEAD 的提交差异；两侧都有提交且不同时才有。 */
	unpublished?: GitDiffSection;
	/** 实时 git 同步状态（与详情接口的 git_state 一致）。 */
	git_state?: GitSyncState;
}

/** 读取脚本目录的本地变化 diff（scriptId 为脚本 int64 主键）。 */
export const getScriptGitDiffApi = async (scriptId: string | number) => {
	const resp = await http.get<GitDiffResponse>(`/script/${encodeURIComponent(String(scriptId))}/git-diff`, {
		skipGlobalError: true,
	});
	return resp.data;
};

/** 读取 workflow 目录的本地变化 diff（workflowId 为工作流 int64 主键）。 */
export const getWorkflowGitDiffApi = async (workflowId: string | number) => {
	const resp = await http.get<GitDiffResponse>(`/workflow/${encodeURIComponent(String(workflowId))}/git-diff`, {
		skipGlobalError: true,
	});
	return resp.data;
};

/** 按组件类型读取本地变化 diff。 */
export const getGitDiffApi = async (entity: "script" | "workflow", id: string | number) => {
	return entity === "script" ? getScriptGitDiffApi(id) : getWorkflowGitDiffApi(id);
};

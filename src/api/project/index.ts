import axios from "axios";
import { http } from "@/api/client/http";
import type { PageResponse } from "@/api/data";
import type { GitDiffSection } from "@/api/pipeline/git";

export interface ActiveProject {
	id: number;
	project_id: string;
	project_name: string;
	metadata_form: Array<{
		label: string;
		name: string;
	}>;
	research: string;
	parameter: string;
	description: string;
}

export interface ProjectItem {
	id: number;
	project_id: string;
	project_name: string;
	metadata_form: Array<{
		label: string;
		name: string;
	}>;
	research: string;
	parameter: string;
	description: string;
	share_code?: string;
	share_enabled?: boolean;
}

export interface DeleteUserProjectRequest {
	project_id: string;
}

export interface AddUserProjectRequest {
	share_code: string;
}

export interface CreateProjectRequest {
	project_name: string;
	metadata_form?: string;
	research?: string;
	parameter?: string;
	description?: string;
}

export interface UpdateProjectSharingRequest {
	project_id: string;
	enabled: boolean;
}

export interface UpdateProjectSharingResponse {
	share_enabled: boolean;
	share_code: string;
}

export interface ActivateProjectRequest {
	project_id: string;
}

export interface ActivateProjectResponse {
	message: string;
}

// ProjectReport 是报告容器，只承载标题等元信息；正文由其下的 ProjectReportItem 拼接而成。
export interface ProjectReport {
	id: string;
	project_id: string;
	title: string;
	created_at: string;
	updated_at: string;
}

// ProjectReportDetail 目前与 ProjectReport 字段一致，保留别名方便后续扩展。
export type ProjectReportDetail = ProjectReport;

// ProjectReportItemOwnerType 标识条目内容来源类型。custom 为自定义内容/章节占位条目。
export type ProjectReportItemOwnerType = "analysis" | "analysis_node" | "ai_summary" | "custom";

// ProjectReportItem 是报告下的一个内容条目。
export interface ProjectReportItem {
	id: string;
	project_report_id: string;
	parent_id: string;
	owner_type: ProjectReportItemOwnerType;
	owner_id: string;
	sort_order: number;
	title: string;
	content: string;
	created_at: string;
	updated_at: string;
}

// ProjectReportItemNode 是列表接口返回的树节点，携带同层子节点。
export interface ProjectReportItemNode extends ProjectReportItem {
	children?: ProjectReportItemNode[];
}

export interface AddProjectReportRequest {
	title: string;
}

export interface UpdateProjectReportRequest {
	id: string;
	title: string;
}

export interface DeleteProjectReportRequest {
	id: string;
}

export interface AddProjectReportItemRequest {
	project_report_id: string;
	parent_id?: string;
	owner_type: ProjectReportItemOwnerType;
	owner_id?: string;
	sort_order?: number;
	title?: string;
	content?: string;
}

export interface UpdateProjectReportItemRequest {
	id: string;
	parent_id?: string;
	owner_type?: ProjectReportItemOwnerType;
	owner_id?: string;
	sort_order?: number;
	title?: string;
	content?: string;
}

// ReorderProjectReportItemEntry 描述拖拽后单个条目的目标位置。
export interface ReorderProjectReportItemEntry {
	id: string;
	parent_id: string;
	sort_order: number;
}

export interface ReorderProjectReportItemRequest {
	report_id: string;
	items: ReorderProjectReportItemEntry[];
}

export interface DeleteProjectReportItemRequest {
	id: string;
}

export interface ProjectReportContentResponse {
	title: string;
	content: string;
}

export interface ProjectReportItemContentResponse {
	title: string;
	prefix: string;
	content: string;
	owner_type?: ProjectReportItemOwnerType;
}

// ProjectReportFileResponse 是报告自身文件（工作目录下的 output.md）的内容。
export interface ProjectReportFileResponse {
	report_id: string;
	filename: string;
	content: string;
}

// ProjectReportGitState 是报告工作目录的本地 git 状态（与后端 utils.ReportWorktreeGitState 一一对应）。
export interface ProjectReportGitState {
	/** 报告工作目录（绝对路径）。 */
	dir?: string;
	/** 本地 HEAD commit（尚无提交时为空）。 */
	commit?: string;
	/** 目录是否已有可用提交（HEAD 已出生）；false 时没有可对比的基线。 */
	initialized: boolean;
	/** 工作区是否有未提交改动（含未跟踪文件）。 */
	dirty: boolean;
}

// ProjectReportGitDiffResponse 是 `GET /project/project-report-git-diff` 的响应。
// 报告没有发布目标（store），因此只有「工作区改动」一段，字段命名与组件目录 diff 保持一致。
export interface ProjectReportGitDiffResponse {
	report_id: string;
	project_id: string;
	/** 报告工作目录（绝对路径）。 */
	repo_dir: string;
	/** 目录是否已是 git 仓库且有基线提交；false 时没有可展示的 diff。 */
	initialized: boolean;
	/** 本地 HEAD commit（尚无提交时为空）。 */
	head_commit?: string;
	/** 工作区是否有未提交改动。 */
	has_changes: boolean;
	/** 工作区相对本地 HEAD 的未提交改动（含未跟踪文件）。 */
	worktree: GitDiffSection;
	/** 实时本地 git 状态。 */
	git_state: ProjectReportGitState;
}

// ProjectReportCommitResponse 是 `POST /project/commit-project-report` 的响应。
export interface ProjectReportCommitResponse {
	report_id: string;
	project_id: string;
	/** 本次是否真的产生了新提交（工作区干净时为 false）。 */
	committed: boolean;
	/** 提交后的 HEAD commit。 */
	commit?: string;
	/** 本次提交实际使用的 message。 */
	commit_message: string;
}

// ProjectReportRevertFileResponse 是 `POST /project/revert-project-report-file` 的响应。
export interface ProjectReportRevertFileResponse {
	report_id: string;
	/** 被撤回的文件路径（相对报告目录）。 */
	path: string;
	reverted: boolean;
}

export interface ProjectReportPageQuery {
	// Reserved for future filters.
}

export interface ProjectReportPageRequest {
	page?: number;
	page_size?: number;
}

export interface UploadProjectReportImageResponse {
	url: string;
	name: string;
	size: number;
}

export const addProjectApi = (data: any) => axios.post("/project/add-project", data)
export const addUserProjectApi = (payload: AddUserProjectRequest) => http.post<{ message: string }>("/project/add-user-project", payload)
export const createProjectApi = (payload: CreateProjectRequest) => http.post<ProjectItem>("/project/create-project", payload)
export const updateProjectApi = (data: any) => axios.post("/project/update-project", data)
export const findProjectByIdApi = (project_id: string) => axios.get(`/project/find-by-project-id/${project_id}`)
export const listProjectApi = () => http.get<ProjectItem[]>("/project/list-project")
export const activateProjectApi = (payload: ActivateProjectRequest) => {
	return http.post<ActivateProjectResponse>("/project/activate-project", payload, {
		headers: {
			accept: "application/json",
		},
	});
}
export const deleteProjectApi = (project_id: string) => axios.delete(`/project/delete-project/${project_id}`)
export const deleteUserProjectApi = (payload: DeleteUserProjectRequest) => http.post<{ message: string }>("/project/delete-user-project", payload)
export const updateProjectSharingApi = (payload: UpdateProjectSharingRequest) => http.post<UpdateProjectSharingResponse>("/project/update-project-sharing", payload)
export const getActiveProjectApi = () => http.get<ActiveProject>("/project/active-project")
export const addProjectReportApi = (payload: AddProjectReportRequest) => http.post<ProjectReportDetail>("/project/add-project-report", payload)
export const updateProjectReportApi = (payload: UpdateProjectReportRequest) => http.post<{ message: string }>("/project/update-project-report", payload)
export const deleteProjectReportApi = (payload: DeleteProjectReportRequest) => http.post<{ message: string }>("/project/delete-project-report", payload)
export const listProjectReportApi = () => http.get<ProjectReport[]>(`/project/list-project-report`)
export const pageProjectReportApi = (payload: ProjectReportPageRequest) => http.post<PageResponse<ProjectReport>>("/project/list-project-report-page", payload)
export const getProjectReportDetailApi = (id: string) => http.get<ProjectReportDetail>(`/project/project-report-detail?id=${encodeURIComponent(id)}`)
export const getProjectReportContentApi = (reportId: string) =>
	http.get<ProjectReportContentResponse>(`/project/project-report-content?report_id=${encodeURIComponent(reportId)}`)

// getProjectReportFileApi 读取报告工作目录下的自身 markdown 文件（output.md）。
export const getProjectReportFileApi = (reportId: string) =>
	http.get<ProjectReportFileResponse>(`/project/project-report-file?report_id=${encodeURIComponent(reportId)}`)

// updateProjectReportFileApi 覆写报告工作目录下的自身 markdown 文件（output.md）。
export const updateProjectReportFileApi = (payload: { report_id: string; content: string }) =>
	http.post<{ message: string }>("/project/update-project-report-file", payload)

// getProjectReportGitDiffApi 读取报告工作目录的本地未提交改动。
export const getProjectReportGitDiffApi = async (reportId: string | number) => {
	const resp = await http.get<ProjectReportGitDiffResponse>(`/project/project-report-git-diff`, {
		params: { report_id: String(reportId) },
		skipGlobalError: true,
	})
	return resp.data
}

// commitProjectReportApi 把报告工作目录的所有改动提交为一个 commit（message 可留空）。
export const commitProjectReportApi = async (reportId: string | number, message?: string) => {
	const resp = await http.post<ProjectReportCommitResponse>("/project/commit-project-report", {
		report_id: String(reportId),
		message: message?.trim() || undefined,
	})
	return resp.data
}

// revertProjectReportFileApi 撤回报告目录里单个文件的未提交改动（恢复为本地 HEAD 版本）。
export const revertProjectReportFileApi = async (reportId: string | number, path: string) => {
	const resp = await http.post<ProjectReportRevertFileResponse>(
		"/project/revert-project-report-file",
		{ report_id: String(reportId), path },
		{ skipGlobalError: true },
	)
	return resp.data
}

// getProjectReportHtmlApi 返回报告聚合后的独立 HTML 文档字符串。
// inlineImages=true 时图片以 base64 内嵌（自包含），false 时保留原始 URL。
export const getProjectReportHtmlApi = (reportId: string, inlineImages = true) =>
	http.get<string>("/project/project-report-html", {
		params: { report_id: reportId, inline_images: inlineImages },
		responseType: "text",
	})

// getProjectReportFileHtmlApi 返回报告自身 markdown 文件（output.md）渲染的独立 HTML 文档字符串。
// inlineImages=true 时图片以 base64 内嵌（自包含），false 时保留原始 URL。
export const getProjectReportFileHtmlApi = (reportId: string, inlineImages = true) =>
	http.get<string>("/project/project-report-file-html", {
		params: { report_id: reportId, inline_images: inlineImages },
		responseType: "text",
	})

export const listProjectReportItemApi = (reportId: string) =>
	http.get<ProjectReportItemNode[]>(`/project/list-project-report-item?report_id=${encodeURIComponent(reportId)}`)
export const addProjectReportItemApi = (payload: AddProjectReportItemRequest) => http.post<ProjectReportItem>("/project/add-project-report-item", payload)
export const updateProjectReportItemApi = (payload: UpdateProjectReportItemRequest) => http.post<{ message: string }>("/project/update-project-report-item", payload)
export const reorderProjectReportItemApi = (payload: ReorderProjectReportItemRequest) => http.post<{ message: string }>("/project/reorder-project-report-item", payload)
export const deleteProjectReportItemApi = (payload: DeleteProjectReportItemRequest) => http.post<{ message: string }>("/project/delete-project-report-item", payload)
export const getProjectReportItemDetailApi = (id: string) =>
	http.get<ProjectReportItem>(`/project/project-report-item-detail?id=${encodeURIComponent(id)}`)
export const getProjectReportItemContentApi = (id: string) =>
	http.get<ProjectReportItemContentResponse>(`/project/project-report-item-content?id=${encodeURIComponent(id)}`)
export const uploadProjectReportImageApi = (file: File) => {
	const formData = new FormData()
	formData.append("file", file, file.name || "clipboard-image.png")
	return http.post<UploadProjectReportImageResponse>("/project/upload-image", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	})
}

// publishProjectReportItemToDocApi 按 ProjectReportItem 的 OwnerID 将内容发布到报告文档目录。
export const publishProjectReportItemToDocApi = (itemId: string) =>
	http.post<{ message: string }>(`/project-report-item/${encodeURIComponent(itemId)}/publish-to-doc`)

// publishProjectReportToDocApi 遍历报告下所有条目，逐个发布到报告文档目录。
export const publishProjectReportToDocApi = (reportId: string) =>
	http.post<{ message: string }>(`/project-report/${encodeURIComponent(reportId)}/publish-to-doc`)

// ---------- Literature (参考文献) ----------

export interface ProjectLiteratureItem {
	id: string;
	title: string;
	created_at: string;
	updated_at: string;
}

export interface ProjectLiteratureDetailItem extends ProjectLiteratureItem {
	content: string;
}

export interface ProjectLiteraturePoolItem extends ProjectLiteratureItem {
	bound?: boolean;
}

export interface AddLiteratureRequest {
	title: string;
	content?: string;
}

export interface UpdateLiteratureRequest {
	id: string;
	title: string;
	content?: string;
}

export interface DeleteLiteratureRequest {
	id: string;
}

export interface BindLiteratureRequest {
	literature_id: string;
}

export interface UnbindLiteratureRequest {
	literature_id: string;
}

export interface LiteraturePageRequest {
	page?: number;
	page_size?: number;
}

export const addLiteratureApi = (payload: AddLiteratureRequest) => http.post<ProjectLiteratureDetailItem>("/project/add-literature", payload)
export const updateLiteratureApi = (payload: UpdateLiteratureRequest) => http.post<{ message: string }>("/project/update-literature", payload)
export const deleteLiteratureApi = (payload: DeleteLiteratureRequest) => http.post<{ message: string }>("/project/delete-literature", payload)
export const getLiteratureDetailApi = (id: string) => http.get<ProjectLiteratureDetailItem>(`/project/literature-detail?id=${encodeURIComponent(id)}`)
export const listLiteratureApi = () => http.get<ProjectLiteratureItem[]>("/project/list-literature")
export const pageLiteratureApi = (payload: LiteraturePageRequest) => http.post<PageResponse<ProjectLiteratureItem>>("/project/list-literature-page", payload)
export const bindLiteratureApi = (payload: BindLiteratureRequest) => http.post<{ message: string }>("/project/bind-literature", payload)
export const unbindLiteratureApi = (payload: UnbindLiteratureRequest) => http.post<{ message: string }>("/project/unbind-literature", payload)
export const pageLiteraturePoolApi = (payload: LiteraturePageRequest) => http.post<PageResponse<ProjectLiteraturePoolItem>>("/project/list-literature-pool-page", payload)


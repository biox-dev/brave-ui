import axios from "axios";
import { http } from "@/api/client/http";
import type { PageResponse } from "@/api/data";

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

// ProjectReportItemOwnerType 标识条目内容来源类型。
export type ProjectReportItemOwnerType = "analysis" | "analysis_node" | "ai_summary";

// ProjectReportItem 是报告下的一个内容条目。
export interface ProjectReportItem {
	id: string;
	project_report_id: string;
	owner_type: ProjectReportItemOwnerType;
	owner_id: string;
	sort_order: number;
	title: string;
	created_at: string;
	updated_at: string;
}

export interface AddProjectReportRequest {
	project_id: string;
	title: string;
}

export interface UpdateProjectReportRequest {
	id: string;
	project_id: string;
	title: string;
}

export interface DeleteProjectReportRequest {
	id: string;
}

export interface AddProjectReportItemRequest {
	project_report_id: string;
	owner_type: ProjectReportItemOwnerType;
	owner_id?: string;
	sort_order?: number;
}

export interface UpdateProjectReportItemRequest {
	id: string;
	owner_type?: ProjectReportItemOwnerType;
	owner_id?: string;
	sort_order?: number;
}

export interface DeleteProjectReportItemRequest {
	id: string;
}

export interface ProjectReportContentResponse {
	report: ProjectReportDetail;
	items: ProjectReportItem[];
	content: string;
}

export interface ProjectReportItemContentResponse {
	item: ProjectReportItem;
	content: string;
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

export const listProjectReportItemApi = (reportId: string) =>
	http.get<ProjectReportItem[]>(`/project/list-project-report-item?report_id=${encodeURIComponent(reportId)}`)
export const addProjectReportItemApi = (payload: AddProjectReportItemRequest) => http.post<ProjectReportItem>("/project/add-project-report-item", payload)
export const updateProjectReportItemApi = (payload: UpdateProjectReportItemRequest) => http.post<{ message: string }>("/project/update-project-report-item", payload)
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

export const publishProjectReportToDocApi = (reportId: string) => http.post<{ message: string }>(`/project-report/${encodeURIComponent(reportId)}/publish-to-doc`)

// ---------- Literature (参考文献) ----------

export interface ProjectLiteratureItem {
	id: string;
	owner_project_id?: string;
	title: string;
	source?: string;
	filename?: string;
	created_at: string;
	updated_at: string;
}

export interface ProjectLiteratureDetailItem extends ProjectLiteratureItem {
	content: string;
	content_source?: string;
}

export interface ProjectLiteraturePoolItem extends ProjectLiteratureItem {
	bound?: boolean;
}

export interface AddLiteratureRequest {
	title: string;
	content?: string;
	content_source?: string;
	filename?: string;
}

export interface UpdateLiteratureRequest {
	id: string;
	title: string;
	content?: string;
	content_source?: string;
	filename?: string;
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


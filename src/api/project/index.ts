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

export interface ProjectReportItem {
	id: string;
	project_id: string;
	title: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
}

export interface ProjectReportDetailItem extends ProjectReportItem {
	content: string;
	content_source?: string;
	filename?: string;
}

export interface AddProjectReportRequest {
	project_id: string;
	title: string;
	content?: string;
	content_source?: string;
	filename?: string;
	sort_order?: number;
}

export interface UpdateProjectReportRequest {
	id: string;
	project_id: string;
	title: string;
	content?: string;
	content_source?: string;
	filename?: string;
	sort_order?: number;
}

export interface DeleteProjectReportRequest {
	id: string;
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
export const addProjectReportApi = (payload: AddProjectReportRequest) => http.post<ProjectReportDetailItem>("/project/add-project-report", payload)
export const updateProjectReportApi = (payload: UpdateProjectReportRequest) => http.post<{ message: string }>("/project/update-project-report", payload)
export const deleteProjectReportApi = (payload: DeleteProjectReportRequest) => http.post<{ message: string }>("/project/delete-project-report", payload)
export const listProjectReportApi = () => http.get<ProjectReportItem[]>(`/project/list-project-report`)
export const pageProjectReportApi = (payload: ProjectReportPageRequest) => http.post<PageResponse<ProjectReportItem>>("/project/list-project-report-page", payload)
export const getProjectReportDetailApi = (id: string) => http.get<ProjectReportDetailItem>(`/project/project-report-detail?id=${encodeURIComponent(id)}`)
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


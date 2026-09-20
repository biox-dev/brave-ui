import { http } from "@/api/client/http";
import type { PageResponse } from "@/api/data";

export interface GetWorkflowFormParams {
	workflowId: string;
	// projectId: string;
}

export interface WorkflowFormResponse {
	type: string;
	formJson: unknown[];
	analysis_result: Record<string, unknown>;
}

export const getWorkflowFormApi = (params: GetWorkflowFormParams) => {
	const { workflowId } = params;
	return http.get<WorkflowFormResponse>(
		`/workflow/${encodeURIComponent(workflowId)}/form`
	);
};

export const getScriptFormApi = (scriptId:any) =>{
	return http.get(`/script/${scriptId}/form`)
}

export interface ScriptItem {
	id: string;
	component_id: string;
	component_name: string;
	description?: string;
	script_type?: string;
	category?: string;
	install_key?: string;
	tags?: string;
	container_template_id?: string;
	created_at?: string;
	updated_at?: string;
}

export interface ScriptPageQuery {
	id?: string;
	ids?: string[];
	script_id?: string;
	component_name?: string;
	script_type?: string;
	category?: string;
	install_key?: string;
	tags?: string;
	keywords?: string;
	container_template_id?: string;
	sort_by?: string;
	sort_order?: "ASC" | "DESC";
}

export interface ScriptPageRequest {
	page?: number;
	page_size?: number;
	query?: ScriptPageQuery;
}

export const pageScriptApi = (payload: ScriptPageRequest) => {
	return http.post<PageResponse<ScriptItem>>("/workflow/page-script", payload);
};

export interface WorkflowItem {
	id: number;
	workflow_id: string;
	name: string;
	img?: string;
	tags?: string;
	url?: string;
	category?: string;
	description?: string;
	prompt?: string;
	dag_definition?: string;
	relation_type?: string;
	install_key?: string;
	component_id?: string;
	container_id?: string;
	parent_component_id?: string;
	input_component_ids?: string;
	output_component_ids?: string;
	order_index?: number;
	version?: string;
	update_info?: string;
	created_at?: string;
	updated_at?: string;
}

export interface WorkflowPageQuery {
	id?: number;
	ids?: number[];
	workflow_id?: string;
	name?: string;
	category?: string;
	install_key?: string;
	module_id?: string;
	relation_type?: string;
	tags?: string;
	keywords?: string;
	sort_by?: string;
	sort_order?: "ASC" | "DESC";
}

export interface WorkflowPageRequest {
	page?: number;
	page_size?: number;
	query?: WorkflowPageQuery;
}

export const pageWorkflowApi = (payload: WorkflowPageRequest) => {
	return http.post<PageResponse<WorkflowItem>>("/workflow/page-workflow", payload);
};
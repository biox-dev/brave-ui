import axios from "axios";
import { http } from "@/api/client/http";
import type { PageRequest, PageResponse } from "@/api/data";

export interface ContainerImageItem {
    id: string;
    name: string;
    tag: string;
    registry: string;
    namespace: string;
    full_name: string;
    digest: string;
    description: string;
    size: number;
    created_at: string;
    updated_at: string;
}

export interface ContainerMount {
    source: string;
    target: string;
    mode: string;
    type: string;
    owner: string;
}

export interface ContainerTemplateItem {
    id: string;
    name: string;
    description: string;
    type: string;
    image_id: string;
    command: string;
    cpu: number;
    memory: number;
    work_dir: string;
    env: Record<string, unknown> | null;
    mounts: ContainerMount[] | null;
    volumes: Record<string, unknown> | null;
    labels: Record<string, unknown> | null;
    change_uid: boolean;
    created_at: string;
    updated_at: string;
}

export interface ContainerImageExportItem {
    id: string;
    name: string;
    full_name: string;
    description: string;
    size: number;
    pull_policy: string;
}

export interface ContainerTemplateExportItem {
    id: string;
    name: string;
    description: string;
    image: ContainerImageExportItem;
    command: string;
    cpu: number;
    memory: number;
    work_dir: string;
    port: number;
    app_type: string;
    env: Record<string, unknown> | null;
    mounts: ContainerMount[] | null;
    volumes: Record<string, unknown> | null;
    scheduling_constraint: Record<string, unknown> | null;
    labels: Record<string, unknown> | null;
    change_uid: boolean;
    r_library_path: string;
    python_library_path: string;
    conda_library_path: string;
}

export interface AppSessionItem {
    id: string;
    user_id: string;
    project_id: string;
    analysis_node_id: string;
    node_name: string;
    container_template_id: string;
    container_instance_id: string;
    container_instance_name: string;
    name: string;
    app_type: string;
    status: string;
    workspace_path: string;
    last_access_at: string;
    started_at: string;
    stopped_at: string;
    path_prefix: string;
    created_at: string;
    updated_at: string;
}

export interface ContainerInstanceItem {
    id: string;
    template_id: string;
    owner_type: string;
    owner_id: string;
    runtime_id: string;
    name: string;
    status: string;
    in_monitoring_registry?: boolean;
    ref_count?: number;
    ip_address: string;
    exit_code: number;
    started_at: string;
    finished_at: string;
    created_at: string;
    updated_at: string;
}

export interface ContainerEventItem {
    id: string;
    container_instance_id: string;
    event: string;
    message: string;
    created_at: string;
}

export interface OutboxEventItem {
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
    status: string;
    sent_at: string;
    created_at: string;
    updated_at: string;
}

export interface ContainerImagePageQuery {
    id?: string;
    name?: string;
    tag?: string;
    registry?: string;
    namespace?: string;
    full_name?: string;
    digest?: string;
    description?: string;
}

export interface ContainerTemplatePageQuery {
    id?: string;
    name?: string;
    description?: string;
    type?: string;
    image_id?: string;
    command?: string;
    work_dir?: string;
}

export interface AppSessionPageQuery {
    id?: string;
    project_id?: string;
    analysis_node_id?: string;
    container_template_id?: string;
    name?: string;
    status?: string;
    workspace_path?: string;
}

export interface CreateAppSessionPayload {
    container_template_id: string;
    // project_id: string;
    name: string;
}

export interface CreateAppSessionByAnalysisNodePayload {
    analysis_node_id: string;
    name?: string;
}

export interface AppSessionIDPayload {
    id: string;
}

export interface ContainerInstancePageQuery {
    id?: string;
    template_id?: string;
    owner_type?: string;
    owner_id?: string;
    runtime_id?: string;
    name?: string;
    status?: string;
    ip_address?: string;
}

export interface ContainerEventPageQuery {
    id?: string;
    container_instance_id?: string;
    event?: string;
    message?: string;
}

export interface OutboxEventPageQuery {
    id?: string;
    type?: string;
    status?: string;
}

export const pageContainerImageApi = (payload: PageRequest<ContainerImagePageQuery>) => {
    return http.post<PageResponse<ContainerImageItem>>("/container/image/list-by-page", payload);
};

export const createContainerImageApi = (payload: Partial<ContainerImageItem>) => {
    return http.post<ContainerImageItem>("/container/image/create", payload);
};

export const updateContainerImageApi = (payload: Partial<ContainerImageItem> & { id: string }) => {
    return http.post<{ message: string }>("/container/image/update", payload);
};

export const deleteContainerImageApi = (payload: { id: string }) => {
    return http.post<{ message: string }>("/container/image/delete", payload);
};

export const pageContainerTemplateApi = (payload: PageRequest<ContainerTemplatePageQuery>) => {
    return http.post<PageResponse<ContainerTemplateItem>>("/container/template/list-by-page", payload);
};

export const createContainerTemplateApi = (payload: Partial<ContainerTemplateItem>) => {
    return http.post<ContainerTemplateItem>("/container/template/create", payload);
};

export const updateContainerTemplateApi = (payload: Partial<ContainerTemplateItem> & { id: string }) => {
    return http.post<{ message: string }>("/container/template/update", payload);
};

export const deleteContainerTemplateApi = (payload: { id: string }) => {
    return http.post<{ message: string }>("/container/template/delete", payload);
};

export const exportContainerTemplateApi = (payload: { id: string }) => {
    return http.post<ContainerTemplateExportItem>("/container/template/export", payload);
};

export const importContainerTemplateApi = (payload: ContainerTemplateExportItem) => {
    return http.post<ContainerTemplateExportItem>("/container/template/import", payload);
};

export const pageAppSessionApi = (payload: PageRequest<AppSessionPageQuery>) => {
    const { page, page_size, ...query } = payload;
    return http.post<PageResponse<AppSessionItem>>("/container/app-session/list-by-page", {
        page,
        page_size,
        query,
    });
};

export const createAppSessionApi = (payload: CreateAppSessionPayload) => {
    return http.post<AppSessionItem>("/container/app-session/create", payload);
};

export const createAppSessionByAnalysisNodeApi = (payload: CreateAppSessionByAnalysisNodePayload) => {
    return http.post<AppSessionItem>("/container/app-session/create-by-analysis-node", payload);
};

export const startAppSessionApi = (payload: AppSessionIDPayload) => {
    return http.post<{ message: string }>("/container/app-session/start", payload);
};

export const stopAppSessionApi = (payload: AppSessionIDPayload) => {
    return http.post<{ message: string }>("/container/app-session/stop", payload);
};

export const deleteAppSessionApi = (payload: AppSessionIDPayload) => {
    return http.post<{ message: string }>("/container/app-session/delete", payload);
};

export const recreateAppSessionContainerApi = (payload: AppSessionIDPayload) => {
    return http.post<{ message: string }>("/container/app-session/recreate-container", payload);
};

export const pageContainerInstanceApi = (payload: PageRequest<ContainerInstancePageQuery>) => {
    return http.post<PageResponse<ContainerInstanceItem>>("/container/instance/list-by-page", payload);
};

export interface RuntimeDescription {
    kind: string;
    name: string;
    format: string;
    raw: string;
}

export const describeContainerInstanceApi = (id: string) => {
    return http.get<RuntimeDescription>("/container/instance/describe", { params: { id } });
};

export const pageContainerEventApi = (payload: PageRequest<ContainerEventPageQuery>) => {
    return http.post<PageResponse<ContainerEventItem>>("/container/event/list-by-page", payload);
};

export const pageOutboxEventApi = (payload: PageRequest<OutboxEventPageQuery>) => {
    return http.post<PageResponse<OutboxEventItem>>("/container/outbox/list-by-page", payload);
};

// Backward compatible export for legacy pages using the old endpoint.
export const pageContainerApi = async (params: any) => {
    const resp: any = await axios.post(`/container/page`, params);
    return resp;
};
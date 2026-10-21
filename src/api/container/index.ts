import axios from "axios";
import { http } from "@/api/client/http";
import type { PageRequest, PageResponse } from "@/api/data";

export interface ContainerMount {
    source: string;
    target: string;
    mode: string;
    type: string;
    owner: string;
}

export interface ContainerTemplateItem {
    id: string;
    spec_id: string;
    name: string;
    // display_name: 绑定行自身的展示名；为空时 name 回退到共享运行配置名。
    // 编辑表单必须读写它，否则会把回退出来的 name 误固化成绑定行展示名。
    display_name?: string;
    description: string;
    // definition_description: 绑定行（ContainerTemplateDefinition）自身的长描述，
    // 与 description（共享运行配置 spec 的描述）相互独立；Agent 工具 get_container_template
    // 会把它作为 description 回传给模型。
    definition_description?: string;
    type: string;
    // image_name: 完整镜像名（含 registry / tag），如 docker.io/rocker/rstudio:4.4。
    image_name: string;
    // pull_policy: Always / IfNotPresent / Never。
    pull_policy: string;
    command: string;
    cpu: number;
    memory: number;
    work_dir: string;
    port: number;
    app_type: string;
    env: Record<string, unknown> | null;
    mounts: ContainerMount[] | null;
    volumes: Record<string, unknown> | null;
    labels: Record<string, unknown> | null;
    change_uid: boolean;
    schedule_constraint: Record<string, unknown> | null;
    // is_default：该模板是否为系统默认（全局唯一）。create_script 未指定容器模板时使用它。
    is_default?: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * ContainerTemplateSpec = 共享运行配置（表 go_container_template_spec）。
 * 只描述“怎么跑”（命令、资源、端口、环境变量、挂载、标签），不含镜像；
 * 镜像通过 ContainerTemplateDefinition 绑定行关联。
 */
export interface ContainerTemplateSpecItem {
    id: string;
    name: string;
    description: string;
    command: string;
    cpu: number;
    memory: number;
    work_dir: string;
    port: number;
    app_type: string;
    env: Record<string, unknown> | null;
    mounts: ContainerMount[] | null;
    scheduling_constraint: Record<string, unknown> | null;
    labels: Record<string, unknown> | null;
    change_uid: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * ContainerTemplateDefinition = 「运行配置 × 镜像」绑定行（表 go_container_template_definition）。
 * 对外容器模板 ID 即绑定行主键；镜像名与拉取策略直接存在绑定行上。
 */
export interface ContainerTemplateDefinitionItem {
    id: string;
    spec_id: string;
    image_name?: string;
    pull_policy?: string;
    display_name?: string;
    description?: string;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
}

/**
 * 容器模板统一导出/导入格式，与 script.json / workflow.json 的容器资产部分完全相同：
 * 两个按主键去重的平铺列表，通过主键互相引用（definition.spec_id）。
 * 不包含时间字段。
 */
export interface ContainerTemplateBundleItem {
    container_template_specs: ContainerTemplateSpecItem[];
    container_template_definitions: ContainerTemplateDefinitionItem[];
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

export interface ContainerTemplatePageQuery {
    id?: string;
    name?: string;
    description?: string;
    type?: string;
    spec_id?: string;
    command?: string;
    work_dir?: string;
}

export interface ContainerTemplateSpecPageQuery {
    id?: string;
    name?: string;
    description?: string;
    app_type?: string;
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
    return http.post<ContainerTemplateBundleItem>("/container/template/export", payload);
};

export const importContainerTemplateApi = (payload: ContainerTemplateBundleItem) => {
    return http.post<ContainerTemplateBundleItem>("/container/template/import", payload);
};

/** 读取系统默认容器模板；没有默认模板时 data 为 null。 */
export const getDefaultContainerTemplateApi = () => {
    return http.get<{ data: ContainerTemplateItem | null }>("/container/template/default");
};

/** 把指定绑定行设为唯一默认模板（后端会清空其它模板的默认标记）。 */
export const setDefaultContainerTemplateApi = (payload: { id: string }) => {
    return http.post<ContainerTemplateItem>("/container/template/set-default", payload);
};

// ===== ContainerTemplateSpec（共享运行配置）CRUD =====

export const pageContainerTemplateSpecApi = (payload: PageRequest<ContainerTemplateSpecPageQuery>) => {
    return http.post<PageResponse<ContainerTemplateSpecItem>>("/container/template-spec/list-by-page", payload);
};

export const listContainerTemplateSpecApi = () => {
    return http.get<ContainerTemplateSpecItem[]>("/container/template-spec/list");
};

export const createContainerTemplateSpecApi = (payload: Partial<ContainerTemplateSpecItem>) => {
    return http.post<ContainerTemplateSpecItem>("/container/template-spec/create", payload);
};

export const updateContainerTemplateSpecApi = (payload: Partial<ContainerTemplateSpecItem> & { id: string }) => {
    return http.post<ContainerTemplateSpecItem>("/container/template-spec/update", payload);
};

export const deleteContainerTemplateSpecApi = (payload: { id: string }) => {
    return http.post<{ message: string }>("/container/template-spec/delete", payload);
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
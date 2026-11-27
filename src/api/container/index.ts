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
    // name: 绑定行自身的展示名（ContainerTemplateDefinition.Name）。
    name: string;
    // description: 绑定行自身的描述（ContainerTemplateDefinition.Description）。
    description: string;
    type: string;
    // image_name: 完整镜像名（含 registry / tag），如 docker.io/rocker/rstudio:4.4。
    image_name: string;
    // pull_policy: Always / IfNotPresent / Never。
    pull_policy: string;
    // languages: 该模板支持的程序语言（R / PYTHON / CONDA），决定注入哪些包目录变量。
    languages?: string[];
    // use_shared_dir: 包目录是否放在 <baseDir>/shared/package（跨项目共享）。
    use_shared_dir?: boolean;
    command: string;
    cpu: number;
    memory: number;
    port: number;
    app_type: string;
    env: Record<string, unknown> | null;
    mounts: ContainerMount[] | null;
    volumes: Record<string, unknown> | null;
    labels: Record<string, unknown> | null;
    change_uid: boolean;
    schedule_constraint: Record<string, unknown> | null;
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
    name?: string;
    description?: string;
    // languages: 支持的程序语言（R / PYTHON / CONDA）。
    languages?: string[];
    // use_shared_dir: 包目录是否放在共享目录下。
    use_shared_dir?: boolean;
    created_at?: string;
    updated_at?: string;
}

/** 容器模板支持的程序语言选项（GET /container/template-definition/languages）。 */
export interface ContainerTemplateLanguageOption {
    label: string;
    value: string;
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
    /**
     * 会话种类：
     * - web：应用会话（容器跑模板命令，前端经网关访问）；
     * - terminal：终端会话（容器常驻 + 交互式 shell）。
     */
    session_kind?: string;
    /** 创建该会话的 Agent 会话 ID；"0" / 空表示非 Agent 创建。 */
    agent_session_id?: string;
    /** 是否持久会话（只能由空闲 TTL 或显式关闭回收）。 */
    persistent?: boolean;
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
}

export interface ContainerTemplateSpecPageQuery {
    id?: string;
    name?: string;
    description?: string;
    app_type?: string;
    command?: string;
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

/** 只新增绑定行（ContainerTemplateDefinition）：spec_id 引用已有的共享运行配置。 */
export const createContainerTemplateDefinitionApi = (payload: Partial<ContainerTemplateDefinitionItem>) => {
    return http.post<ContainerTemplateDefinitionItem>("/container/template-definition/create", payload);
};

/** 查询容器模板支持的程序语言选项，供表单多选框使用。 */
export const listContainerTemplateLanguagesApi = () => {
    return http.get<ContainerTemplateLanguageOption[]>("/container/template-definition/languages");
};

/** 只更新绑定行（ContainerTemplateDefinition）自身字段：镜像 / 拉取策略 / 展示名 / 描述。 */
export const updateContainerTemplateDefinitionApi = (
    payload: Partial<ContainerTemplateDefinitionItem> & { id: string }
) => {
    return http.post<ContainerTemplateDefinitionItem & { id: string }>("/container/template-definition/update", payload);
};

/** 只删除绑定行（ContainerTemplateDefinition），共享运行配置保留。 */
export const deleteContainerTemplateDefinitionApi = (payload: { id: string }) => {
    return http.post<{ message: string }>("/container/template-definition/delete", payload);
};

export const exportContainerTemplateApi = (payload: { id: string }) => {
    return http.post<ContainerTemplateBundleItem>("/container/template/export", payload);
};

export const importContainerTemplateApi = (payload: ContainerTemplateBundleItem) => {
    return http.post<ContainerTemplateBundleItem>("/container/template/import", payload);
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

/**
 * 「清理全部容器资源」的结果（对应后端 types.ContainerCleanupResult）。
 *
 * 清理是尽力而为的：单条失败不会中断整体流程，失败原因收集在 errors 里。
 */
export interface ContainerCleanupResult {
    /** 清理前扫描到的 ContainerInstance 总数。 */
    containers_total: number;
    /** 成功删除的容器数（运行时资源 + 实例行）。 */
    containers_deleted: number;
    /** 清空的网关路由（go_gateway_route）行数。 */
    gateway_routes_deleted: number;
    /** 删除的 AppSession 行数（Web 会话 + 终端会话）。 */
    app_sessions_deleted: number;
    /** 逐条失败原因；为空表示全部成功。 */
    errors?: string[];
}

/**
 * 清理系统中的全部容器资源（运行中 + 已停止）。
 *
 * 后端会：清空网关路由 → 同步删除所有 ContainerInstance 及其 docker / k8s 运行时容器
 * → 删除全部 AppSession。属于不可逆操作，接口要求显式传 confirm=true。
 */
export const cleanupAllContainersApi = () => {
    return http.post<ContainerCleanupResult>("/container/instance/cleanup-all", { confirm: true });
};

/**
 * 默认容器运行时健康状态（对应后端 handler.ContainerHandler.CheckContainerRuntime）。
 *
 * 名称解析与容器实际执行完全同源（ContainerLifecycle.GetRuntime）：容器创建会失败的场景，
 * 这里同样会返回 registered=false 或 healthy=false，并带上原始错误信息，便于排查。
 */
export interface ContainerRuntimeHealth {
    /** 运行时名称：docker / k8s / k3s。 */
    name: string;
    /** 是否已在启动装配阶段注册。 */
    registered: boolean;
    /** 依赖探测是否通过（未注册时必然为 false）。 */
    healthy: boolean;
    /** 运行时是否实现了健康探测器（false 表示只做了注册检查）。 */
    checkable: boolean;
    /** 失败原因，正常时为空。 */
    error?: string;
    /** 后端所在宿主操作系统：linux / windows / darwin。 */
    host_os?: string;
    /** 后端所在宿主 CPU 架构：amd64 / arm64 等。 */
    host_arch?: string;
    /** 运行时实际连接地址（后端已脱敏，密码替换为 ***）。 */
    endpoint?: string;
    /** 地址来源：explicit / env / default / kubeconfig / in-cluster。 */
    endpoint_source?: string;
    /** 对端版本号（docker daemon / kubernetes apiserver）。 */
    server_version?: string;
    /** 是否启用运行时预置（container.docker.provision.enabled）；true 时展示安装向导入口。 */
    provision_enabled?: boolean;
    /** bash 工具执行位置：host（宿主机）/ container（容器）。 */
    bash_execution_mode?: string;
    /** container 模式下 bash 工具使用的容器模板 ID（后端以字符串返回，避免精度丢失）。 */
    bash_container_template_id?: string;
}

/** 获取默认容器运行时环境信息（docker daemon / k8s apiserver）。失败时不弹全局错误提示。 */
export const getContainerRuntimeInfoApi = () => {
    return http.get<ContainerRuntimeHealth>("/container/runtime/info", {
        skipGlobalError: true,
        timeout: 15000,
    });
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
import { http } from "@/api/client/http";

/** 数据库配置，字段与后端 config.DatabaseConfig 对齐。 */
export interface DatabaseConfig {
	driver: string;
	host: string;
	port: string;
	user: string;
	password: string;
	name: string;
	ssl_mode: string;
	path: string;
}

/** Kubernetes 运行时配置。 */
export interface KubernetesRuntimeConfig {
	namespace: string;
	kubeconfig: string;
	in_cluster: boolean;
}

/** 容器配置，字段与后端 config.ContainerConfig 对齐。 */
export interface ContainerConfig {
	kubernetes: KubernetesRuntimeConfig;
	runtimes: string[];
	default_runtime: string;
	refresh_image_status_on_start: boolean;
	recover_running_dag_on_start: boolean;
	cleanup_dag_node_containers_before_start: boolean;
	delete_container_on_node_success: boolean;
	dag_node_cleanup_on_failed: string;
	dag_node_cleanup_on_dag_finished: string;
	create_queue_max_concurrency: number;
	create_queue_max_pending: number;
}

/**
 * 模型提供商配置，字段与后端 config.ModelProviderConfig 对齐。
 * key 为模型名（与 Profile.model 对应）。
 *
 * 只需填写 provider（厂商类型）+ api_model（真实模型名）+ api_key 即可：
 * base_url / context_window / default_max_tokens / can_reason / supports_attachments
 * 等元信息由后端按厂商预置表自动补齐。
 */
export interface ModelProviderConfig {
	model_id?: string;
	base_url?: string;
	api_key?: string;
	/** 模型厂商类型（openai / anthropic / deepseek / gemini …）。 */
	provider?: string;
	/** 发给厂商的真实模型名；为空时回退 model_id。 */
	api_model?: string;
	/** 模型展示名；为空时回退 model_id。 */
	name?: string;
	context_window?: number;
	default_max_tokens?: number;
	can_reason?: boolean;
	supports_attachments?: boolean;
	cost_per_1m_in?: number;
	cost_per_1m_out?: number;
	cost_per_1m_in_cached?: number;
	cost_per_1m_out_cached?: number;
	reasoning_effort?: string;
	extra?: Record<string, string>;
}

/** AI Agent 配置，字段与后端 config.AgentConfig 对齐。 */
export interface AgentConfig {
	providers: Record<string, ModelProviderConfig>;
}

/** 模型厂商预置信息（后端 config.ModelVendorPreset）。 */
export interface ModelVendorPreset {
	/** 厂商类型，写入 ModelProviderConfig.provider。 */
	type: string;
	/** 展示名。 */
	name: string;
	/** 默认 base_url，空表示由 SDK 决定。 */
	base_url: string;
	/** 常见模型名前缀。 */
	api_model_prefix?: string;
	/** 常见模型名。 */
	models: string[];
}

/** 模型厂商 / 模型选项接口响应。 */
export interface ModelProviderOptionsResponse {
	vendors: ModelVendorPreset[];
	/** 预置模型参数（key 为模型名，不含凭据）。 */
	defaults: Record<string, ModelProviderConfig>;
	/** 当前生效的模型配置表。 */
	providers: Record<string, ModelProviderConfig>;
}

/** 后端已注册的可编辑配置段，key 与 config.yml 的顶层键名一致。 */
export interface ConfigSections {
	database: DatabaseConfig;
	container: ContainerConfig;
	agent: AgentConfig;
}

/** 配置段 key，同时也是 POST 时使用的 section 标识。 */
export type ConfigSectionKey = keyof ConfigSections;

export interface ConfigFileResponse {
	/** config.yml 的绝对路径。 */
	config_path: string;
	/** config.yml 是否存在，false 表示返回的是代码中的默认配置。 */
	config_exists: boolean;
	/** 各配置段当前生效的值。 */
	sections: ConfigSections;
}

export interface UpdateConfigSectionResponse<K extends ConfigSectionKey> {
	config_path: string;
	section: K;
	/** 归一化后的配置段内容，可用于刷新表单。 */
	value: ConfigSections[K];
}

/** 获取当前生效的 config.yml 配置（用于表单回填）。 */
export const getConfigFileApi = () => {
	return http.get<ConfigFileResponse>("/config/file/get");
};

/** 把某个配置段写入 config.yml（不存在则创建）。 */
export const updateConfigSectionApi = <K extends ConfigSectionKey>(
	section: K,
	value: ConfigSections[K],
) => {
	return http.post<UpdateConfigSectionResponse<K>>("/config/file/section/update", {
		section,
		value,
	});
};

/**
 * 获取模型厂商与模型选项。
 *
 * 供 AI Agent 配置页渲染「厂商 → 模型 → API Key」表单：厂商类型、默认 base_url、
 * 常见模型名均由后端下发，前端不必硬编码。
 */
export const getModelProviderOptionsApi = () => {
	return http.get<ModelProviderOptionsResponse>("/config/model/providers");
};

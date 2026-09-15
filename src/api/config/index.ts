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

/** 后端已注册的可编辑配置段，key 与 config.yml 的顶层键名一致。 */
export interface ConfigSections {
	database: DatabaseConfig;
	container: ContainerConfig;
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

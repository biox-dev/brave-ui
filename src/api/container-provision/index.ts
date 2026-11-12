import { http } from "@/api/client/http";

/**
 * 容器运行时预置（安装向导）相关接口。
 *
 * 后端见 gobrave/internal/handler/container_provision.go，路由挂在
 * /container/runtime/provision/* 之下（需 Bearer token）。
 *
 * 设计要点：
 * - Download / Install 是耗时操作，接口立即返回 202，进度靠轮询 status 读取；
 * - Uninstall 是同步接口，必须显式传 confirm=true；
 * - Start 是同步的启动自检，未安装时返回 409。
 */

/** 后端 provision.State 的取值（types.State）。 */
export const RuntimeProvisionState = {
	NotInstalled: "not_installed",
	Downloaded: "downloaded",
	Installed: "installed",
	Running: "running",
} as const;

export type RuntimeProvisionStateValue =
	(typeof RuntimeProvisionState)[keyof typeof RuntimeProvisionState];

/**
 * 运行时状态，对应后端 provision.RuntimeStatus。
 * 注意：Windows 上 Distro 是 WSL 发行版名，Linux 上是 "local"。
 */
export interface RuntimeProvisionStatus {
	state: RuntimeProvisionStateValue | string;
	distro: string;
	data_dir: string;
	endpoint: string;
	version: string;
	download_url: string;
	detail: string;
}

/**
 * 一次 Download / Install 的进度快照，对应后端 provisionState 的 snapshot()。
 * percent 为 -1 表示无法计算百分比。
 */
export interface RuntimeProvisionProgress {
	running: boolean;
	finished: boolean;
	stage: string;
	percent: number;
	message: string;
	error: string;
}

/** GET /container/runtime/provision/status 的响应体。 */
export interface RuntimeProvisionStatusResponse {
	status: RuntimeProvisionStatus;
	progress: RuntimeProvisionProgress;
}

/**
 * 查询安装/运行状态。
 *
 * 用户首次进入安装向导时状态可能为 not_installed，这不是错误，
 * 因此失败时不弹全局提示，由页面自行展示。
 */
export const getRuntimeProvisionStatusApi = () => {
	return http.get<RuntimeProvisionStatusResponse>("/container/runtime/provision/status", {
		skipGlobalError: true,
	});
};

/** POST /container/runtime/provision/download —— 异步下载 rootfs 包（202）。 */
export const downloadRuntimeProvisionApi = () => {
	return http.post<{ accepted: boolean }>("/container/runtime/provision/download");
};

/** POST /container/runtime/provision/install —— 异步导入并启动 dockerd（202）。 */
export const installRuntimeProvisionApi = () => {
	return http.post<{ accepted: boolean }>("/container/runtime/provision/install");
};

/**
 * POST /container/runtime/provision/uninstall —— 同步卸载（必须 confirm=true）。
 * 会删除发行版及其中的全部容器 / 镜像，调用方必须先做二次确认。
 */
export const uninstallRuntimeProvisionApi = (confirm: boolean) => {
	return http.post<{ uninstalled: boolean }>("/container/runtime/provision/uninstall", {
		confirm,
	});
};

/** POST /container/runtime/provision/start 的响应；未安装时后端返回 409。 */
export interface RuntimeProvisionStartResponse {
	installed: boolean;
	endpoint?: string;
	error?: string;
}

/** POST /container/runtime/provision/start —— 手动触发一次启动自检。 */
export const startRuntimeProvisionApi = () => {
	return http.post<RuntimeProvisionStartResponse>("/container/runtime/provision/start");
};

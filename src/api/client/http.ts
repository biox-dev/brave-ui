import axios from "axios";
import type { AxiosError } from "axios";
import { API_CONFIG } from "./config";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

declare module "axios" {
	export interface AxiosRequestConfig {
		/**
		 * 设为 true 时该请求失败不弹全局错误提示。
		 * 适合封面图这类「失败可以静默降级」的请求。
		 */
		skipGlobalError?: boolean;
	}
}

const LOGIN_HASH_PATH = "#/login";

const redirectToLogin = () => {
	if (window.location.hash === LOGIN_HASH_PATH || window.location.hash.endsWith("/login")) {
		return;
	}
	window.location.hash = "/login";
};

type ApiErrorPayload = {
	message?: string;
	detail?: string;
	details?: unknown;
	error?: {
		code?: number;
		message?: string;
		details?: unknown;
	};
	success?: boolean;
};

export interface UnifiedApiErrorResponse {
	success: false;
	error: {
		code: number;
		message: string;
		details?: unknown;
	};
}

const DEFAULT_ERROR_CODE = 1000;

const normalizeApiError = (error: AxiosError<ApiErrorPayload>): UnifiedApiErrorResponse => {
	const data = error.response?.data;
	const message =
		data?.error?.message ||
		data?.message ||
		data?.detail ||
		error.message ||
		"Request failed";

	const code =
		typeof data?.error?.code === "number"
			? data.error.code
			: typeof error.response?.status === "number"
				? error.response.status
				: DEFAULT_ERROR_CODE;

	const details = data?.error?.details ?? data?.details ?? data?.detail;

	return {
		success: false,
		error: {
			code,
			message,
			...(details !== undefined ? { details } : {}),
		},
	};
};

const getErrorMessage = (error: AxiosError<ApiErrorPayload>) => {
	return normalizeApiError(error).error.message;
};

export const http = axios.create({
	baseURL: API_CONFIG.baseURL,
	timeout: API_CONFIG.timeout,
	headers: {
		"Content-Type": "application/json",
	},
});

http.interceptors.request.use((config) => {
	const token = localStorage.getItem("Authorization") || localStorage.getItem("authorization");
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

http.interceptors.response.use(
	(response) => response,
	(error: AxiosError<ApiErrorPayload>) => {
		const normalized = normalizeApiError(error);
		if (error.response) {
			error.response.data = {
				...normalized,
				message: normalized.error.message,
				detail:
					typeof normalized.error.details === "string"
						? normalized.error.details
						: normalized.error.message,
			} as ApiErrorPayload;
		}

		if (error.response?.status === 401) {
			redirectToLogin();
			return Promise.reject(error);
		}

		const globalMessage = getGlobalMessage();
		if (globalMessage && !error.config?.skipGlobalError) {
			globalMessage.error(normalized.error.message);
		}
		return Promise.reject(error);
	}
);

export const setupLegacyAxios401Interceptor = () => {
	axios.interceptors.response.use(
		(response) => response,
		(error: AxiosError) => {
			if (error.response?.status === 401) {
				redirectToLogin();
			}
			return Promise.reject(error);
		}
	);
};


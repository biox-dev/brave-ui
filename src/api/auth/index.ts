import { http } from "@/api/client/http";

export interface LoginRequest {
	email: string;
	password: string;
}

// Agent 用户配置（对应后端 agent.UserAgentConfig）。
export interface AgentUserConfig {
	/** 选中的 Agent Profile ID（字符串形式的雪花 ID；为空 / 0 表示使用默认）。 */
	profile_id?: string;
	permissions?: Record<string, string>;
}

// Agent Profile 摘要 DTO（对应后端 types.AgentProfileInfo）。
export interface AgentProfileInfo {
	id: string;
	name: string;
	description?: string;
	model?: string;
	provider?: string;
	is_default?: boolean;
	is_builtin?: boolean;
}

export interface LoginUser {
	id: string;
	username: string;
	email: string;
	avatar: string;
	profile?: string;
	agent_config?: AgentUserConfig;
	/** 当前 agent_config.profile_id 对应的 Profile 摘要（由 /auth/me 解析返回）。 */
	agent_profile?: AgentProfileInfo;
	is_active: boolean;
	can_access_all_tenants: boolean;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface LoginResponse {
	success: boolean;
	message: string;
	user: LoginUser;
	token: string;
	refresh_token: string;
}

export const loginApi = (payload: LoginRequest) => {
	return http.post<LoginResponse>("/auth/login", payload, {
		headers: {
			accept: "application/json",
		},
	});
};

export interface RegisterRequest {
	username: string;
	email: string;
	password: string;
}

export interface RegisterResponse {
	success: boolean;
	message: string;
	user: LoginUser;
}

export const registerApi = (payload: RegisterRequest) => {
	return http.post<RegisterResponse>("/auth/register", payload, {
		headers: {
			accept: "application/json",
		},
	});
};

export const logoutApi = () => {
	return http.post("/auth/logout", "", {
		headers: {
			accept: "application/json",
		},
	});
};

// 获取当前登录用户信息（后端 /auth/me）。
export const getCurrentUserApi = () => {
	return http.get<{ success: boolean; data: { user: LoginUser } }>("/auth/me", {
		headers: {
			accept: "application/json",
		},
	});
};

// 更新当前用户的 Agent Profile（后端仅允许修改自己的选择）。
export const updateUserProfileApi = (profileID: string) => {
	return http.post<{ success: boolean; message: string; user: LoginUser }>("/auth/profile", {
		profile_id: profileID,
	});
};

// 更新当前用户的 Agent 配置（Profile + Permissions）。
export const updateAgentConfigApi = (payload: {
	profile_id?: string;
	permissions?: Record<string, string>;
}) => {
	return http.post<{ success: boolean; message: string; user: LoginUser }>(
		"/auth/agent-config",
		payload
	);
};

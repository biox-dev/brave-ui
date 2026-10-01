import { http } from "@/api/client/http";
import type { PageResponse } from "@/api/data";

/** AI 摘要生成状态。 */
export type AISummaryStatus = "pending" | "generating" | "success" | "failed";

/** AI 摘要所属对象类型。 */
export type AISummaryOwnerType = "analysis" | "analysis_node";

/**
 * 分页列表项：后端 page 接口不返回 content（正文可能很大），
 * 正文由 {@link getAISummaryApi} 按 ID 单独查询。
 */
export interface AISummaryListItem {
	id: string;
	owner_id: string;
	owner_type: string;
	project_id?: string;
	task_id?: string;
	/** 生成该摘要使用的 Agent Profile 名称（为空表示使用内置 summary Profile）。 */
	profile?: string;
	title: string;
	status: AISummaryStatus;
	created_at: string;
	updated_at: string;
}

/** 摘要详情：在列表项基础上补充 content 与 prefix。 */
export interface AISummaryItem extends AISummaryListItem {
	content: string;
	/** 摘要所属对象输出目录对应的 URL 前缀，用于解析 content 中的相对图片/链接。 */
	prefix?: string;
}

export interface AISummaryPageQuery {
	// Reserved for future filters.
}

export interface AISummaryPageRequest {
	page?: number;
	page_size?: number;
}

/** 按当前用户激活项目分页查询 AI 摘要（不返回 content）。 */
export const pageAISummaryByProjectApi = (payload: AISummaryPageRequest) =>
	http.post<PageResponse<AISummaryListItem>>("/ai-summary/list-by-project-page", payload);

/** 按 ID 查询 AI 摘要详情（含 content 与 prefix）。 */
export const getAISummaryApi = (id: string) =>
	http.get<AISummaryItem>(`/ai-summary/get?id=${encodeURIComponent(id)}`);

export const regenerateAISummaryApi = (id: string) =>
	http.post<AISummaryItem>("/ai-summary/regenerate", { id: String(id) });

export const deleteAISummaryApi = (id: string) =>
	http.post<{ message: string }>("/ai-summary/delete", { id: String(id) });

/** 按所属对象（analysis / analysis_node）查询摘要列表，返回项含 content。 */
export const listAISummaryByOwnerApi = (ownerType: AISummaryOwnerType, ownerId: string | number) =>
	http.get<AISummaryItem[]>("/ai-summary/list", {
		params: { owner_type: ownerType, owner_id: ownerId },
	});

/** 按所属对象创建摘要，由后端异步生成正文。 */
export const createAISummaryApi = (payload: {
	owner_id: string;
	owner_type: AISummaryOwnerType;
	profile?: string;
}) => http.post<AISummaryItem>("/ai-summary/create", payload);

/** 按 ID 更新摘要标题、内容与 Agent Profile。 */
export const updateAISummaryApi = (payload: {
	id: string;
	title?: string;
	content?: string;
	profile?: string;
}) => http.post<AISummaryItem>("/ai-summary/update", payload);

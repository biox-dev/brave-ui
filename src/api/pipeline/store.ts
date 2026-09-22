import { http } from "@/api/client/http";
import type { GitRemote } from "./git";

/**
 * store（商店/发布产物）相关接口。
 *
 * 目前只有「发布到远程」这一组：
 *   - `GET  /store/get`            → 读取 store 详情（用于展示已配置的远程仓库）；
 *   - `POST /store/publish-remote` → 把 url 写成 store 裸仓库的 git remote（github / gitee ...）。
 *
 * store 表已删除 url 列：目标地址保存在 store 裸仓库的 git remote 配置里，
 * 因此详情接口通过 `remotes` 返回仓库当前配置的所有 remote。
 * 真正的 push 还没实现，响应里的 `published` 恒为 false。
 */

/** `store.publish_urls` 里的一条：同一仓库的 SSH / HTTPS 两种地址。 */
export interface StorePublishURL {
	/** 平台名（github / gitee）。 */
	name: string;
	ssh?: string;
	https?: string;
}

/** `GET /store/get` 的响应（与后端 `types.Store` 对应，只声明用到的字段）。 */
export interface StoreDetail {
	/** store 表 int64 主键，后端 `json:"id,string"`。 */
	id: string;
	store_type: string;
	name?: string;
	origin?: string;
	status?: string;
	path_name?: string;
	store_path?: string;
	category?: string;
	img?: string;
	/** store 裸仓库上配置的远程仓库列表（发布到远程时写入，不落库）。 */
	remotes?: GitRemote[] | null;
	publish_urls?: StorePublishURL[] | null;
	message?: string;
	created_at?: string;
	updated_at?: string;
}

/** 读取 store 详情（storeId 为 store 表 int64 主键）。 */
export const getStoreApi = async (storeId: string | number) => {
	const resp = await http.get<StoreDetail>("/store/get", {
		params: { id: String(storeId) },
		skipGlobalError: true,
	});
	return resp.data;
};

/** `POST /store/publish-remote` 的响应。 */
export interface PublishStoreRemoteResponse {
	message: string;
	/** store 表 int64 主键（字符串）。 */
	store_id: string;
	/** 本次提交的目标远程地址（已 trim）。 */
	url: string;
	/** 本次地址对应的 remote 名（github / gitee / gitlab ...）。 */
	remote: string;
	/** 是否为本次新增的 remote；false 表示该地址此前已配置、本次跳过添加。 */
	remote_added: boolean;
	/** 写入后 store 裸仓库上配置的全部 remote。 */
	remotes: GitRemote[];
	/** 是否真的完成了远程发布；当前阶段恒为 false（只配置 remote，未 push）。 */
	published: boolean;
}

/** 发布到远程：把 storeId 对应 store 的 url 写成其裸仓库的 git remote（github / gitee ...）。 */
export const publishStoreRemoteApi = async (storeId: string | number, url: string) => {
	const resp = await http.post<PublishStoreRemoteResponse>(
		"/store/publish-remote",
		{
			store_id: String(storeId),
			url: url.trim(),
		},
		{ skipGlobalError: true },
	);
	return resp.data;
};

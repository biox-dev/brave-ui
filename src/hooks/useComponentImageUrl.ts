// src/hooks/useComponentImageUrl.ts
import { useEffect, useState } from "react";
import { http } from "@/api/client/http";
import {
	componentImageApiUrl,
	isBareImageName,
	type ComponentImageKind,
} from "@/utils/component-image";

/**
 * 通过 http 客户端（请求拦截器会带上 `Authorization: Bearer <token>`）拉取组件封面，
 * 返回可直接给 `<img src>` 的 blob URL。
 *
 * 为什么要走 http 而不是直接 `<img src="/api/v1/...">`：
 * `<img>` 无法附加请求头，只能依赖登录时写入的 Authorization Cookie；
 * 当 UI 与 API 不同源（或 Cookie 已过期）时会 401。这里统一用 XHR + objectURL 解决。
 *
 * - `img` 是历史完整路径时，直接当普通 URL 用（不需要 token）；
 * - 后端在图片不存在时返回占位图（200），所以「没有封面」也是一张正常图片；
 * - `reloadKey` 用于同文件名覆盖上传后强制刷新（文件名固定，URL 不变）。
 */
export const useComponentImageUrl = (
	kind: ComponentImageKind,
	id?: number | string | null,
	img?: string | null,
	reloadKey: number = 0,
): string | undefined => {
	const [url, setUrl] = useState<string | undefined>(undefined);
	const hasId = id !== undefined && id !== null && id !== "";

	useEffect(() => {
		// 历史数据：img 里存的是完整路径，直接使用
		if (img && !isBareImageName(img)) {
			setUrl(img);
			return;
		}

		if (!hasId) {
			setUrl(undefined);
			return;
		}

		let disposed = false;
		let objectUrl: string | undefined;

		http
			.get(componentImageApiUrl(kind, id as number | string), {
				responseType: "blob",
				// 封面取不到时静默降级，不弹全局错误
				skipGlobalError: true,
			})
			.then((resp) => {
				if (disposed) return;
				objectUrl = URL.createObjectURL(resp.data as Blob);
				setUrl(objectUrl);
			})
			.catch(() => {
				if (!disposed) setUrl(undefined);
			});

		return () => {
			disposed = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [kind, String(id ?? ""), img, reloadKey]);

	return url;
};

export default useComponentImageUrl;

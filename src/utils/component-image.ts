// src/utils/component-image.ts
// 组件/商店封面（img 列）约定：
//   - DB 的 img 列只保存纯文件名（image.<ext>）；
//   - 完整地址由 int64 主键推导：`/api/v1/{kind}/{id}/image`；
//   - 历史上 img 可能存的是完整路径（"/brave-api/img/xxx.png"）或 http 地址，需要兼容。

/** script=pipeline_components，workflow=pipeline_components_relation，store=已发布的商店产物 */
export type ComponentImageKind = "script" | "workflow" | "store";

/** 接口前缀，与 http 客户端（API_CONFIG.baseURL = getPathname() + "/api/v1"）保持一致 */
export const COMPONENT_IMAGE_API_PREFIX = "/api/v1";

/** 后端约定：所有组件的封面文件名都是 image.<ext>，因此能据此区分「纯文件名」与历史完整路径 */
export const COMPONENT_IMAGE_BASE_NAME = "image";

/**
 * Img 列的值是否为「纯文件名」。
 * 历史数据里可能是 "/brave-api/img/pipeline.jpg" 这类带路径的值，返回 false。
 */
export const isBareImageName = (img?: string | null): boolean =>
	!!img && !img.includes("/") && !img.includes("\\");

/** 相对于 http 客户端 baseURL 的上传/读取路径 */
export const componentImageApiUrl = (kind: ComponentImageKind, id: number | string) =>
	`/${kind}/${id}/image`;

/**
 * 拼出可直接给 `<img src>` 的地址：
 * - 新数据（纯文件名 / 空值但有主键）：由 int64 主键推导接口地址，后端缺图时返回占位图；
 * - 历史数据（完整路径或 http 地址）：原样返回。
 */
export const buildComponentImageUrl = (
	baseURL: string,
	kind: ComponentImageKind,
	id?: number | string | null,
	img?: string | null,
): string => {
	if (img && !isBareImageName(img)) {
		if (/^https?:\/\//i.test(img)) return img;
		return `${baseURL}${img.startsWith("/") ? "" : "/"}${img}`;
	}

	if (id === undefined || id === null || id === "") return "";
	return `${baseURL}${COMPONENT_IMAGE_API_PREFIX}${componentImageApiUrl(kind, id)}`;
};

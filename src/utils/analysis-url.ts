/**
 * 分析/节点产物资源路径的统一解析。
 *
 * 后端返回的产物路径以「数据目录」为根，例如
 * `/34/analysis_node/100/200/output/a.png`（见 gobrave 的 utils.GetAnalysisURLPrefix）：
 * 后端只返回与部署无关的相对路径，`/data-analysis` 前缀统一由前端补上。
 */

export const DATA_ANALYSIS_PREFIX = "/data-analysis";

/**
 * 指向「数据目录」的已带前缀路径（后端旧版本/上传接口会直接返回这种形式）。
 */
const SERVED_DATA_PREFIXES = [
	DATA_ANALYSIS_PREFIX,
	"/images-data",
	"/data-project",
	"/images-analysis",
];

/**
 * 已经带服务前缀的路径（浏览器能直接访问的同义路由）：
 * 这些路径可能来自上传接口（`/images/...`）或旧版后端（`/data-analysis/...`、
 * `/images-analysis/...`），不能再补一次前缀。
 */
const SERVED_URL_PREFIXES = [
	...SERVED_DATA_PREFIXES,
	"/images",
];

const isAbsoluteOrSpecialUrl = (url: string) =>
	/^(https?:)?\/\//i.test(url) || /^(data:|blob:|#)/i.test(url);

const hasServedPrefix = (path: string, prefixes: string[]) =>
	prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * withDataAnalysisPrefix 给「以数据目录为根」的根相对路径补上 /data-analysis 前缀。
 *
 * - 空值返回空串；
 * - 绝对 URL / 协议相对 URL / data: / blob: / 锚点原样返回；
 * - 已带服务前缀（/data-analysis、/images-data、/data-project、/images-analysis、/images）原样返回；
 * - 非根相对路径（如 `plot.png`）原样返回，交给调用方按各自的前缀规则处理。
 */
export const withDataAnalysisPrefix = (path?: string | null): string => {
	const value = (path ?? "").trim();
	if (!value) {
		return "";
	}
	if (isAbsoluteOrSpecialUrl(value)) {
		return value;
	}
	if (!value.startsWith("/")) {
		return value;
	}
	if (hasServedPrefix(value, SERVED_URL_PREFIXES)) {
		return value;
	}
	return `${DATA_ANALYSIS_PREFIX}${value}`;
};

/**
 * resolveAnalysisAssetURL 把后端返回的产物路径解析成可直接放进
 * `<img src>` / `<iframe src>` / `window.open` 的地址：
 * baseURL（部署根路径）+ /data-analysis 前缀 + 路径。
 *
 * 非根相对路径仍按旧规则拼成 `${baseURL}/${path}`。
 */
export const resolveAnalysisAssetURL = (baseURL: string, path?: string | null): string => {
	const raw = (path ?? "").trim();
	if (!raw) {
		return "";
	}
	const resolved = withDataAnalysisPrefix(raw);
	if (isAbsoluteOrSpecialUrl(resolved)) {
		return resolved;
	}
	if (!resolved.startsWith("/")) {
		return `${baseURL ?? ""}/${resolved}`;
	}
	return `${baseURL ?? ""}${resolved}`;
};

/** 匹配 HTML 里的 src/href 属性（含单双引号）。 */
const HTML_URL_ATTR_PATTERN = /(\s(?:src|href)=["'])(\/[^"']*)(["'])/gi;

/**
 * resolveAnalysisAssetHTML 把后端渲染的 HTML 片段（报告导出）里的资源路径解析成
 * 浏览器可直接访问的地址，供 `iframe srcDoc` 预览使用：
 *
 * - 已是 `/data-analysis`、`/images-data`、`/data-project`、`/images-analysis` 开头的路径，
 *   只补部署根路径 baseURL（srcDoc 解析的是站点绝对路径）；
 * - 以数据目录为根的路径（如 `/34/...`）补 `/data-analysis` 前缀；
 * - 站内链接、`/images/...` 上传图等保持原样，避免误伤。
 */
export const resolveAnalysisAssetHTML = (html?: string | null, baseURL = ""): string => {
	const value = html ?? "";
	if (!value) {
		return "";
	}
	return value.replace(HTML_URL_ATTR_PATTERN, (match, head: string, path: string, tail: string) => {
		if (hasServedPrefix(path, SERVED_DATA_PREFIXES)) {
			return `${head}${baseURL}${path}${tail}`;
		}
		const resolved = withDataAnalysisPrefix(path);
		if (resolved === path) {
			return match;
		}
		return `${head}${baseURL}${resolved}${tail}`;
	});
};

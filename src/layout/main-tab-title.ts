import { splitRouteView } from '@/routes/route-view';

const normalizePath = (path: string) => {
  const withoutQuery = path.split('?')[0].split('#')[0];
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

/** 路径末段解码后截断：只保留「最后几个字符串」，够区分不同标签即可。 */
const shortSegment = (segment: string): string => {
  const decoded = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();
  return decoded.length > 8 ? decoded.slice(0, 8) : decoded;
};

/**
 * 标签页的兜底标题。
 *
 * ⚠️ 这里**不做任何静态映射**（菜单文案 / 固定路径表 / 路由前缀表都已删除）：
 * 标签名由跳转方负责——
 * - 列表 / 跳转入口：`useOpenMainTab(path, name)` 一步完成跳转 + 命名；
 * - 详情页：`useRouteMainTabTitle(entity)` 在数据到达后覆盖；
 * - 任何页面都可以直接 `setMainTabTitle(path, name)` 登记。
 *
 * 两者都没有登记时才会走到这里，先显示「路径最后几个字符串」作为占位，
 * 方便一眼看出哪些跳转还没传名称，后续逐个补齐。
 */
export const resolveMainTabTitle = (path: string, locale: string): string => {
  const normalized = normalizePath(path);
  if (normalized === '/') {
    return locale === 'en_US' ? 'Home' : '首页';
  }

  // 调用方可以通过 `?title=` 直接给出名称（如文件预览：/preview/file?url=…&title=…）
  const queryIndex = path.indexOf('?');
  const queryTitle =
    queryIndex >= 0 ? new URLSearchParams(path.slice(queryIndex + 1)).get('title') : null;
  if (queryTitle) {
    return queryTitle;
  }

  // 视图段（/c/scripts/:id/scriptCode）不是页面身份的一部分：取尾段时跳过，
  // 否则标签会显示成「scriptCode」这类无意义文案。
  const { basePath, view } = splitRouteView(normalized);
  const segments = (view ? basePath : normalized).split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? shortSegment(last) : normalized;
};

export const normalizeMainTabPath = normalizePath;

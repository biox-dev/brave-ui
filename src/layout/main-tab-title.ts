import { layoutMenuTree, type LayoutMenuItem, type LayoutLocale } from './layout-menu';

type TabLabel = { zh_CN: string; en_US: string };

const normalizePath = (path: string) => {
  const withoutQuery = path.split('?')[0].split('#')[0];
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

/** 菜单里有固定 key 的路径，直接用菜单文案作为标签标题。 */
const menuTitleMap = (() => {
  const map = new Map<string, TabLabel>();
  const walk = (items: LayoutMenuItem[]) => {
    items.forEach((item) => {
      if (!item.hidden) {
        map.set(normalizePath(item.key), item.label);
      }
      if (item.children?.length) {
        walk(item.children);
      }
    });
  };
  walk(layoutMenuTree);
  return map;
})();

/** 路由中存在但菜单里没有的固定路径。 */
const extraTitles: Record<string, TabLabel> = {
  '/dataset-file': { zh_CN: '数据文件', en_US: 'Dataset Files' },
  '/sample': { zh_CN: '样本', en_US: 'Sample' },
  '/sample-qc': { zh_CN: '样本 QC', en_US: 'Sample QC' },
  '/analysis-result': { zh_CN: '分析结果', en_US: 'Analysis Result' },
  '/preview/file': { zh_CN: '文件预览', en_US: 'File Preview' },
  '/workflow-card': { zh_CN: '流程', en_US: 'Workflows' },
  '/tools-card': { zh_CN: '工具', en_US: 'Tools' },
  '/pipeline-card': { zh_CN: '流程', en_US: 'Pipelines' },
  '/software-card': { zh_CN: '软件', en_US: 'Software' },
  '/file-card': { zh_CN: '文件', en_US: 'Files' },
  '/script-card': { zh_CN: '脚本', en_US: 'Scripts' },
  '/componentsV2/script': { zh_CN: '脚本', en_US: 'Scripts' },
  '/componentsV2/file': { zh_CN: '文件', en_US: 'Files' },
};

/** 带参数的路由：按前缀匹配，标题后缀会拼上 id 便于区分多个标签页。 */
const dynamicTitles: Array<{ prefix: string; label: TabLabel }> = [
  { prefix: '/report-file', label: { zh_CN: '报告文件', en_US: 'Report File' } },
  { prefix: '/report-item', label: { zh_CN: '报告条目', en_US: 'Report Item' } },
  { prefix: '/report', label: { zh_CN: '报告撰写', en_US: 'Report Writing' } },
  { prefix: '/literature-writing', label: { zh_CN: '文献撰写', en_US: 'Literature Writing' } },
  { prefix: '/analsyis-node-report', label: { zh_CN: '节点报告', en_US: 'Node Report' } },
  { prefix: '/analysis-report', label: { zh_CN: '分析报告', en_US: 'Analysis Report' } },
  { prefix: '/analysis-result', label: { zh_CN: '分析结果', en_US: 'Analysis Result' } },
  { prefix: '/software-analysis-editor', label: { zh_CN: '软件分析', en_US: 'Software Analysis' } },
  { prefix: '/dataset-file', label: { zh_CN: '数据文件', en_US: 'Dataset File' } },
  { prefix: '/c/ai-summaries', label: { zh_CN: 'AI 摘要', en_US: 'AI Summary' } },
  { prefix: '/c/scripts', label: { zh_CN: '脚本', en_US: 'Scripts' } },
  { prefix: '/c/tools', label: { zh_CN: '流程', en_US: 'Workflow' } },
  { prefix: '/c/file', label: { zh_CN: '文件', en_US: 'Files' } },
  { prefix: '/relation', label: { zh_CN: '关联组件', en_US: 'Relation' } },
  { prefix: '/component', label: { zh_CN: '流程组件', en_US: 'Component' } },
  { prefix: '/software', label: { zh_CN: '软件', en_US: 'Software' } },
  { prefix: '/file', label: { zh_CN: '文件', en_US: 'File' } },
  { prefix: '/script', label: { zh_CN: '脚本', en_US: 'Script' } },
];

const pickLabel = (label: TabLabel, locale: LayoutLocale) => label[locale];

const prettifySegment = (segment: string) => {
  const decoded = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();
  return decoded
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const shortId = (segment?: string) => {
  if (!segment) {
    return '';
  }
  return segment.length > 6 ? segment.slice(0, 6) : segment;
};

/**
 * 解析主区域标签页标题。
 * 依次尝试：菜单标题 → 固定路由标题 → 动态路由前缀 → 路径最后一段。
 */
export const resolveMainTabTitle = (path: string, locale: string): string => {
  const layoutLocale: LayoutLocale = locale === 'en_US' ? 'en_US' : 'zh_CN';
  const normalized = normalizePath(path);
  if (normalized === '/') {
    return layoutLocale === 'en_US' ? 'Home' : '首页';
  }

  // 带查询参数的页面（如文件预览）用查询参数里的标题区分同名标签
  if (normalized === '/preview/file') {
    const queryIndex = path.indexOf('?');
    const previewTitle =
      queryIndex >= 0 ? new URLSearchParams(path.slice(queryIndex + 1)).get('title') : null;
    if (previewTitle) {
      return previewTitle;
    }
  }

  const menuLabel = menuTitleMap.get(normalized);
  if (menuLabel) {
    return pickLabel(menuLabel, layoutLocale);
  }

  const extraLabel = extraTitles[normalized];
  if (extraLabel) {
    return pickLabel(extraLabel, layoutLocale);
  }

  const matched = dynamicTitles.find(
    (rule) => normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`),
  );
  if (matched) {
    const rest = normalized.slice(matched.prefix.length).replace(/^\/+/, '');
    const id = shortId(rest.split('/').filter(Boolean).pop());
    const base = pickLabel(matched.label, layoutLocale);
    return id ? `${base} · ${id}` : base;
  }

  const segments = normalized.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? prettifySegment(last) : normalized;
};

export const normalizeMainTabPath = normalizePath;

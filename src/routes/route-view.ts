/**
 * 路由「视图段」（view segment）统一约定
 * ============================================================
 * 页面里常有多套 ViewResolver 视图（运行结果 / 脚本代码 / 参数 …）。这些视图以前放在
 * `useState` 里，刷新、切换标签页、分享链接都会丢。统一做法是把视图名写进 URL 的一段路径：
 *
 *   /analsyis-node-report/:analysisNodeId/:view?
 *   例：/analsyis-node-report/2117819388907229184/scriptCode
 *
 * 约定：
 * 1. 只有 ROUTE_VIEWS 里登记过的名字才会被当成「视图段」，普通路径参数不会被误判；
 * 2. URL 省略视图段 = 使用 defaultView（默认视图不写进 URL，历史链接与标签页地址保持干净）；
 * 3. 切换视图用 replace 跳转；标签页「身份」用去掉视图段的 basePath 计算，
 *    所以切视图不会多出一个标签页，而标签页地址会跟着视图更新（切回来还是同一个视图）。
 *
 * 新增页面接入步骤：
 *   a. 路由加 `:view?`（hook 是从 pathname 末段识别视图名的，参数名不影响行为）；
 *   b. 在 ROUTE_VIEWS 里登记 views / defaultView；
 *   c. 组件里 `const [view, setView] = useRouteView<ViewKey>({ views: XXX_VIEWS, defaultView })`。
 *
 * 布局层（标签页 key / 标题）与页面层共用本文件，避免「白名单」两处维护不一致。
 */

export type RouteViewConfig = {
    /** 允许的视图名（同时用于判断「路径末段是不是视图段」）。 */
    readonly views: readonly string[];
    /** 默认视图：URL 省略视图段时使用，也不写进 URL。 */
    readonly defaultView: string;
};

/** 分析节点报告页底部结果区的视图（ViewResolver 的 view 名）。 */
export const ANALYSIS_NODE_REPORT_VIEWS = [
    "analysisResultDisplay",
    "scriptCode",
    "createOrUpdateScript",
    "nodeParams",
] as const;

export type AnalysisNodeReportView = (typeof ANALYSIS_NODE_REPORT_VIEWS)[number];

/** 已接入「视图段」的路由表：key 为一级路径。 */
export const ROUTE_VIEWS: Record<string, RouteViewConfig> = {
    "/analsyis-node-report": {
        views: ANALYSIS_NODE_REPORT_VIEWS,
        defaultView: "analysisResultDisplay",
    },
};

/** 一级路径，如 `/analsyis-node-report/123/scriptCode` → `/analsyis-node-report`。 */
const routeRootKey = (pathname: string): string => {
    const first = pathname.split("/").find(Boolean);
    return first ? `/${first}` : "/";
};

export type RouteViewSplit = {
    /** 去掉视图段后的路径；没有视图段时就是 pathname 本身。 */
    basePath: string;
    /** 命中的视图名；末段不在白名单里时为 undefined。 */
    view?: string;
    /** 该路由的视图配置；未登记视图段的路由为 undefined。 */
    config?: RouteViewConfig;
};

/**
 * 把 pathname 拆成「基础路径 + 视图名」。
 *
 * 只做纯字符串判断，不依赖 react-router 的 params 名字，因此布局层（标签页身份 /
 * 标签标题）也能直接用同一份规则，不必关心路由是怎么写的。
 */
export const splitRouteView = (pathname: string): RouteViewSplit => {
    const trimmed = (pathname || "/").replace(/\/+$/, "");
    const basePath = trimmed || "/";
    const config = ROUTE_VIEWS[routeRootKey(basePath)];
    if (!config) {
        return { basePath };
    }
    const segments = basePath.split("/").filter(Boolean);
    // 只有一级路径（/:view）时没有 id 段，不可能是视图段。
    if (segments.length < 2) {
        return { basePath, config };
    }
    const last = segments[segments.length - 1];
    if (!config.views.includes(last)) {
        return { basePath, config };
    }
    return { basePath: `/${segments.slice(0, -1).join("/")}`, view: last, config };
};

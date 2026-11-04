import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { splitRouteView } from "@/routes/route-view";

/**
 * 把「页面内的 ViewResolver 视图」存进 URL 的视图段，替代 `useState`。
 *
 * 路由需要留出视图段：`/analsyis-node-report/:analysisNodeId/:view?`，
 * 视图白名单与默认视图登记在 `@/routes/route-view` 的 ROUTE_VIEWS 里。
 *
 * ```tsx
 * // 路由页：视图随 URL 走，刷新 / 分享 / 标签页切换都能恢复
 * const [view, setView] = useRouteView<ViewKey>({ views, defaultView: "analysisResultDisplay" });
 *
 * // 弹窗、内嵌复用（没有对应路由）：enabled 关掉，hook 自动退化成 useState
 * const [view, setView] = useRouteView<ViewKey>({ views, defaultView, enabled: false });
 * ```
 *
 * 行为约定：
 * - URL 没有视图段 → 使用 defaultView；
 * - `setView(defaultView)` 会把视图段从 URL 移除（默认视图不写进 URL）；
 * - `setView` 默认 `replace` 跳转：切视图不污染浏览器历史，也不新增标签页；
 * - `setView` 同时支持函数式写法 `setView(prev => …)`，可以直接替换原来的 `useState` 用法。
 */
export type UseRouteViewOptions<V extends string> = {
    /** 允许的视图名；不传则用 ROUTE_VIEWS 里登记的列表。 */
    views?: readonly V[];
    /** 默认视图；不传则用 ROUTE_VIEWS 里登记的 defaultView。 */
    defaultView?: V;
    /**
     * 是否把视图同步到路由，默认 true。
     * 组件被弹窗 / 内嵌复用时必须传 false：那时 URL 指向的是别的页面，
     * 写回视图段会把用户正在看的页面改掉。
     */
    enabled?: boolean;
    /** 切换视图是否用 replace 跳转（默认 true，避免历史记录里堆满视图切换）。 */
    replace?: boolean;
};

export type SetRouteView<V extends string> = (next: V | ((prev: V) => V)) => void;

export const useRouteView = <V extends string = string>(
    options: UseRouteViewOptions<V> = {},
): [V, SetRouteView<V>] => {
    const {
        views: viewsOption,
        defaultView: defaultViewOption,
        enabled = true,
        replace = true,
    } = options;
    const navigate = useNavigate();
    const { pathname, search, state } = useLocation();

    const split = useMemo(() => splitRouteView(pathname), [pathname]);
    const config = split.config;
    // 只有「路由里登记过视图段」的页面才把视图写回 URL；
    // 弹窗 / 内嵌复用（URL 指向别的页面）自动退化为本地状态，避免改错地址。
    const routeSync = enabled && !!config;

    const views = (viewsOption ?? config?.views ?? []) as readonly V[];
    const fallbackView = (defaultViewOption ?? config?.defaultView ?? views[0]) as V | undefined;
    const routeView =
        split.view && views.includes(split.view as V) ? (split.view as V) : undefined;

    // 非路由模式下的状态；路由模式下只作为首帧兜底（URL 才是唯一数据源）。
    const [localView, setLocalView] = useState<V | undefined>(routeView ?? fallbackView);
    const view = (routeSync ? routeView ?? fallbackView : localView ?? fallbackView) as V;

    const setView = useCallback<SetRouteView<V>>(
        (next) => {
            const resolve = (prev: V | undefined): V =>
                typeof next === "function" ? (next as (p: V) => V)(prev as V) : next;

            if (!routeSync) {
                setLocalView(resolve(view));
                return;
            }

            const target = resolve(view);
            if (!target || target === view) {
                return;
            }
            // 默认视图不写进 URL：回到「干净的」地址，历史链接与已保存的标签页地址保持一致。
            const targetPath =
                target === fallbackView
                    ? split.basePath
                    : `${split.basePath}/${encodeURIComponent(target)}`;
            if (targetPath === pathname) {
                return;
            }
            navigate({ pathname: targetPath, search }, { replace, state });
        },
        [routeSync, view, fallbackView, split.basePath, pathname, search, state, navigate, replace],
    );

    return [view, setView];
};

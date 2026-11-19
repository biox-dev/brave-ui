import { useCallback, useEffect, useRef, useState } from "react";
import type { PageRequest, PageResponse } from "@/api/data";

/**
 * 统一的「懒加载 + 关键字搜索」列表模型。
 *
 * 设计目标（左侧栏所有页面共用）：
 * - 分页请求只负责「取下一页」，数据在本地累积，配合滚动到底部自动加载更多；
 * - 关键字走 `types.Pagination.keyword`（后端各分页接口统一支持），输入防抖后
 *   重置到第 1 页重新拉取；
 * - `scopeKey`（通常是当前激活项目）变化时自动重置；
 * - 用请求序号丢弃过期响应，避免快速输入关键字时旧结果覆盖新结果。
 *
 * 注意：`fetcher` 必须是稳定引用（模块级 API 函数或 `useCallback`），否则会反复重置。
 */
export interface UseLazyListOptions<TItem, TQuery extends object = Record<string, unknown>> {
	/** 分页请求函数（POST /xxx/page 一类接口）。 */
	fetcher: (payload: PageRequest<TQuery & { keyword?: string }>) => Promise<PageResponse<TItem>>;
	/** 固定查询条件（不随输入变化，例如筛选 id）。 */
	query?: TQuery;
	/** 每页条数，默认 20。 */
	pageSize?: number;
	/** 只用于触发重置的上下文（如当前项目 ID）。 */
	scopeKey?: unknown;
	/** 外部刷新令牌：值变化时重新加载第 1 页。 */
	reloadKey?: unknown;
	/** 是否启用（折叠面板可传 false 暂停请求）。 */
	enabled?: boolean;
	/** 关键字输入防抖毫秒数，默认 300。 */
	debounceMs?: number;
}

export interface UseLazyListResult<TItem> {
	items: TItem[];
	total: number;
	/** 输入框中的关键字（未防抖）。 */
	keyword: string;
	setKeyword: (value: string) => void;
	/** 首屏 / 重置加载中。 */
	loading: boolean;
	/** 追加下一页加载中。 */
	loadingMore: boolean;
	hasMore: boolean;
	error: unknown;
	/** 主动加载下一页（滚动到底部时自动调用）。 */
	loadMore: () => Promise<void>;
	/** 回到第 1 页重新加载（保留当前关键字）。 */
	reload: () => Promise<void>;
	/** 挂到底部哨兵元素上的 ref，用来触发自动加载。 */
	sentinelRef: (node: HTMLElement | null) => void;
}

export function useLazyList<TItem, TQuery extends object = Record<string, unknown>>(
	options: UseLazyListOptions<TItem, TQuery>
): UseLazyListResult<TItem> {
	const { fetcher, query, pageSize = 20, scopeKey, reloadKey, enabled = true, debounceMs = 300 } = options;

	// query / fetcher 用 ref 保存：调用方通常传字面量对象或内联函数，放进依赖会导致无限重置。
	const queryRef = useRef<TQuery | undefined>(query);
	queryRef.current = query;
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const [items, setItems] = useState<TItem[]>([]);
	const [total, setTotal] = useState(0);
	const [keyword, setKeywordState] = useState("");
	const [appliedKeyword, setAppliedKeyword] = useState("");
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const seqRef = useRef(0);
	const pageRef = useRef(1); // 下一次要请求的页码
	const loadedRef = useRef(0); // 已累积条数
	const hasMoreRef = useRef(false);
	const loadingRef = useRef(false);
	const loadingMoreRef = useRef(false);
	const enabledRef = useRef(enabled);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	const fetchPage = useCallback(
		async (page: number, kw: string, replace: boolean) => {
			const seq = ++seqRef.current;
			if (replace) {
				loadingRef.current = true;
				setLoading(true);
			} else {
				loadingMoreRef.current = true;
				setLoadingMore(true);
			}
			try {
				const response = await fetcherRef.current({
					...(queryRef.current ?? ({} as TQuery)),
					page,
					page_size: pageSize,
					...(kw ? { keyword: kw } : {}),
				});
				// 过期响应（关键字 / scopeKey 已变化）直接丢弃。
				if (seq !== seqRef.current) {
					return;
				}
				const rows = response?.data ?? [];
				const totalCount = response?.total ?? 0;
				const before = replace ? 0 : loadedRef.current;
				const after = before + rows.length;
				loadedRef.current = after;
				setItems((prev) => (replace ? rows : [...prev, ...rows]));
				setTotal(totalCount);
				pageRef.current = page + 1;
				hasMoreRef.current = rows.length > 0 && after < totalCount;
				setHasMore(hasMoreRef.current);
				setError(null);
			} catch (err) {
				if (seq !== seqRef.current) {
					return;
				}
				setError(err);
				if (replace) {
					setItems([]);
					setTotal(0);
					loadedRef.current = 0;
					hasMoreRef.current = false;
					setHasMore(false);
				}
			} finally {
				if (seq === seqRef.current) {
					loadingRef.current = false;
					loadingMoreRef.current = false;
					setLoading(false);
					setLoadingMore(false);
				}
			}
		},
		[pageSize]
	);

	const reload = useCallback(async () => {
		if (!enabledRef.current) {
			return;
		}
		await fetchPage(1, appliedKeyword, true);
	}, [fetchPage, appliedKeyword]);

	const loadMore = useCallback(async () => {
		if (!enabledRef.current || loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) {
			return;
		}
		await fetchPage(pageRef.current, appliedKeyword, false);
	}, [fetchPage, appliedKeyword]);

	// 关键字防抖：输入停止后才真正请求，并重置到第 1 页。
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setAppliedKeyword(keyword.trim());
		}, debounceMs);
		return () => window.clearTimeout(timer);
	}, [keyword, debounceMs]);

	// 关键字 / 上下文 / 刷新令牌变化 → 重新加载第一页。
	// 首次挂载也会执行（appliedKeyword 初始为空）。
	useEffect(() => {
		if (!enabled) {
			return;
		}
		void fetchPage(1, appliedKeyword, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [appliedKeyword, scopeKey, reloadKey, enabled, fetchPage]);

	// 底部哨兵：进入视口即追加下一页。
	const observerRef = useRef<IntersectionObserver | null>(null);
	const sentinelRef = useCallback(
		(node: HTMLElement | null) => {
			observerRef.current?.disconnect();
			observerRef.current = null;
			if (!node || typeof IntersectionObserver === "undefined") {
				return;
			}
			observerRef.current = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						void loadMore();
					}
				},
				{ rootMargin: "160px" }
			);
			observerRef.current.observe(node);
		},
		[loadMore]
	);

	useEffect(() => () => observerRef.current?.disconnect(), []);

	const setKeyword = useCallback((value: string) => {
		setKeywordState(value);
	}, []);

	return {
		items,
		total,
		keyword,
		setKeyword,
		loading,
		loadingMore,
		hasMore,
		error,
		loadMore,
		reload,
		sentinelRef,
	};
}

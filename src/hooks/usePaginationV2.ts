import { useCallback, useMemo, useState } from "react";
import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from "react-query";
import { http } from "@/api/client/http";
import type { AxiosError } from "axios";
import { pageDatasetByProjectApi, pageFileByProjectApi, pageSampleByProjectApi } from "@/api/data";
import type {
	DatasetFileItem,
	DatasetFilePageQuery,
	DatasetItem,
	DatasetPageQuery,
	SampleItem,
	SamplePageQuery,
	PageRequest,
	PageResponse,
} from "@/api/data";
import {
	pageAnalysisByProjectApi,
	type AnalysisItem,
	type AnalysisPageQuery,
	pageAnalysisNodeByProjectApi,
	type AnalysisNodeItem,
	type AnalysisNodePageQuery,
} from "@/api/analysis";
import {
	pageWorkflowApi,
	pageScriptApi,
	type WorkflowItem,
	type WorkflowPageQuery,
	type ScriptItem,
	type ScriptPageQuery,
} from "@/api/workflow";
import {
	pageProjectReportApi,
	type ProjectReportItem,
	type ProjectReportPageQuery,
} from "@/api/project";
import {
	pageAppSessionApi,
	pageContainerEventApi,
	pageContainerImageApi,
	pageContainerInstanceApi,
	pageContainerTemplateApi,
	pageOutboxEventApi,
	type AppSessionItem,
	type AppSessionPageQuery,
	type ContainerEventItem,
	type ContainerEventPageQuery,
	type ContainerImageItem,
	type ContainerImagePageQuery,
	type ContainerInstanceItem,
	type ContainerInstancePageQuery,
	type ContainerTemplateItem,
	type ContainerTemplatePageQuery,
	type OutboxEventItem,
	type OutboxEventPageQuery,
} from "@/api/container";
import {
	pageAgentEventApi,
	pageAgentPermissionApi,
	pageAgentTaskApi,
	type AgentEventItem,
	type AgentEventPageQuery,
	type AgentPermissionItem,
	type AgentPermissionPageQuery,
	type AgentTaskItem,
	type AgentTaskPageQuery,
} from "@/api/agent";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface UsePageQueryOptions<
	TItem,
	TQuery extends object,
	TError = AxiosError,
> {
	queryKey: QueryKey;
	endpoint?: string;
	query?: TQuery;
	initialPage?: number;
	initialPageSize?: number;
	enabled?: boolean;
	keepPreviousData?: boolean;
	staleTime?: number;
	cacheTime?: number;
	queryFn?: (payload: PageRequest<TQuery>) => Promise<PageResponse<TItem>>;
	select?: (response: PageResponse<TItem>) => PageResponse<TItem>;
	onError?: (error: TError) => void;
}

export interface UsePageQueryResult<TItem, TQuery extends object, TError = AxiosError>
	extends Omit<UseQueryResult<PageResponse<TItem>, TError>, "data" | "refetch"> {
	data: TItem[];
	total: number;
	page: number;
	pageSize: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
	query: TQuery;
	setQuery: (next: Partial<TQuery>) => void;
	resetQuery: () => void;
	setPage: (nextPage: number) => void;
	setPageSize: (nextSize: number) => void;
	nextPage: () => void;
	prevPage: () => void;
	goFirstPage: () => void;
	refetch: UseQueryResult<PageResponse<TItem>, TError>["refetch"];
}

const normalizePage = (page: number) => (Number.isFinite(page) && page > 0 ? Math.floor(page) : DEFAULT_PAGE);
const normalizePageSize = (pageSize: number) =>
	Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;

export function usePageQuery<TItem, TQuery extends object, TError = AxiosError>(
	options: UsePageQueryOptions<TItem, TQuery, TError>
): UsePageQueryResult<TItem, TQuery, TError> {
	const {
		queryKey,
		endpoint,
		query,
		initialPage = DEFAULT_PAGE,
		initialPageSize = DEFAULT_PAGE_SIZE,
		enabled = true,
		keepPreviousData = true,
		staleTime = 30_000,
		cacheTime = 5 * 60_000,
		queryFn,
		select,
		onError,
	} = options;

	const initialQuery = (query ?? ({} as TQuery));
	const [page, setPageState] = useState<number>(normalizePage(initialPage));
	const [pageSize, setPageSizeState] = useState<number>(normalizePageSize(initialPageSize));
	const [queryState, setQueryState] = useState<TQuery>(initialQuery);

	const payload = useMemo<PageRequest<TQuery>>(
		() => ({ ...queryState, page, page_size: pageSize }),
		[queryState, page, pageSize]
	);

	const mergedKey = useMemo<QueryKey>(
		() => (Array.isArray(queryKey) ? [...queryKey, payload] : [queryKey, payload]),
		[queryKey, payload]
	);

	const normalizedFetcher = async (): Promise<PageResponse<TItem>> => {
		if (queryFn) {
			return queryFn(payload);
		}

		if (!endpoint) {
			throw new Error("usePageQuery requires endpoint or queryFn");
		}

		const response = await http.post<PageResponse<TItem>>(endpoint, payload);
		return response.data;
	};

	const queryOptions: UseQueryOptions<PageResponse<TItem>, TError> = {
		enabled,
		keepPreviousData,
		staleTime,
		cacheTime,
		onError,
		select,
	};

	const result = useQuery<PageResponse<TItem>, TError>(mergedKey, normalizedFetcher, queryOptions);

	const responseData = result.data;
	const data = responseData?.data ?? [];
	const total = responseData?.total ?? 0;
	const hasNextPage = page * pageSize < total;
	const hasPrevPage = page > 1;

	const setPage = useCallback((nextPage: number) => {
		setPageState(normalizePage(nextPage));
	}, []);

	const setPageSize = useCallback((nextSize: number) => {
		const normalized = normalizePageSize(nextSize);
		setPageSizeState(normalized);
		setPageState(1);
	}, []);

	const setQuery = useCallback((next: Partial<TQuery>) => {
		setQueryState((prev) => ({ ...prev, ...next }));
		setPageState(1);
	}, []);

	const resetQuery = useCallback(() => {
		setQueryState(initialQuery);
		setPageState(1);
	}, [initialQuery]);

	const nextPage = useCallback(() => {
		if (hasNextPage) {
			setPageState((prev) => prev + 1);
		}
	}, [hasNextPage]);

	const prevPage = useCallback(() => {
		if (hasPrevPage) {
			setPageState((prev) => Math.max(1, prev - 1));
		}
	}, [hasPrevPage]);

	const goFirstPage = useCallback(() => {
		setPageState(1);
	}, []);

	return {
		...result,
		data,
		total,
		page,
		pageSize,
		hasNextPage,
		hasPrevPage,
		query: queryState,
		setQuery,
		resetQuery,
		setPage,
		setPageSize,
		nextPage,
		prevPage,
		goFirstPage,
		refetch: result.refetch,
	};
}

export const useDatasetProjectPageQuery = (
	query: DatasetPageQuery,
	options?: Omit<UsePageQueryOptions<DatasetItem, DatasetPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<DatasetItem, DatasetPageQuery>({
		queryKey: ["dataset-project-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageDatasetByProjectApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useDatasetFilePageQuery = (
	query: DatasetFilePageQuery,
	options?: Omit<UsePageQueryOptions<DatasetFileItem, DatasetFilePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<DatasetFileItem, DatasetFilePageQuery>({
		queryKey: ["dataset-file-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageFileByProjectApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useSampleProjectPageQuery = (
	query: SamplePageQuery,
	options?: Omit<UsePageQueryOptions<SampleItem, SamplePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<SampleItem, SamplePageQuery>({
		queryKey: ["sample-project-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageSampleByProjectApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAnalysisNodePageQuery = (
	query: AnalysisNodePageQuery,
	options?: Omit<UsePageQueryOptions<AnalysisNodeItem, AnalysisNodePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AnalysisNodeItem, AnalysisNodePageQuery>({
		queryKey: ["analysis-node-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageAnalysisNodeByProjectApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAnalysisPageQuery = (
	query: AnalysisPageQuery,
	options?: Omit<UsePageQueryOptions<AnalysisItem, AnalysisPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AnalysisItem, AnalysisPageQuery>({
		queryKey: ["analysis-page"],
		query,
		queryFn: async (payload) => {
			const { page, page_size, ...queryPayload } = payload;
			const response = await pageAnalysisByProjectApi({
				page,
				page_size,
				query: queryPayload,
			});
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useScriptPageQuery = (
	query: ScriptPageQuery,
	options?: Omit<UsePageQueryOptions<ScriptItem, ScriptPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ScriptItem, ScriptPageQuery>({
		queryKey: ["script-page"],
		query,
		queryFn: async (payload) => {
			const { page, page_size, ...queryPayload } = payload;
			const response = await pageScriptApi({
				page,
				page_size,
				query: queryPayload,
			});
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useWorkflowPageQuery = (
	query: WorkflowPageQuery,
	options?: Omit<UsePageQueryOptions<WorkflowItem, WorkflowPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<WorkflowItem, WorkflowPageQuery>({
		queryKey: ["workflow-page"],
		query,
		queryFn: async (payload) => {
			const { page, page_size, ...queryPayload } = payload;
			const response = await pageWorkflowApi({
				page,
				page_size,
				query: queryPayload,
			});
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useProjectReportPageQuery = (
	query: ProjectReportPageQuery,
	options?: Omit<UsePageQueryOptions<ProjectReportItem, ProjectReportPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ProjectReportItem, ProjectReportPageQuery>({
		queryKey: ["project-report-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageProjectReportApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useContainerImagePageQuery = (
	query: ContainerImagePageQuery,
	options?: Omit<UsePageQueryOptions<ContainerImageItem, ContainerImagePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ContainerImageItem, ContainerImagePageQuery>({
		queryKey: ["container-image-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageContainerImageApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useContainerTemplatePageQuery = (
	query: ContainerTemplatePageQuery,
	options?: Omit<UsePageQueryOptions<ContainerTemplateItem, ContainerTemplatePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ContainerTemplateItem, ContainerTemplatePageQuery>({
		queryKey: ["container-template-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageContainerTemplateApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAppSessionPageQuery = (
	query: AppSessionPageQuery,
	options?: Omit<UsePageQueryOptions<AppSessionItem, AppSessionPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AppSessionItem, AppSessionPageQuery>({
		queryKey: ["app-session-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageAppSessionApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useContainerInstancePageQuery = (
	query: ContainerInstancePageQuery,
	options?: Omit<UsePageQueryOptions<ContainerInstanceItem, ContainerInstancePageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ContainerInstanceItem, ContainerInstancePageQuery>({
		queryKey: ["container-instance-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageContainerInstanceApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useContainerEventPageQuery = (
	query: ContainerEventPageQuery,
	options?: Omit<UsePageQueryOptions<ContainerEventItem, ContainerEventPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<ContainerEventItem, ContainerEventPageQuery>({
		queryKey: ["container-event-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageContainerEventApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useOutboxEventPageQuery = (
	query: OutboxEventPageQuery,
	options?: Omit<UsePageQueryOptions<OutboxEventItem, OutboxEventPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<OutboxEventItem, OutboxEventPageQuery>({
		queryKey: ["outbox-event-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageOutboxEventApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAgentTaskPageQuery = (
	query: AgentTaskPageQuery,
	options?: Omit<UsePageQueryOptions<AgentTaskItem, AgentTaskPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AgentTaskItem, AgentTaskPageQuery>({
		queryKey: ["agent-task-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageAgentTaskApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAgentPermissionPageQuery = (
	query: AgentPermissionPageQuery,
	options?: Omit<UsePageQueryOptions<AgentPermissionItem, AgentPermissionPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AgentPermissionItem, AgentPermissionPageQuery>({
		queryKey: ["agent-permission-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageAgentPermissionApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

export const useAgentEventPageQuery = (
	query: AgentEventPageQuery,
	options?: Omit<UsePageQueryOptions<AgentEventItem, AgentEventPageQuery>, "queryKey" | "query" | "endpoint" | "queryFn">
) => {
	return usePageQuery<AgentEventItem, AgentEventPageQuery>({
		queryKey: ["agent-event-page"],
		query,
		queryFn: async (payload) => {
			const response = await pageAgentEventApi(payload);
			return response.data;
		},
		initialPageSize: 10,
		...options,
	});
};

import { useQuery } from 'react-query';
import { listAllAgentSessionResourcesApi, type AgentSessionResourceGroups } from '@/api/agent';

/** 会话结果分组数据的 React Query key 前缀（后面拼 sessionId）。 */
export const AGENT_SESSION_RESOURCES_QUERY_KEY = 'agent-session-resources';

/** 空分组：New Chat / 清空会话结果时作为稳定的返回值，避免每帧新建对象。 */
export const EMPTY_SESSION_RESOURCE_GROUPS: AgentSessionResourceGroups = {
  script: [],
  workflow: [],
  analysis: [],
  analysis_node: [],
  project_report: [],
  plan: [],
};

/**
 * 会话结果分组数据：**一次请求拿到全部资源类型**（`/agent/session/resources/all`）。
 *
 * 会话页与右侧每个分区共用同一个 query key，React Query 自动去重，
 * 因此无论渲染多少个分区都只会发一次请求；任意一处刷新都会更新这份共享数据。
 *
 * `enabled` 由调用方传入：右侧堆叠面板折叠时不请求接口，展开时才请求。
 * `cleared` 用于 New Chat：既不发请求，也把已缓存的数据隐藏成空分组
 * （清空某个会话的结果后，右侧面板要立刻消失而不是继续显示旧数据）。
 */
export const useAgentSessionResources = (
  sessionId: string | undefined,
  enabled: boolean,
  cleared = false,
) => {
  const query = useQuery(
    [AGENT_SESSION_RESOURCES_QUERY_KEY, sessionId],
    async () => {
      const response = await listAllAgentSessionResourcesApi(sessionId!);
      return response.data.data;
    },
    {
      enabled: Boolean(sessionId) && enabled && !cleared,
      staleTime: 30_000,
    },
  );

  if (cleared) {
    return { ...query, data: EMPTY_SESSION_RESOURCE_GROUPS };
  }
  return query;
};

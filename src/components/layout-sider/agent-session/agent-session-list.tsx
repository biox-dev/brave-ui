import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Flex, Popconfirm, Spin, Tooltip } from 'antd';
import {
  CommentOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { LazyListSearch } from '@/components/common/lazy-list';
import { useI18n } from '@/hooks/useI18n';
import type { AgentConversationItem } from '@/api/agent';
import {
  ensureAgentConversations,
  loadAgentConversations,
  loadMoreAgentConversations,
  removeAgentConversation,
  setAgentConversationKeyword,
  updateAgentConversationTitle,
  useAgentConversationStore,
} from '@/components/agent/agent-conversation-store';
import { BROADCAST_ID, useComponentStore } from '@/event-bus/stores/components';
import { formatRelativeTime } from '@/utils/time';
import SiderPanelLayout from '../common/sider-panel-layout';
import './agent-session-list.css';

/**
 * 从 pathname 解析当前 Agent 会话 ID。
 *
 * 左侧面板由布局层渲染（不在 `/session/:sessionId` 的路由元素内），因此拿不到
 * `useParams()`，只能从地址解析。与路由保持一致：`/session/:sessionId?`。
 */
const parseAgentSessionId = (pathname: string): string | undefined => {
  const path = (pathname || '').split('?')[0].split('#')[0];
  const match = /^\/session(?:\/([^/]+))?\/?$/.exec(path);
  if (!match?.[1]) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const isValidTaskId = (id?: string): boolean => !!id && id !== '0';

const conversationTitle = (item: AgentConversationItem): string => {
  const title = item.title?.trim();
  return title || item.id;
};

/** 关键字输入防抖（毫秒）。 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 左侧活动栏的「Agent 会话」面板。
 *
 * 会话按项目维度展示（后端按当前激活项目过滤，不再限定发起人），因此每条会话
 * 额外显示发起人用户名。列表采用懒加载：滚动到底部自动加载下一页；顶部搜索框
 * 按标题 / 用户名做服务端关键字搜索，结果按 updated_at 倒序。
 * 点击会话 → `/session/:sessionId`；New Chat → `/session`（新建会话）。
 */
export interface AgentSessionListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const AgentSessionList: FC<AgentSessionListProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeSessionId = parseAgentSessionId(pathname);
  const conversations = useAgentConversationStore((state) => state.conversations);
  const loading = useAgentConversationStore((state) => state.loading);
  const loadingMore = useAgentConversationStore((state) => state.loadingMore);
  const loaded = useAgentConversationStore((state) => state.loaded);
  const hasMore = useAgentConversationStore((state) => state.hasMore);
  const total = useAgentConversationStore((state) => state.total);
  const storeKeyword = useAgentConversationStore((state) => state.keyword);
  const [keyword, setKeyword] = useState(storeKeyword);
  // 正在删除的会话 ID：只让对应行的删除按钮转圈，避免整张列表重渲染。
  const [deletingId, setDeletingId] = useState<string | undefined>(undefined);

  // 只在挂载时加载一次（已加载过则跳过）。
  // 不要监听 pathname：切换会话 / New Chat 都不改变列表数据，刷新由真正改变数据的
  // 动作（新建会话 / 轮次结束 / fork，见 agent-chat.tsx）显式触发。
  useEffect(() => {
    void ensureAgentConversations();
  }, []);

  // 切换项目后会话列表属于旧项目（后端按当前激活项目过滤），需要重新拉取。
  // 首次加载（"" → 项目 ID）不在这里刷新，交由上面的 ensureAgentConversations 处理。
  const projectId = useSelector(
    (state: { user: { projectId?: string } }) => state.user.projectId
  );
  const prevProjectIdRef = useRef(projectId);
  useEffect(() => {
    const prev = prevProjectIdRef.current;
    prevProjectIdRef.current = projectId;
    if (!prev || !projectId || prev === projectId) {
      return;
    }
    void loadAgentConversations();
  }, [projectId]);

  const { register, unregister } = useComponentStore();
  const realtimeInstance = useMemo(
    () => ({
      sessionTitleUpdated: (args?: any) => {
        // 后端以字符串下发 session_id（雪花 ID 超出 JS 安全整数范围）。
        const sessionID = String(args?.session_id ?? '').trim();
        const title = String(args?.title ?? '').trim();
        if (sessionID && title) {
          updateAgentConversationTitle(sessionID, title);
        }
      },
    }),
    []
  );
  useEffect(() => {
    register('agent-session', BROADCAST_ID, realtimeInstance);
    return () => unregister('agent-session', BROADCAST_ID, realtimeInstance);
  }, [register, unregister, realtimeInstance]);

  // 输入防抖后交给 store 做服务端搜索（重置到第一页）。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void setAgentConversationKeyword(keyword);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // 底部哨兵：进入视口即追加下一页。
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreAgentConversations();
        }
      },
      { rootMargin: '160px' }
    );
    observerRef.current.observe(node);
  }, []);
  useEffect(() => () => observerRef.current?.disconnect(), []);

  const labels = {
    title: locale === 'en_US' ? 'Agent Sessions' : '智能体会话',
    newChat: locale === 'en_US' ? 'New Chat' : '新建会话',
    refresh: locale === 'en_US' ? 'Refresh sessions' : '刷新会话',
    empty: locale === 'en_US' ? 'No sessions yet' : '暂无会话',
    search: locale === 'en_US' ? 'Search sessions' : '搜索会话',
    loadingMore: locale === 'en_US' ? 'Loading more…' : '加载中…',
    noMore: locale === 'en_US' ? 'No more sessions' : '没有更多会话',
    total: locale === 'en_US' ? 'total' : '共',
    unknownUser: locale === 'en_US' ? 'Unknown user' : '未知用户',
    delete: locale === 'en_US' ? 'Delete session' : '删除会话',
    deleteConfirm:
      locale === 'en_US'
        ? 'Delete this session? Its messages, tasks and related data will be removed. Generated scripts/workflows are kept.'
        : '确定删除该会话？消息、任务等关联数据将一并删除，已生成的脚本 / 工作流等资源会保留。',
    deleteOk: locale === 'en_US' ? 'Delete' : '删除',
    deleteCancel: locale === 'en_US' ? 'Cancel' : '取消',
  };

  const handleDelete = useCallback(
    async (item: AgentConversationItem) => {
      setDeletingId(item.id);
      try {
        await removeAgentConversation(item.id);
        // 删除的是当前打开的会话时，回到新建会话页，避免停留在已删除的会话上。
        if (item.id === activeSessionId) {
          navigate('/session', { replace: true });
        }
      } catch {
        // 错误由全局拦截器提示（如会话仍有正在执行的一轮任务时返回 409）。
      } finally {
        setDeletingId(undefined);
      }
    },
    [activeSessionId, navigate]
  );

  const metaText = (item: AgentConversationItem): string => {
    const time = item.updated_at
      ? formatRelativeTime(item.updated_at, locale)
      : '';
    const user = item.username?.trim();
    if (user && time) {
      return `${user} · ${time}`;
    }
    return user || time;
  };

  return (
    <SiderPanelLayout
      className="agent-session-list"
      bodyClassName="agent-session-list-body"
      title={labels.title}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder={labels.search}
            className="project-report-panel-search"
          />
          <Tooltip title={labels.refresh}>
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined spin={loading} />}
              aria-label={labels.refresh}
              onClick={() => void loadAgentConversations()}
            />
          </Tooltip>
          <Tooltip title={labels.newChat}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              aria-label={labels.newChat}
              onClick={() => navigate('/session')}
            />
          </Tooltip>
        </>
      }
    >
      {!loaded && loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin size="small" />
        </Flex>
      ) : conversations.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={labels.empty}
          style={{ marginTop: 24 }}
        />
      ) : (
        <>
          {conversations.map((item) => {
            const isActive = item.id === activeSessionId;
            const meta = metaText(item);
            const username = item.username?.trim();
            return (
              <div key={item.id} className="agent-session-row">
                <button
                  type="button"
                  className={`agent-session-item${isActive ? ' is-active' : ''}`}
                  title={`${conversationTitle(item)}${username ? ` · ${username}` : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => navigate(`/session/${encodeURIComponent(item.id)}`)}
                >
                  <span className="agent-session-item-icon">
                    <CommentOutlined />
                  </span>
                  <span className="agent-session-item-text">
                    <span className="agent-session-item-title">{conversationTitle(item)}</span>
                    <span className="agent-session-item-meta">
                      <UserOutlined className="agent-session-item-meta-user" />
                      {meta || labels.unknownUser}
                    </span>
                  </span>
                  {isValidTaskId(item.current_task_id) && (
                    <span className="agent-session-item-dot" aria-hidden />
                  )}
                </button>
                <Popconfirm
                  title={labels.deleteConfirm}
                  okText={labels.deleteOk}
                  cancelText={labels.deleteCancel}
                  okButtonProps={{ danger: true }}
                  placement="right"
                  onConfirm={() => handleDelete(item)}
                >
                  <Button
                    className="agent-session-item-delete"
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={labels.delete}
                    loading={deletingId === item.id}
                  />
                </Popconfirm>
              </div>
            );
          })}
          <div ref={sentinelRef} className="agent-session-list-sentinel" aria-hidden />
          {loadingMore ? (
            <div className="agent-session-list-footer">
              <Spin size="small" />
              <span>{labels.loadingMore}</span>
            </div>
          ) : !hasMore ? (
            <div className="agent-session-list-footer">
              {labels.noMore}
              {total > 0 ? ` · ${labels.total} ${total}` : ''}
            </div>
          ) : null}
        </>
      )}
    </SiderPanelLayout>
  );
};

export default AgentSessionList;

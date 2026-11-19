import { FC, useEffect } from 'react';
import { Button, Empty, Flex, Spin, Tooltip } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CommentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '@/hooks/useI18n';
import type { AgentConversationItem } from '@/api/agent';
import { loadAgentConversations, ensureAgentConversations, useAgentConversationStore } from './agent-conversation-store';
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

const formatTime = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

/**
 * 左侧活动栏的「Agent 会话」面板。
 *
 * 原先是 `agent-chat.tsx` 头部的「会话下拉 + New Chat」：现在会话导航属于全局入口，
 * 抽成独立视图后由布局层挂载，聊天页只负责当前会话的内容。
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
  const loaded = useAgentConversationStore((state) => state.loaded);

  // 只在挂载时加载一次（已加载过则跳过）。
  // 不要监听 pathname：切换会话 / New Chat 都不改变列表数据，刷新由真正改变数据的
  // 动作（新建会话 / 轮次结束 / fork，见 agent-chat.tsx）显式触发。
  useEffect(() => {
    void ensureAgentConversations();
  }, []);

  const labels = {
    title: locale === 'en_US' ? 'Agent Sessions' : '智能体会话',
    newChat: locale === 'en_US' ? 'New Chat' : '新建会话',
    refresh: locale === 'en_US' ? 'Refresh sessions' : '刷新会话',
    empty: locale === 'en_US' ? 'No sessions yet' : '暂无会话',
  };

  return (
    <div className={`agent-session-list${collapsed ? ' is-collapsed' : ''}`}>
      <div className="agent-session-list-header">
        {onToggleCollapse ? (
          <button
            type="button"
            className="agent-session-list-title project-report-panel-title-button"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <CaretRightOutlined className="project-report-panel-chevron" />
            ) : (
              <CaretDownOutlined className="project-report-panel-chevron" />
            )}
            <span>{labels.title}</span>
          </button>
        ) : (
          <span className="agent-session-list-title">{labels.title}</span>
        )}
        <Flex align="center" gap={2}>
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
        </Flex>
      </div>
      <div
        className="agent-session-list-body"
        style={collapsed ? { display: 'none' } : undefined}
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
          conversations.map((item) => {
            const isActive = item.id === activeSessionId;
            const time = formatTime(item.updated_at);
            return (
              <button
                key={item.id}
                type="button"
                className={`agent-session-item${isActive ? ' is-active' : ''}`}
                title={conversationTitle(item)}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(`/session/${encodeURIComponent(item.id)}`)}
              >
                <span className="agent-session-item-icon">
                  <CommentOutlined />
                </span>
                <span className="agent-session-item-text">
                  <span className="agent-session-item-title">{conversationTitle(item)}</span>
                  {time && <span className="agent-session-item-meta">{time}</span>}
                </span>
                {isValidTaskId(item.current_task_id) && (
                  <span className="agent-session-item-dot" aria-hidden />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AgentSessionList;

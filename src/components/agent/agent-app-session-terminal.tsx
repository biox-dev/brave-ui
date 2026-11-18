import { FC } from 'react';
import { Empty } from 'antd';
import AnalysisNodeTerminal from '@/components/container-manager/analysis-node-terminal';
import { containerTemplateTerminalUrl } from '@/api/container-template-terminal';

export interface AgentAppSessionTerminalProps {
  /**
   * 应用会话 ID（= 终端会话 ID = `AppSession.ID`）。
   *
   * 后端终端 WS 路由 `/container/terminal/session/{id}/terminal` 的 `{id}` 就是它：
   * 会话不在内存时后端会按记录认领原容器 / 重建 shell，所以前端只需要这个 ID。
   */
  session_id?: string;
  /** 会话展示名（只在终端首行提示里显示）。 */
  name?: string;
  /**
   * 由会话页注入：关闭承载本视图的工作区标签。
   * 点终端右上角「移到底部面板」时，打开底部标签后会调它把右侧标签关掉（= 移动）。
   */
  onCloseTab?: () => void;
}

/**
 * 右侧工作区（SplitWorkspace 的 rightMiddle）里的应用会话终端。
 *
 * 只是 `AnalysisNodeTerminal` 的一层薄包装：
 * - 连接地址与底部面板终端共用 `containerTemplateTerminalUrl(session_id)`；
 * - `height="100%"` 由外层 flex 容器给高度（卡片 body 已是定高 flex 区域）；
 * - `moveToBottom` 把「移到底部面板」的入口交给终端组件本身，
 *   移动后通过 `onCloseTab` 关掉右侧标签（底部标签由终端组件自己打开）。
 */
const AgentAppSessionTerminal: FC<AgentAppSessionTerminalProps> = ({
  session_id,
  name,
  onCloseTab,
}) => {
  const sessionId = String(session_id ?? '').trim();

  if (!sessionId) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Missing session_id"
        style={{ marginTop: 48 }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 320,
      }}
    >
      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <AnalysisNodeTerminal
          id={sessionId}
          name={name}
          terminalUrl={containerTemplateTerminalUrl(sessionId)}
          height="100%"
          padding={6}
          borderRadius={0}
          moveToBottom={{
            sessionId,
            title: name,
            onMoved: onCloseTab,
          }}
        />
      </div>
    </div>
  );
};

export default AgentAppSessionTerminal;

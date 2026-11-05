import { Empty } from 'antd';
import { containerTemplateTerminalUrl } from '@/api/container-template-terminal';
import AnalysisNodeTerminal from '@/components/container-manager/analysis-node-terminal';
import type { BottomTabRenderProps } from './bottom-panel-registry';

/**
 * 底部面板的终端会话标签。
 *
 * 参数来自标签的 `params.session_id`：终端会话由后端 create 接口创建（容器已启动），
 * 这里只按会话 ID 建立 WebSocket 连接；刷新页面后恢复标签会重连同一会话并回放历史输出。
 *
 * 连接地址只依赖 `session_id`，标签参数里不再保存模板 ID。
 */
const BottomPanelTerminal = ({ tab }: BottomTabRenderProps) => {
  const raw = tab.params?.session_id;
  const sessionId = raw == null ? '' : String(raw).trim();

  if (!sessionId) {
    return (
      <div className="layout-bottom-panel-placeholder">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Missing session_id" />
      </div>
    );
  }

  return (
    <div className="layout-bottom-panel-terminal-frame">
      <AnalysisNodeTerminal
        id={sessionId}
        name={tab.title}
        terminalUrl={containerTemplateTerminalUrl(sessionId)}
        height="100%"
        padding={6}
        borderRadius={0}
        className="layout-bottom-panel-terminal-surface"
      />
    </div>
  );
};

export default BottomPanelTerminal;

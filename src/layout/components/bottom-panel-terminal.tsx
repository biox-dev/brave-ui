import { Empty } from 'antd';
import { containerTemplateTerminalUrl } from '@/api/container-template-terminal';
import AnalysisNodeTerminal from '@/components/container-manager/analysis-node-terminal';
import type { BottomTabRenderProps } from './bottom-panel-registry';

/**
 * 底部面板的容器模板终端标签。
 *
 * 参数来自标签的 `params.template_id`（后端保存的就是这个值），
 * 因此刷新页面后恢复标签会重新建立 WebSocket；后端的会话注册表按
 * (userID, projectID, templateID) 复用同一个 PTY，关闭标签默认立即删除容器。
 */
const BottomPanelTerminal = ({ tab }: BottomTabRenderProps) => {
  const raw = tab.params?.template_id;
  const templateId = raw == null ? '' : String(raw).trim();

  if (!templateId) {
    return (
      <div className="layout-bottom-panel-placeholder">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Missing template_id" />
      </div>
    );
  }

  return (
    <AnalysisNodeTerminal
      id={templateId}
      name={tab.title}
      terminalUrl={containerTemplateTerminalUrl(templateId)}
      height="100%"
      padding={0}
    />
  );
};

export default BottomPanelTerminal;

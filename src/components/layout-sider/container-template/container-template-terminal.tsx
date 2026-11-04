import { Alert } from "antd";
import { containerTemplateTerminalUrl } from "@/api/container-template-terminal";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";

export interface ContainerTemplateTerminalProps {
  /** 终端会话 ID（会话由 `/container/terminal/session/create` 创建，容器已启动）。 */
  session_id: string | number;
  /** 弹窗标题里展示的名称。 */
  name?: string;
}

/**
 * 终端会话（invoke 弹窗形态）。
 *
 * 只按会话 ID 连接 WebSocket；会话与容器在「新建终端会话」时已创建，
 * 关闭弹窗只是断开连接，不会删除容器（需在左侧栏「终端会话」列表里显式关闭）。
 */
const ContainerTemplateTerminal = ({ session_id, name }: ContainerTemplateTerminalProps) => {
  if (!session_id) {
    return null;
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="Detaching from this terminal does not delete the container. Close the session from the Terminal Sessions panel."
      />
      <AnalysisNodeTerminal
        id={String(session_id)}
        name={name}
        terminalUrl={containerTemplateTerminalUrl(session_id)}
      />
    </>
  );
};

export default ContainerTemplateTerminal;

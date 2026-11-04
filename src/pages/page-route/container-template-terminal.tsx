import { FC } from "react";
import { useParams } from "react-router";
import { Alert } from "antd";
import { containerTemplateTerminalUrl } from "@/api/container-template-terminal";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";

/**
 * 终端会话页面（路由形态）：`/container-template-terminal/:sessionId`。
 *
 * 终端会话由 `/container/terminal/session/create` 创建（容器已启动），这里只按会话 ID
 * 连接 WebSocket；离开路由只是断开连接，不会删除容器——
 * 显式关闭请到左侧栏「终端会话」列表。
 */
const ContainerTemplateTerminalRoute: FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (!sessionId) {
    return null;
  }

  return (
    <div style={{ padding: 8 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="Leaving this page only detaches the terminal session. Close the session from the Terminal Sessions panel to delete its container."
      />
      <AnalysisNodeTerminal id={sessionId} terminalUrl={containerTemplateTerminalUrl(sessionId)} />
    </div>
  );
};

export default ContainerTemplateTerminalRoute;

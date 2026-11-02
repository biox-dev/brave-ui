import { FC } from "react";
import { useParams } from "react-router";
import { Alert } from "antd";
import { containerTemplateTerminalUrl } from "@/api/container-template-terminal";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";

/**
 * 容器模板临时终端页面（路由形态）。
 *
 * 从容器模板列表点击行进入：`/container-template-terminal/:templateId`。
 * 与 invoke 弹窗共用同一个 WebSocket 地址，关闭标签页/离开路由即断开连接并删除容器。
 */
const ContainerTemplateTerminalRoute: FC = () => {
  const { templateId } = useParams<{ templateId: string }>();

  if (!templateId) {
    return null;
  }

  return (
    <div style={{ padding: 8 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="This terminal runs in a temporary container created from this template. Closing the terminal deletes the container."
      />
      <AnalysisNodeTerminal
        id={templateId}
        terminalUrl={containerTemplateTerminalUrl(templateId)}
      />
    </div>
  );
};

export default ContainerTemplateTerminalRoute;

import { Alert } from "antd";
import { containerTemplateTerminalUrl } from "@/api/container-template-terminal";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";

export interface ContainerTemplateTerminalProps {
  /** 容器模板定义 ID（后端据此创建一次性容器并 exec bash）。 */
  template_id: string | number;
  /** 弹窗标题里展示的模板名称。 */
  name?: string;
}

/**
 * 容器模板临时终端（invoke 弹窗形态）。
 *
 * 后端按当前用户激活项目 + 模板创建一次性容器并 exec /bin/bash -l；
 * WebSocket 关闭时自动删除该容器，因此关闭弹窗即完成清理。
 */
const ContainerTemplateTerminal = ({ template_id, name }: ContainerTemplateTerminalProps) => {
  if (!template_id) {
    return null;
  }

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="This terminal runs in a temporary container created from this template. Closing the terminal deletes the container."
      />
      <AnalysisNodeTerminal
        id={template_id}
        name={name}
        terminalUrl={containerTemplateTerminalUrl(template_id)}
      />
    </>
  );
};

export default ContainerTemplateTerminal;

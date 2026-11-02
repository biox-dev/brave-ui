import { getPathname } from "@/utils/utils";

/**
 * xterm.js 连接「容器模板临时终端」的 WebSocket 地址。
 *
 * 后端会按当前用户激活项目 + 模板创建一次性容器并 exec /bin/bash -l；
 * WebSocket 关闭时自动删除该容器，因此关闭弹窗即完成清理。
 */
export const containerTemplateTerminalUrl = (templateId: string | number) => {
  const base = getPathname().replace(/^http/, "ws");
  return `${base}/api/v1/container/template/${encodeURIComponent(String(templateId))}/terminal`;
};

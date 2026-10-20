import { getPathname } from "@/utils/utils";

/**
 * xterm.js 连接运行中分析节点容器的 WebSocket 地址。
 *
 * 后端会调用 kubectl exec -it / docker exec -it 打开 /bin/bash；
 * 只有该节点的容器处于 running 时才能连接。
 */
export const analysisNodeTerminalUrl = (id: string | number) => {
  // getPathname() 返回 origin + 当前部署前缀（例如 http://host 或 http://host/brave）。
  // WebSocket 需要同名部署前缀，因此复用同一份 base，只把 http(s) 换成 ws(s)。
  const base = getPathname().replace(/^http/, "ws");
  return `${base}/api/v1/analysis/node/${encodeURIComponent(String(id))}/terminal`;
};

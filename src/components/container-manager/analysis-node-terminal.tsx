import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { analysisNodeTerminalUrl } from "@/api/analysis-node-terminal";

interface AnalysisNodeTerminalProps {
  id: string | number;
  name?: string;
  /** 可选：覆盖默认的分析节点终端地址（容器模板临时终端复用本组件）。 */
  terminalUrl?: string;
  /**
   * 终端容器高度。弹窗里用默认 70vh；嵌入底部面板时传 "100%"（父级已定高）。
   */
  height?: number | string;
  /** 终端内边距。底部面板需要铺满时传 0。 */
  padding?: number;
}

/**
 * xterm.js 终端：通过 WebSocket 连接到运行中的分析节点容器 / 容器模板终端。
 *
 * 协议：
 *   - 浏览器 -> 后端：二进制/文本都是按键输入；文本 {"type":"resize",...} 是终端尺寸控制帧。
 *   - 后端 -> 浏览器：二进制是输出字节流；文本可能是纯提示，也可能是 JSON 控制事件
 *     （session / exec / exit，由容器模板终端的会话注册表下发）。
 */
const AnalysisNodeTerminal = ({
  id,
  name,
  terminalUrl,
  height = "70vh",
  padding = 8,
}: AnalysisNodeTerminalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !id) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontSize: 13,
      fontFamily:
        'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: { background: "#1e1e1e" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(element);
    fitAddon.fit();
    term.writeln(`\x1b[90mconnecting to ${name || id}...\x1b[0m`);

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    // 断线重连时带上「已消费的字节序号」，后端从该位置重放，避免整屏重复。
    let consumedBytes = 0;

    const decoder = new TextDecoder("utf-8");

    /** 处理后端文本帧：JSON 控制事件 -> 本地提示；其它原样写入。 */
    const handleControlText = (text: string) => {
      if (!text.trim().startsWith("{")) {
        term.write(text);
        return;
      }
      let event: Record<string, unknown> | null = null;
      try {
        event = JSON.parse(text) as Record<string, unknown>;
      } catch {
        term.write(text);
        return;
      }
      const type = typeof event?.type === "string" ? event.type : "";
      if (!type) {
        term.write(text);
        return;
      }
      if (type === "exec") {
        const phase = String(event.phase ?? "");
        const source = String(event.source ?? "agent");
        if (phase === "start") {
          const command = String(event.command ?? "");
          term.writeln(`\r\n\x1b[90m[${source}] $ ${command}\x1b[0m`);
        } else {
          const code = Number(event.exit_code ?? 0);
          const timedOut = Boolean(event.timed_out);
          if (timedOut) {
            term.writeln(`\x1b[90m[${source}] command timed out\x1b[0m`);
          } else if (Number.isFinite(code) && code !== 0) {
            term.writeln(`\x1b[90m[${source}] exit ${code}\x1b[0m`);
          }
        }
      } else if (type === "exit") {
        term.writeln("\r\n\x1b[90msession exited\x1b[0m");
      }
      // session / 其它事件只用于内部状态同步，不打印。
    };

    const connect = () => {
      if (disposed) {
        return;
      }
      const baseUrl = terminalUrl || analysisNodeTerminalUrl(id);
      const url =
        consumedBytes > 0
          ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}since=${consumedBytes}`
          : baseUrl;
      socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";

      const sendResize = () => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
          );
        }
      };

      socket.onopen = () => {
        sendResize();
        term.focus();
      };
      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          handleControlText(event.data);
          return;
        }
        const chunk = decoder.decode(event.data, { stream: true });
        consumedBytes += (event.data as ArrayBuffer).byteLength;
        term.write(chunk);
      };
      socket.onerror = () => {
        term.writeln("\r\n\x1b[31mwebsocket error\x1b[0m");
      };
      socket.onclose = () => {
        if (disposed) {
          return;
        }
        // 会话在后端有 grace period，断线后自动重连即可续上（并重放历史）。
        term.writeln("\r\n\x1b[90mconnection closed, reconnecting...\x1b[0m");
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 1500);
      };
    };

    connect();

    const dataDisposable = term.onData((data) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
    const resizeDisposable = term.onResize(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
        );
      }
    });

    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore fit errors while the modal is closing
      }
    });
    observer.observe(element);

    // 首次打开后 fit 一次，避免 modal 动画期间尺寸为 0。
    const timer = window.setTimeout(() => {
      try {
        fitAddon.fit();
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
          );
        }
      } catch {
        // ignore
      }
    }, 100);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      socket?.close();
      term.dispose();
    };
  }, [id, name, terminalUrl]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        padding,
        background: "#1e1e1e",
        borderRadius: 6,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    />
  );
};

export default AnalysisNodeTerminal;

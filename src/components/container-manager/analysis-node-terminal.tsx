import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { analysisNodeTerminalUrl } from "@/api/analysis-node-terminal";

interface AnalysisNodeTerminalProps {
  id: string | number;
  name?: string;
}

/**
 * xterm.js 终端：通过 WebSocket 连接到运行中的分析节点容器。
 *
 * 协议：
 *   - 浏览器 -> 后端：二进制/文本都是按键输入；文本 {"type":"resize",...} 是终端尺寸控制帧。
 *   - 后端 -> 浏览器：二进制输出字节流。
 */
const AnalysisNodeTerminal = ({ id, name }: AnalysisNodeTerminalProps) => {
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

    const socket = new WebSocket(analysisNodeTerminalUrl(id));
    socket.binaryType = "arraybuffer";
    const decoder = new TextDecoder("utf-8");

    const sendResize = () => {
      if (socket.readyState === WebSocket.OPEN) {
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
        term.write(event.data);
        return;
      }
      term.write(decoder.decode(event.data, { stream: true }));
    };
    socket.onerror = () => {
      term.writeln("\r\n\x1b[31mwebsocket error\x1b[0m");
    };
    socket.onclose = () => {
      term.writeln("\r\n\x1b[90mconnection closed\x1b[0m");
    };

    const dataDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
    const resizeDisposable = term.onResize(() => sendResize());

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
        sendResize();
      } catch {
        // ignore
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      socket.close();
      term.dispose();
    };
  }, [id, name]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "70vh",
        padding: 8,
        background: "#1e1e1e",
        borderRadius: 6,
      }}
    />
  );
};

export default AnalysisNodeTerminal;

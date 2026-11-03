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
    // 续传位置统一以「服务端序号」为准：
    //   - 服务端每次 attach 都会先下发 {type:"session", seq, reset, truncated, ...}；
    //   - seq 是本次回放结束时的输出序号（环形缓冲里的全局偏移，不是本地字节计数）；
    //   - 之后再收到多少字节就往下加多少，重连时把 seq + 新字节数 作为 since 传回去。
    // 不要自己从 0 数字节：缓冲滚动（bufStart>0）或会话被重建/认领后序号基准会变，
    // 那样会续传到错误位置，甚至 since 超出当前序号导致空回放、历史全丢。
    let hasServerSeq = false;
    let serverSeq = 0;
    let bytesSinceSeq = 0;
    // true = 终端宽度已锁定为服务端 PTY 的宽度（见 session 事件处理）。
    // 锁定后不再 fit / 不再发 resize：PTY 宽度一变，bash 就会按旧宽度重绘提示符，
    // 把已经回放出来的历史行覆盖掉。
    let lockToPty = false;

    /** 把当前 xterm 尺寸同步给后端；锁定 PTY 宽度后不再发送。 */
    const pushResize = () => {
      if (lockToPty || socket?.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(
        JSON.stringify({ type: "resize", rows: term.rows, cols: term.cols }),
      );
    };

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
      if (type === "session") {
        // 回放元信息（服务端在回放字节之前下发）。
        const firstMeta = !hasServerSeq;
        const seq = Number(event.seq ?? 0);
        if (Number.isFinite(seq) && seq >= 0) {
          serverSeq = seq;
          hasServerSeq = true;
        }
        bytesSinceSeq = 0;
        // PTY 宽度决定历史输出的换行位置，也决定了 bash 认为提示符占几行。
        // 和本终端宽度不一致时，先把终端调到 PTY 尺寸再回放并锁定，
        // 否则 bash 收到 resize 后会按旧宽度重绘提示符，把历史行覆盖掉。
        const ptyRows = Number(event.rows ?? 0);
        const ptyCols = Number(event.cols ?? 0);
        if (
          firstMeta &&
          ptyRows > 0 &&
          ptyCols > 0 &&
          (term.rows !== ptyRows || term.cols !== ptyCols)
        ) {
          lockToPty = true;
          term.resize(ptyCols, ptyRows);
        }
        if (event.reset === true) {
          // 服务端持有的序号与当前会话对不上（会话被重建 / 认领），已整段重放：
          // 先清屏，否则会和上次残留的画面重复。
          term.reset();
        }
        if (event.truncated === true) {
          term.writeln(
            "\r\n\x1b[90m[earlier output was truncated by the scrollback buffer]\x1b[0m",
          );
        }
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
      // 会话增删由后端实时事件统一广播，这里不再重复通知。
    };

    const connect = () => {
      if (disposed) {
        return;
      }
      const baseUrl = terminalUrl || analysisNodeTerminalUrl(id);
      // since：从服务端给出的序号续传（首次连接不带，让后端整段回放）。
      // rows/cols：会话由本次连接创建时用它建 PTY；锁定 PTY 宽度后不再上报，
      // 避免把终端尺寸和 PTY 尺寸弄成不一致。
      const params = new URLSearchParams();
      if (hasServerSeq) {
        params.set("since", String(serverSeq + bytesSinceSeq));
      }
      if (!lockToPty) {
        params.set("rows", String(term.rows));
        params.set("cols", String(term.cols));
      }
      const query = params.toString();
      const url = query
        ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`
        : baseUrl;
      socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        pushResize();
        term.focus();
      };
      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          handleControlText(event.data);
          return;
        }
        const chunk = decoder.decode(event.data, { stream: true });
        bytesSinceSeq += (event.data as ArrayBuffer).byteLength;
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
      pushResize();
    });

    const observer = new ResizeObserver(() => {
      // 已锁定 PTY 宽度：不能再 fit，否则终端宽度会和 PTY 不一致。
      if (lockToPty) {
        return;
      }
      try {
        fitAddon.fit();
      } catch {
        // ignore fit errors while the modal is closing
      }
    });
    observer.observe(element);

    // 首次打开后 fit 一次，避免 modal 动画期间尺寸为 0。
    const timer = window.setTimeout(() => {
      if (lockToPty) {
        return;
      }
      try {
        fitAddon.fit();
        pushResize();
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

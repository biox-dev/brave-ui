import {
  RealtimeClient,
  RealtimeClientConfig,
  RealtimeStatus,
  RealtimeTransport,
} from "./types";

export class WebSocketClient implements RealtimeClient {
  private url = "";
  private ws: WebSocket | null = null;
  private listeners: Set<(data: any) => void> = new Set();
  private status: RealtimeStatus = "closed";

  private retryInterval: number;
  private heartbeatTimeout: number;
  private ackEnabled = true;
  private ackHandler?: RealtimeClientConfig["ackHandler"];
  private lastReceived = Date.now();
  private heartbeatTimer: any = null;
  private retryTimer: any = null;
  private manualClosed = false;
  private lastUserActivity = Date.now();
  // 连续重连失败次数：用于指数退避。网络进程崩溃（WebKit "Network process
  // crashed"）时实时 WS 与终端 WS 会同时断开，固定短间隔重连会在页面恢复的
  // 瞬间形成重连风暴，反过来再压垮网络进程。握手成功后清零。
  private reconnectAttempts = 0;
  private readonly maxRetryDelay = 30_000;

  private readonly activeWindowMs = 60_000;

  private readonly onUserActivity = () => {
    this.lastUserActivity = Date.now();
  };

  private readonly onVisibilityOrFocus = () => {
    this.onUserActivity();
    this.tryReconnectForActivePage();
  };

  private readonly onOnline = () => {
    this.onUserActivity();
    this.tryReconnectForActivePage();
  };

  private readonly onOffline = () => {
    // Keep state as closed while offline and stop heartbeat/retry timers.
    this.clearTimers();
    this.status = "closed";
  };

  constructor(retryInterval = 5000, heartbeatTimeout = 30000) {
    this.retryInterval = retryInterval;
    this.heartbeatTimeout = heartbeatTimeout;
    this.setupPageActivityWatchers();
  }

  getStatus() {
    return this.status;
  }

  getTransport(): RealtimeTransport {
    return "websocket";
  }

  setTransport() {
    // WebSocket client transport is fixed.
  }

  configure(config: Partial<RealtimeClientConfig>) {
    if (typeof config.retryInterval === "number") {
      this.retryInterval = config.retryInterval;
    }
    if (typeof config.heartbeatTimeout === "number") {
      this.heartbeatTimeout = config.heartbeatTimeout;
    }
    if (typeof config.ackEnabled === "boolean") {
      this.ackEnabled = config.ackEnabled;
    }
    if (typeof config.ackHandler === "function") {
      this.ackHandler = config.ackHandler;
    }
  }

  onMessage(fn: (data: any) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  close() {
    this.manualClosed = true;
    this.clearTimers();

    if (this.ws) {
      // Manual close should not trigger auto-reconnect.
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.status = "closed";
  }

  reconnect() {
    if (!this.url) {
      return;
    }
    this.connect(this.url);
  }

  send(data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      this.ws.send(payload);
      return true;
    } catch {
      return false;
    }
  }

  connect(url: string) {
    this.url = url;
    this.manualClosed = false;
    this.clearTimers();

    if (this.ws) {
      // Replacing the socket is an intentional close, not a reconnect signal.
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.status = "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) {
        return;
      }
      this.status = "open";
      this.lastReceived = Date.now();
      this.reconnectAttempts = 0;
      this.startHeartbeatCheck();
      console.log("🟢 WebSocket connected:", this.url);
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) {
        return;
      }
      this.ws = null;
      console.warn("🔴 WebSocket closed");
      this.clearTimers();
      this.status = "closed";
      if (this.shouldReconnectOnClose(event)) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) {
        return;
      }
      console.warn("🔴 WebSocket error, scheduling reconnect...");
      this.scheduleReconnect();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) {
        return;
      }
      this.lastReceived = Date.now();

      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data?.type === "ping") {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        }
        return;
      }

      this.listeners.forEach((fn) => fn(data));
      this.tryAck(data);
    };
  }

  private startHeartbeatCheck() {
    this.clearTimers();

    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastReceived > this.heartbeatTimeout) {
        console.warn("⚠ WebSocket heartbeat timeout, reconnecting...");
        this.scheduleReconnect();
      }
    }, 5000);
  }

  private scheduleReconnect() {
    if (this.manualClosed) {
      return;
    }

    if (!this.shouldAutoReconnectNow()) {
      this.status = "closed";
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.status = "closed";

    this.clearTimers();

    if (!this.retryTimer) {
      this.reconnectAttempts += 1;
      // 指数退避：retryInterval * 2^(n-1)，上限 maxRetryDelay。
      const delay = Math.min(
        this.retryInterval * 2 ** (this.reconnectAttempts - 1),
        this.maxRetryDelay,
      );
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.manualClosed || !this.shouldAutoReconnectNow()) {
          this.status = "closed";
          return;
        }
        this.reconnect();
      }, delay);
    }
  }

  private shouldReconnectOnClose(_event: CloseEvent) {
    if (this.manualClosed) {
      return false;
    }
    return this.shouldAutoReconnectNow();
  }

  private shouldAutoReconnectNow() {
    const online =
      typeof navigator === "undefined" || typeof navigator.onLine !== "boolean"
        ? true
        : navigator.onLine;

    if (!online) {
      return false;
    }

    if (typeof document === "undefined") {
      return true;
    }

    const isVisible = document.visibilityState === "visible";
    const isFocused = document.hasFocus();
    const recentlyActive = Date.now() - this.lastUserActivity <= this.activeWindowMs;

    return isVisible || isFocused || recentlyActive;
  }

  private tryReconnectForActivePage() {
    if (
      this.status !== "closed" ||
      !this.url ||
      this.retryTimer ||
      this.manualClosed ||
      !this.shouldAutoReconnectNow()
    ) {
      return;
    }
    this.scheduleReconnect();
  }

  private setupPageActivityWatchers() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    window.addEventListener("focus", this.onVisibilityOrFocus);
    document.addEventListener("visibilitychange", this.onVisibilityOrFocus);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);

    ["pointerdown", "keydown", "touchstart", "mousemove", "scroll"].forEach(
      (eventName) => {
        window.addEventListener(eventName, this.onUserActivity, {
          passive: true,
        });
      }
    );
  }

  private clearTimers() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;

    this.retryTimer && clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private tryAck(data: any) {
    if (!this.ackEnabled) {
      return;
    }

    const seq = this.extractSeq(data);
    if (seq === undefined || seq === null) {
      return;
    }

    if (this.ackHandler) {
      Promise.resolve(
        this.ackHandler({ seq, raw: data, transport: "websocket" })
      ).catch((error) => {
        console.warn("⚠ WebSocket ACK failed:", error);
      });
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "ack", seq }));
    }
  }

  private extractSeq(data: any) {
    return data?.seq ?? data?.sequence ?? data?.meta?.seq;
  }
}

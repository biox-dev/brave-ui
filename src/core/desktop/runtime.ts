/**
 * Wails v3 运行时绑定调用（最小封装，不依赖 `wails generate module`）。
 *
 * 为什么手写而不是用生成的 bindings：
 * - 本仓库前端在浏览器里也要能跑（`npm run dev`），此时 `/wails/runtime`
 *   不存在，必须能优雅降级；
 * - 只用到一个服务（`DesktopService`），手写 20 行比引入生成代码更轻。
 *
 * 协议（Wails v3 HTTP transport）：
 *   POST /wails/runtime
 *   { "object": 0, "method": 0, "args": { "call-id": "...", "methodName": "<pkg>.<Type>.<Method>", "args": [...] } }
 * 返回值：直接是该方法的 JSON 结果（Go error 会以 422 + 错误体返回）。
 */

/** Go 侧 DesktopService 的完全限定名（`<PkgPath>.<TypeName>`）。 */
const DESKTOP_SERVICE = "main.DesktopService";

interface WailsWindow extends Window {
  _wails?: {
    runtime?: unknown;
    [key: string]: unknown;
  };
  /**
   * 桌面壳注入的标记（见 gobrave `cmd/desktop/main.go` 的 `desktopMarkerJS`）。
   *
   * 之所以不只看 `window._wails`：桌面端为了 POST body / WebSocket 正常，
   * WebView 加载的是自己的本地 http.Server，页面不会自动引入 Wails 的
   * runtime.js，因此 `_wails` 并不存在。标记由 `WebviewWindowOptions.JS`
   * 在 WindowLoadFinished 时写入，早于 React 挂载，读到时一定已经就绪。
   */
  __BRAVE_DESKTOP__?: boolean;
}

let callSeq = 0;

const nextCallId = () => {
  callSeq += 1;
  return `call-${Date.now()}-${callSeq}`;
};

/**
 * 判断当前是否运行在 Wails 桌面壳里。
 *
 * 优先看桌面壳注入的 `__BRAVE_DESKTOP__` 标记；`_wails` 作为兜底
 * （若将来把 Wails runtime.js 引入页面，它也会存在）。
 */
export const isDesktopRuntime = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as WailsWindow;
  return Boolean(w.__BRAVE_DESKTOP__ || w._wails);
};

/**
 * 调用 Go 侧 `DesktopService` 的方法。
 *
 * 非桌面环境（普通浏览器）直接抛错，由调用方决定降级策略。
 */
export async function callDesktop<T = unknown>(
  method: string,
  ...args: unknown[]
): Promise<T> {
  if (!isDesktopRuntime()) {
    throw new Error("not running in desktop shell");
  }

  const response = await fetch("/wails/runtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: 0,
      method: 0,
      args: {
        "call-id": nextCallId(),
        methodName: `${DESKTOP_SERVICE}.${method}`,
        args,
      },
    }),
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : undefined) || text || `desktop call failed: ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

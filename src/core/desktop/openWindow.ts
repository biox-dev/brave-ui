/**
 * 统一「打开窗口」入口（混合模式）。
 *
 * 桌面端（Wails v3）：
 *   - 本应用页面（同源）→ 由 Go 端 `windows.Manager` 新建原生窗口，
 *     同一 URL 重复点击只会还原并置顶已有窗口；
 *   - 外部 http/https / mailto 等 → 交给系统默认浏览器。
 *
 * 浏览器端：退化为 `window.open(url, "_blank")`，行为与改造前一致。
 *
 * 除了业务代码显式调用 `openWindow()`，本模块还会在桌面端接管两类隐式入口：
 *   1. `window.open()`（例如页面上现存的 `onClick` 写法）；
 *   2. `<a target="_blank">` 点击（事件委托到 document）。
 * 这样无需改遍全仓库的调用点即可生效。
 *
 * 拦截范围是「白名单」：只有带着 `data-desktop-window` 标记的元素、
 * 或本模块自己的 `openWindow()` 调用才走原生窗口；
 * 其余 `window.open` 保持原样（例如预览 PDF、第三方授权页）。
 * 白名单是必要的 —— 有些第三方页面依赖 opener 通信，塞进原生窗口会失效。
 */

import { callDesktop, isDesktopRuntime } from "./runtime";

/** 原生窗口打开结果。 */
export interface OpenWindowResult {
  url: string;
  action: "created" | "focused" | "external";
  name?: string;
}

/**
 * 打开 URL（推荐所有「Open / 新窗口」按钮调用它）。
 *
 * @param url 相对或绝对地址。相对地址按当前页面 origin 补全。
 * @returns 桌面端返回 Go 侧结果；浏览器端始终返回 undefined。
 */
export async function openWindow(url: string): Promise<OpenWindowResult | undefined> {
  const target = (url || "").trim();
  if (!target) {
    return undefined;
  }

  if (!isDesktopRuntime()) {
    window.open(target, "_blank", "noopener,noreferrer");
    return undefined;
  }

  return callDesktop<OpenWindowResult>("OpenWindow", target);
}

/**
 * 强制用系统默认浏览器打开（即使同源）。
 *
 * 用于「在浏览器中打开」这类明确语义的入口。
 */
export async function openExternal(url: string): Promise<void> {
  const target = (url || "").trim();
  if (!target) {
    return;
  }

  if (!isDesktopRuntime()) {
    window.open(target, "_blank", "noopener,noreferrer");
    return;
  }

  await callDesktop("OpenExternal", target);
}

/** 元素是否声明了「用原生窗口打开」。 */
const wantsDesktopWindow = (element: HTMLElement | null) =>
  Boolean(element?.closest("[data-desktop-window]"));

/**
 * 从 `<a>` 元素取目标地址：优先 href，其次 data-href。
 */
const resolveAnchorUrl = (anchor: HTMLAnchorElement): string => {
  const href = anchor.getAttribute("href") || anchor.dataset.href || "";
  if (!href || href === "#" || href.startsWith("javascript:")) {
    return "";
  }
  return anchor.href || href;
};

let installed = false;

/**
 * 安装全局拦截（幂等）。
 *
 * 只能在桌面端安装 —— 浏览器端原生窗口并不存在，保持默认行为。
 */
export function installDesktopWindowBridge(): void {
  if (installed || typeof window === "undefined") {
    return;
  }
  if (!isDesktopRuntime()) {
    return;
  }
  installed = true;

  // 1) `window.open()`：只接管带白名单标记的调用。
  const nativeOpen = window.open.bind(window);
  window.open = function patchedOpen(
    url?: string | URL,
    target?: string,
    features?: string
  ): Window | null {
    const href = typeof url === "string" ? url : url?.toString() || "";
    const hasMarker =
      typeof document !== "undefined" &&
      wantsDesktopWindow(document.activeElement as HTMLElement | null);

    if (!hasMarker || (target && target !== "_blank")) {
      return nativeOpen(url as string, target, features);
    }

    void openWindow(href).catch(() => {
      nativeOpen(href, target, features);
    });
    return null;
  } as typeof window.open;

  // 2) `<a target="_blank" data-desktop-window>`：事件委托，避免逐处绑定。
  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) {
        return;
      }
      // 保留「按住修饰键用浏览器打开」的习惯。
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if ((anchor.getAttribute("target") || "") !== "_blank") {
        return;
      }
      if (!wantsDesktopWindow(anchor)) {
        return;
      }

      const href = resolveAnchorUrl(anchor);
      if (!href) {
        return;
      }

      event.preventDefault();
      void openWindow(href).catch(() => {
        window.open(href, "_blank", "noopener,noreferrer");
      });
    },
    true
  );
}

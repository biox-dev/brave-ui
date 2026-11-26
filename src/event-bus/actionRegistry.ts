import { ActionDispatcher } from "./dispatcher";
import { useUIStore } from "@/event-bus/stores/ui";
import { useFormStore } from "@/event-bus/stores/form";
import { useRouterStore } from "@/event-bus/stores/router";
import { BROADCAST_ID, useComponentStore, type ComponentStore } from "@/event-bus/stores/components";
import { openBottomTerminal } from "@/layout/bottom-panel-store";
import {
  currentPathname,
  openAgentSessionTerminalTab,
  parseAgentSessionPath,
} from "@/layout/workspace-navigation";


// 定义各 Action payload 类型
export type ShowMessagePayload = { type: "success" | "error" | "info" | "warning"; text: string };
export type ShowNotificationPayload = { type: "success" | "error" | "info" | "warning"; message: string; description?: string };
export type RouterGoPayload = { path: string, state?: any };
export type FormSetValuePayload = { form: string; field: string; value: any };
export type FormResetPayload = { form: string };

/**
 * 后端推送的组件事件。
 *
 * - `id` 为具体组件 id 时只投递给该实例；
 * - `id` 缺省或为 `"*"` 时广播给该 category 下所有实例（见 BROADCAST_ID）；
 * - `parentId` 用于弹窗 + 左栏共存场景，额外投递给父级实例。
 */
export type ComponentInvokePayload = {
  category: keyof ComponentStore;
  id?: string;
  method: string;
  args?: any;
  parentId?: string;
};

/** 后端容器终端事件：Agent 在某个模板的终端里执行命令。 */
export type TerminalExecPayload = {
  template_id?: string | number;
  session_id?: string;
  command?: string;
  source?: string;
  phase?: "start" | "end";
  exit_code?: number;
  timed_out?: boolean;
};

export function registerActions() {
  // UI
  ActionDispatcher.register("ui.show_message", (payload: ShowMessagePayload) => {
    const ui = useUIStore.getState();
    if (!ui.messageApi) {
      console.warn("[LLM] Message API is not ready yet, skip message action");
      return;
    }
    ui.messageApi[payload.type](payload.text);
  });

  ActionDispatcher.register("ui.show_notification", (payload: ShowNotificationPayload) => {
    const ui = useUIStore.getState();
    if (!ui.notificationApi) {
      console.warn("[LLM] Notification API is not ready yet, skip notification action");
      return;
    }
    ui.notificationApi[payload.type]({
      message: payload.message,
      description: payload.description,
    });
  });
  ActionDispatcher.register(
    "component.invoke",
    ({ category, id, method, args, parentId }: ComponentInvokePayload) => {
      if (!category || !method) {
        console.warn("[LLM] component.invoke missing category/method", { category, method });
        return;
      }
      const store = useComponentStore.getState();
      // id 缺省 / "*" 表示广播给该类目的全部实例，不指向单个组件。
      if (!id || id === BROADCAST_ID) {
        store.invokeAll(category, method, args);
      } else {
        store.invoke(category, id, method, args);
      }
      if (parentId) {
        store.invoke(category, parentId, method, args);
      }
    }
  );

  // Router
  ActionDispatcher.register("router.go", (payload: RouterGoPayload) => {
    useRouterStore.getState().go(payload.path, payload.state);
  });

  // Container terminal：Agent 执行命令时把终端调到前台（会话已在后端创建，
  // 打开连接会自动回放历史输出）。终端会话按会话 ID 寻址。
  //
  // 打开位置跟随当前路由，与 workspace-navigation 的「同一资源两种打开方式」一致：
  // - Agent 会话页（`/session`、`/session/:sessionId`）：在右侧工作区 `MainTabs`
  //   打开 / 聚焦终端标签（`agentAppSessionTerminal`），不打断聊天；
  // - 其它页面：沿用底部面板终端（openBottomTerminal）。
  ActionDispatcher.register("terminal.exec", (payload: TerminalExecPayload) => {
    const sessionId = payload?.session_id == null ? "" : String(payload.session_id).trim();
    if (!sessionId || payload?.phase !== "start") {
      return;
    }
    const title = `Terminal ${sessionId}`;
    const { matched, sessionId: conversationId } = parseAgentSessionPath(currentPathname());
    if (matched) {
      // 会话页：New Chat（`/session` 还没有会话 ID）写进 `__new__` 工作区，
      // 会话创建后由页面迁移到新会话，标签不会凭空消失。
      openAgentSessionTerminalTab(conversationId, sessionId, title);
    } else {
      openBottomTerminal(sessionId, title);
    }
    const ui = useUIStore.getState();
    ui.notificationApi?.info({
      message: "Agent is running a command in the terminal",
      description: payload?.command,
    });
  });

  ActionDispatcher.register("form.set_value", (payload: FormSetValuePayload) => {
    // useFormStore.getState().setValue(payload.form, payload.field, payload.value);
  });

  ActionDispatcher.register("form.reset", (payload: FormResetPayload) => {
    // useFormStore.getState().reset(payload.form);
  });
}
import { ActionDispatcher } from "./dispatcher";
import { useUIStore } from "@/event-bus/stores/ui";
import { useFormStore } from "@/event-bus/stores/form";
import { useRouterStore } from "@/event-bus/stores/router";
import { useComponentStore } from "@/event-bus/stores/components";


// 定义各 Action payload 类型
export type ShowMessagePayload = { type: "success" | "error" | "info" | "warning"; text: string };
export type ShowNotificationPayload = { type: "success" | "error" | "info" | "warning"; message: string; description?: string };
export type RouterGoPayload = { path: string, state?: any };
export type FormSetValuePayload = { form: string; field: string; value: any };
export type FormResetPayload = { form: string };

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
    ({ category, id, method, args ,parentId}:any) => {
      // debugger
      useComponentStore.getState().invoke(category, id, method, args);
      if(parentId){
        useComponentStore.getState().invoke(category, parentId, method, args);
      }
    }
  );

  // Router
  ActionDispatcher.register("router.go", (payload: RouterGoPayload) => {
    useRouterStore.getState().go(payload.path, payload.state);
  });

  // Form
  ActionDispatcher.register("form.set_value", (payload: FormSetValuePayload) => {
    // useFormStore.getState().setValue(payload.form, payload.field, payload.value);
  });

  ActionDispatcher.register("form.reset", (payload: FormResetPayload) => {
    // useFormStore.getState().reset(payload.form);
  });
}
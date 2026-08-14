import { registerActions } from "./actionRegistry";
import { ActionDispatcher } from "./dispatcher";

type SSELike = {
  onMessage: (fn: (data: any) => void) => () => void;
};

let actionsInitialized = false;

export function registerLLMActions(sse: SSELike) {
    if (!actionsInitialized) {
        registerActions();
        actionsInitialized = true;
    }

    const unsubscribe = sse.onMessage((data: any) => {
        try {
            if (data?.action && data?.payload) {
                console.log("[LLM] Received SSE message:", data);
                ActionDispatcher.dispatch(data.action, data.payload);
            }else if (data?.actions) {
                console.log("[LLM] Received SSE batch actions:", data);
                ActionDispatcher.dispatchList(data.actions);
            } else {
                console.warn("[LLM] Unrecognized SSE message format:", data);
            }
        } catch (e) {
            console.error("[LLM] SSE parse error", e);
        }
    });

    console.log("[LLM] Actions registered");

    return () => {
        unsubscribe();
    };
}
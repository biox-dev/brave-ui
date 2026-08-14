import { ActionRegistry } from "../ActionRegistry.bak";

const uiState: any = {};

ActionRegistry.register("ui.patch", (patch: Record<string, any>) => {
  Object.entries(patch).forEach(([k, v]) => {
    if (uiState[k] !== v) {
      uiState[k] = v;
      window.dispatchEvent(new CustomEvent("ui_patch", { detail: { key: k, value: v } }));
    }
  });
});
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
  aiSummaryInput: () => import("./ai-summary-input-modal"),
  aiSummaryTask: () => import("./ai-summary-task-modal"),
  aiSummaryUpdate: () => import("./ai-summary-update-modal"),
};

declare module "@/core/component-registry/registry-types" {
  interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
  aiSummaryInput: () => import("./ai-summary-input-modal"),
  aiSummaryTask: () => import("./ai-summary-task-modal"),
  aiSummaryUpdate: () => import("./ai-summary-update-modal"),
  // 复用 AI 摘要详情路由页（/c/ai-summaries/:summary_id）作为 invoke 视图：
  // `invoke.aiSummaryDetail.open({ summary_id })`。
  aiSummaryDetail: () => import("@/pages/page-route/ai-summary-detail"),
};

declare module "@/core/component-registry/registry-types" {
  interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

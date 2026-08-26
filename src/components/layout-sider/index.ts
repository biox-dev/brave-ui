import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    projectReport: () => import("./project-report/project-report-list"),
    analysisNodeList: () => import("./analysis-node-result/analysis-result-list"),
    analysisList: () => import("./analysis-result/analysis-list"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

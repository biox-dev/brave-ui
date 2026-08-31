import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    projectReport: () => import("./project-report/project-report-list"),
    projectLiterature: () => import("./literature/project-literature-list"),
    analysisNodeList: () => import("./analysis-node-result/analysis-result-list"),
    analysisList: () => import("./analysis-result/analysis-list"),
    workflowPage: () => import("./workflow-page/workflow-page-list"),
    scriptPage: () => import("./script-page/script-page-list"),
    sysFileBrowser: () => import("./sys-file/sys-file"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> { }
}

registerLazyViews(viewLoaders);

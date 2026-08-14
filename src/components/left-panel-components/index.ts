
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    scriptPageLeftPanel: () => import("./script-page"),
    workflowPageLeftPanel: () => import("./workflow-page"),
    analysisTree: () => import('./analysis-tree'),
    sysFileBrowser: () => import("./sys-file"),

};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> { }
}

registerLazyViews(viewLoaders);


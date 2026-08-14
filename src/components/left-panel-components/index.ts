
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    scriptPageLeftPanel : () => import("./script-page"),
    workflowPageLeftPanel : () => import("./workflow-page"),
};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);



import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    analysisTree: () => import('./analysis-tree'),
   

};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> { }
}

registerLazyViews(viewLoaders);


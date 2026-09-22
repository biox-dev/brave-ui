
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";
// import PublishToolsV2 from "./publish-tools-v2";

const storeViewLoaders = {
    createUpdateStore: () => import("./components/create-update-store"),
    publishTools: () => import('./publish-tools'),

};


declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof storeViewLoaders> { }
}

registerLazyViews(storeViewLoaders);


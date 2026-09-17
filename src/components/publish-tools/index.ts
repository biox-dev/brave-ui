
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";
// import PublishToolsV2 from "./publish-tools-v2";

const storeViewLoaders = {
    createUpdateStore: () => import("./components/create-update-store"),
    publishStore: () => import("./components/publish-store"),
    publishTools: () => import('./publish-tools'),
    PublishToolsV2: () => import('./publish-tools-v2'),

};


declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof storeViewLoaders> { }
}

registerLazyViews(storeViewLoaders);



import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const storeLoaders = {
    storeContent: () => import("./components/store-content"),
    storeSidebar: () => import("./components/store-sidebar"),
    storePages: () => import("./components/store-pages"),
    installComponents: () => import('./install-components'),
    installComponentsV2: () => import('./install-components-v2'),

};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof storeLoaders> { }
}

registerLazyViews(storeLoaders);


import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // Create/update a Script component. Rendered either in a modal/drawer via
    // `invoke.createOrUpdateScript.*`, or inline by <ViewResolver
    // view="createOrUpdateScript" ... /> (script-panel "structure").
    createOrUpdateScript: () => import("./create-or-update-script"),
    scriptCode: () => import('./code'),
    addScriptToNode: () => import('./add-script-to-node'),
    scriptPageCard: () => import('./script-page-card'),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

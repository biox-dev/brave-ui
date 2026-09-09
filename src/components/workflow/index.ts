import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // Create/update a workflow. Rendered either in a modal via
    // `invoke.createOrUpdateWorkflow.*` or inline by <ViewResolver
    // view="createOrUpdateWorkflow" ... /> (workflow-panel "Edit Tools").
    createOrUpdateWorkflow: () => import("./create-or-update-workflow"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // Create/update a workflow. Rendered either in a modal via
    // `invoke.createOrUpdateWorkflow.*` or inline by <ViewResolver
    // view="createOrUpdateWorkflow" ... /> (workflow-panel "Edit Tools").
    createOrUpdateWorkflow: () => import("./create-or-update-workflow"),
    relationDefinitionDAG: () => import('./relation-definition-dag'),
    'workflow-vis': () => import('./workflow-vis-component'),
    workflowVisCard: () => import('../workflow/workflow-vis'),


};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> { }
}

registerLazyViews(viewLoaders);

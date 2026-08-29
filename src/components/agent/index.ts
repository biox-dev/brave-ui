import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    createAgentTaskModal: () => import("./create-agent-task-modal"),
    taskEventsModal: () => import("./task-events-modal"),
    taskPermissionsModal: () => import("./task-permissions-modal"),
    agentChat: () => import("./agent-chat"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

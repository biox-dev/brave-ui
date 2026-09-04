import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    createAgentTaskModal: () => import("./create-agent-task-modal"),
    taskEventsModal: () => import("./task-events-modal"),
    taskPermissionsModal: () => import("./task-permissions-modal"),
    taskLLMRequestModal: () => import("./task-llm-request-modal"),
    agentChat: () => import("./agent-chat"),
    agentMemoryEditModal: () => import("./agent-memory-edit-modal"),
    agentConfigModal: () => import("./agent-config-modal"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

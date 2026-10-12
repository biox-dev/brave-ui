import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // Collected form-item data detail list (upstream analysis result files /
    // assays), opened from CollectedAssaySelect via invoke.collectedFileList.
    collectedFileList: () => import("./collected-file-list"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // 文件详情视图（`filePreview`）已统一注册到 `@/components/detail-views`，
    // 这里只保留文件表单里的 sheet 按钮。
    sheetButton: () => import("./sheet-button"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    // 脚本 / 工作流目录下的 README.md 查看与编辑，由 panel 的 Segmented（views）切换内联渲染。
    scriptReadme: () => import("./script-readme"),
    workflowReadme: () => import("./workflow-readme"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

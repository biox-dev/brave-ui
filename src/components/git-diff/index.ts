import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
	// 组件目录（script / workflow）的本地变化 diff：由 git-state-actions 的
	// 「查看变化」按钮通过 invoke.gitDiff.open(...) 以 Modal 形式打开。
	gitDiff: () => import("./git-diff-view"),
};

declare module "@/core/component-registry/registry-types" {
	interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

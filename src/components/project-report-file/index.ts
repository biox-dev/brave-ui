import { registerLazyViews } from "@/core/component-registry"
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types"

// 报告正文（output.md）面板注册成 ViewResolver 视图，供 Agent 会话右侧工作区
// （`openAgentWorkspaceTab({ view: "projectReportFile", params: { reportId } })`）渲染。
// 参数名与路由页、面板 props 统一为 `reportId`，不做任何字段转换。
const viewLoaders = {
    projectReportFile: () => import("./project-report-file-panel"),
}

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders)

export { default as ProjectReportFilePanel } from "./project-report-file-panel"
export type { ProjectReportFilePanelProps } from "./project-report-file-panel"

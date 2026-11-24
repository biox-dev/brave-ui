import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

/**
 * 「详情路由页」作为右侧工作区标签视图的注册表
 * ============================================================
 * Agent 会话页右侧 `MainTabs` 里的标签内容是 `ViewResolver` 视图。有些资源只有
 * 「详情路由页”、没有独立的 Panel 组件，这里把路由页注册成视图，让列表在会话页里
 * 也能在标签中打开同一个详情页（不在会话页时仍然是普通路由跳转）。
 *
 * 这些页面都接受可选 id prop（`script_id` / `workflow_id` / `literatureId` / `file_id`），
 * 路由页从 `useParams()` 取，标签视图从 props 取；两种方式指向同一个资源（DB 主键）。
 *
 * 新增资源时在这里补一个 loader，然后在 `layout/workspace-navigation.ts` 里
 * 声明对应的标签 key 前缀，列表里用 `useWorkspaceOpener()` + `WorkspaceOpenTarget` 打开。
 */
const viewLoaders = {
    // 脚本详情（/c/scripts/:script_id/:view?）：props { component_type: "script", script_id }
    scriptPanelDetail: () => import("@/pages/page-route/script-panel"),
    // 工作流详情（/c/tools/:workflow_id）：props { workflow_id }
    workflowPanelDetail: () => import("@/pages/page-route/workflow-panel"),
    // 文献详情（/literature-writing/:literature-id）：props { literatureId }
    literatureWritingDetail: () => import("@/pages/page-route/literature-writing"),
    // 文件详情（/dataset-file/:file_id）：props { file_id }
    // Agent 会话页右侧标签与 `invoke.filePreview` 弹窗共用同一个页面
    // （统一 PanelLayout 标题栏、默认收起文件详情）。
    filePreview: () => import("@/pages/page-route/file-view"),
    // 项目报告正文（/report-file/:report-id）：props { reportId, defaultMode }
    projectReportFile: () => import("@/pages/page-route/project-report-file-panel"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

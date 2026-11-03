import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {

  // 列表已迁移到 layout-sider（左侧栏面板形态），这里保留 view key 兼容既有 invoke 调用。
  containerTemplatePage: () => import("../layout-sider/container-template/container-template-list"),
  containerTemplateForm: () => import("./container-template-form"),
  containerTemplateSpecPage: () => import("./container-template-spec-page"),
  containerTemplateSpecForm: () => import("./container-template-spec-form"),
  containerTemplateExportDialog: () => import("./container-template-export-dialog"),
  containerTemplateImportDialog: () => import("./container-template-import-dialog"),
  // 应用会话列表已迁移到 layout-sider/container-template（左侧栏面板形态）。
  appSessionPage: () => import("../layout-sider/container-template/app-session-page"),
  containerInstancePage: () => import("./container-instance-page"),
  containerInstanceDescribeDialog: () => import("./container-instance-describe-dialog"),
  containerEventPage: () => import("./container-event-page"),
  outboxEventPage: () => import("./outbox-event-page"),
};

declare module "@/core/component-registry/registry-types" {
  interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

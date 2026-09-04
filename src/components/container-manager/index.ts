import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {

  containerImagePage: () => import("./container-image-page"),
  containerImageForm: () => import("./container-image-form"),
  containerTemplatePage: () => import("./container-template-page"),
  containerTemplateForm: () => import("./container-template-form"),
  containerTemplateExportDialog: () => import("./container-template-export-dialog"),
  containerTemplateImportDialog: () => import("./container-template-import-dialog"),
  appSessionPage: () => import("./app-session-page"),
  containerInstancePage: () => import("./container-instance-page"),
  containerInstanceDescribeDialog: () => import("./container-instance-describe-dialog"),
  containerEventPage: () => import("./container-event-page"),
  outboxEventPage: () => import("./outbox-event-page"),
};

declare module "@/core/component-registry/registry-types" {
  interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> {}
}

registerLazyViews(viewLoaders);

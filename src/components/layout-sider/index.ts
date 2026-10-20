import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const viewLoaders = {
    projectReport: () => import("./project-report/project-report-list"),
    projectLiterature: () => import("./literature/project-literature-list"),
    aiSummaryProject: () => import("./ai-summary/ai-summary-project-list"),
    analysisNodeList: () => import("./analysis-node-result/analysis-result-list"),
    analysisList: () => import("./analysis-result/analysis-list"),
    workflowPage: () => import("./workflow-page/workflow-page-list"),
    scriptPage: () => import("./script-page/script-page-list"),
    sysFileBrowser: () => import("./sys-file/sys-file"),
    datasetProjectPage: () => import("./data-dataset-page/dataset-project-page"),
    datasetFilePage: () => import("./data-dataset-page/dataset-file-page"),
    analysisNodeFilePage: () => import("./data-dataset-page/analysis-node-file-page"),
    assayProjectPage: () => import("./data-dataset-page/assay-project-page"),
    editAssayPage: () => import("./data-dataset-page/edit-assay-page"),
    editAssayFilePage: () => import("./data-dataset-page/edit-assay-file-page"),
    assayFileListPage: () => import("./data-dataset-page/assay-file-list-page"),
    editDatasetPage: () => import("./data-dataset-page/edit-dataset-page"),
    editFilePage: () => import("./data-dataset-page/edit-file-page"),
    editDatasetFileRole: () => import("./data-dataset-page/edit-datasetfile-role"),
    importAssayTsvPage: () => import("./data-dataset-page/import-assay-tsv-page"),
};

declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof viewLoaders> { }
}

registerLazyViews(viewLoaders);

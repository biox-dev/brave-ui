
import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const analysisNodeViewLoaders = {
    analysisNodes: () => import("./components/analysis-nodes"),
    analysisNodePage: () => import("./components/analysis-node-page"),
    analysisEdges: () => import("./components/analysis-edges"),
    analysisNodesReport: () => import("./components/analysis-nodes-report/analysis-nodes-report"),
    analysisNodePanel: () => import("./analysis-node-panel"),
    analysisResultDisplay: () => import("./components/result-render"),
    nodeParams: () => import("./components/node-params"),
    analysisNodeDetails: () => import("./components/analysis-nodes-report/analysis-node-details"),
    analysisNodeSnapshot: () => import("./components/analysis-node-snapshot"),
    nodeError: () => import("./components/node-error"),
    nodeResolvedIO: () => import("./components/node-resolved-io"),
    nodeLogs: () => import("./components/node-logs"),
    selectFileRole: () => import("./components/select-file-role"),
};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof analysisNodeViewLoaders> {}
}

registerLazyViews(analysisNodeViewLoaders);



import { registerLazyViews } from "@/core/component-registry";
import type { InferViewRegistryFromLoaders } from "@/core/component-registry/registry-types";

const analysisNodeViewLoaders = {
    analysisNodes: () => import("./components/analysis-nodes"),
    analysisNodePage: () => import("./components/analysis-node-page"),
    analysisEdges: () => import("./components/analysis-edges"),
    analysisNodePanel: () => import("./analysis-node-panel"),
    analysisResultDisplay: () => import("./components/result-render"),
    nodeParams: () => import("./components/node-params"),
    analysisNodeDetails: () => import("./components/analysis-nodes-report/analysis-node-details"),
    analysisNodeSnapshot: () => import("./components/analysis-node-snapshot"),
    nodeError: () => import("./components/node-error"),
    nodeResolvedIO: () => import("./components/node-resolved-io"),
    // 节点原始请求参数（analysis_nodes.request_param）只读查看弹窗。
    nodeRequestParam: () => import("./components/node-request-param"),
    nodeLogs: () => import("./components/node-logs"),
    nodeCommand: () => import("./components/node-command"),
    selectFileRole: () => import("./components/select-file-role"),
    createCommandNode: () => import("./components/create-command-node-form"),
};
// ;
declare module "@/core/component-registry/registry-types" {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof analysisNodeViewLoaders> {}
}

registerLazyViews(analysisNodeViewLoaders);


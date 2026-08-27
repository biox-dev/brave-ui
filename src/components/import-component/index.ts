import { registerLazyViews } from '@/core/component-registry';
import type { InferViewRegistryFromLoaders } from '@/core/component-registry/registry-types';
import PublishTools from '../publish-tools/publish-tools';

const importComponentLoaders = {
    workflow2: () => import('../../pages/components-relation/pipeline/components/pipeline-flow'),
    workflowComponent: () => import('../../pages/components-relation/workflow'),
    software: () => import('../../pages/components-relation/tools'),
    tools: () => import('../../pages/components-relation/tools'),
    analysisTools: () => import('../../pages/components-relation/tools/analysis-tools'),

    script: () => import('../../pages/components-relation/script'),
    file: () => import('../../pages/components-relation/file'),
    fileV2: () => import('../../pages/components-relation/components/create-or-update-component'),
    scriptV2: () => import('../../pages/components-relation/script/indexV2'),
    createOrUpdateComponent: () => import('../../pages/components-relation/components/create-or-update-component'),
    createOrUpdateRelation: () => import('../../pages/components-relation/components/create-or-update-relation'),
    analysisResult: () => import('../../pages/components-relation/components/analysis-result-page'),

    llmFile: () => import('../../pages/components-relation/components/llm-file'),
    llmTools: () => import('../../pages/components-relation/components/llm-tools'),
    llmScript: () => import('../../pages/components-relation/components/llm-script'),

    scriptView: () => import('../../pages/components-relation/components/script-view'),
    fileView: () => import('../../pages/components-relation/components/file-view'),

    scriptDesc: () => import('../../pages/components-relation/components/script-desc'),
    scriptCode: () => import('../../pages/components-relation/components/script-code'),

    'component-structure': () => import('../../pages/components-relation/components/component-structure'),
    'component-script': () => import('../../pages/components-relation/components/component-script'),

    'preview-relation-example': () => import('../../pages/components-relation/components/preview-example'),
    editParamsPanel: () => import('@/components/edit-params/components/edit-params'),
    inputFileComponent: () => import('@/components/result-list/input-file-component'),
    outputFileComponent: () => import('@/components/result-list/output-file-component'),
    analysisResultView: () => import('@/components/analysis-result-view/analysis-reuslt-view'),
    // analysisList: () => import('@/components/analysis-list'),
    analysisPage: () => import('@/components/analysis-list/analysis-page'),
    relationDefinitionDAG: () => import('../../pages/components-relation/components/relation-definition-dag'),

    'workflow-input': () => import('../../pages/components-relation/pipeline/components/pipeline-input'),
    'workflow-vis': () => import('../../pages/components-relation/workflow/workflow-vis-component'),
    'llm-card': () => import('../../layout/components/llm-card'),
    editParamsPanelWithAnalysisId: () => import('@/components/edit-params/components/edit-params-panel-with-analysis-id'),
    markdown: () => import('../../layout/components/md'),
    'module-edit': () => import('../../components/module-edit'),
    scriptCodeEdit: () => import('@/components/module-edit/code'),
    'create-or-update-component-drawer': () => import('@/components/create-pipeline/create-or-update-component-drawer'),
    // scriptPage: () => import('../left-panel-components/script-page-side'),
    fileTypePage: () => import('../workflow-page/file-type-page'),
    containerApp: () => import('../../components/interactive-tools/components/container-app'),
    containerAppProject: () => import('../../components/interactive-tools/components/container-app-project'),
    paramsView: () => import('@/components/edit-params/components/params-view'),
    containerInspect: () => import('@/components/container/container-inspect'),
    depContainer: () => import('../../pages/components-relation/workflow/dep-container'),
    remoteStore: () => import('../install-components/components/remote-store'),
    writePermission: () => import('../chat/write-permission'),
};

declare module '@/core/component-registry/registry-types' {
    interface ViewRegistry extends InferViewRegistryFromLoaders<typeof importComponentLoaders> {}
}

registerLazyViews(importComponentLoaders);



import { registerLazyViews } from '@/core/component-registry';
import type { InferViewRegistryFromLoaders } from '@/core/component-registry/registry-types';
import PublishTools from '../publish-tools/publish-tools';

const importComponentLoaders = {
    workflow2: () => import('../../pages/components-relation/pipeline/components/pipeline-flow'),
    software: () => import('../../pages/components-relation/tools'),
    tools: () => import('../../pages/components-relation/tools'),
    analysisTools: () => import('../../pages/components-relation/tools/analysis-tools'),

    script: () => import('../../pages/components-relation/script'),
    file: () => import('../../pages/components-relation/file'),
    scriptV2: () => import('../../pages/components-relation/script/indexV2'),
    analysisResult: () => import('../../pages/components-relation/components/analysis-result-page'),

    llmFile: () => import('../../pages/components-relation/components/llm-file'),
    llmTools: () => import('../../pages/components-relation/components/llm-tools'),
    llmScript: () => import('../../pages/components-relation/components/llm-script'),

    scriptView: () => import('../../pages/components-relation/components/script-view'),
    fileView: () => import('../../pages/components-relation/components/file-view'),

    scriptDesc: () => import('../../pages/components-relation/components/script-desc'),
    

    'component-structure': () => import('../../pages/components-relation/components/component-structure'),
    'component-script': () => import('../../pages/components-relation/components/component-script'),

    'preview-relation-example': () => import('../../pages/components-relation/components/preview-example'),
    editParamsPanel: () => import('@/components/edit-params/components/edit-params'),
    inputFileComponent: () => import('@/components/result-list/input-file-component'),
    outputFileComponent: () => import('@/components/result-list/output-file-component'),
    analysisResultView: () => import('@/components/analysis-result-view/analysis-reuslt-view'),
    // analysisList: () => import('@/components/analysis-list'),
    analysisPage: () => import('@/components/analysis-list/analysis-page'),

    'workflow-input': () => import('../../pages/components-relation/pipeline/components/pipeline-input'),
    'llm-card': () => import('../../layout/components/llm-card'),
    editParamsPanelWithAnalysisId: () => import('@/components/edit-params/components/edit-params-panel-with-analysis-id'),
    markdown: () => import('../../layout/components/md'),
    'module-edit': () => import('../../components/module-edit'),
    scriptCodeEdit: () => import('@/components/script/code'),
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



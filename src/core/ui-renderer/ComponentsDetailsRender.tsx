import { Skeleton } from 'antd';
import { FC, lazy, memo, Suspense } from 'react';

const PipelineFlowComponent = lazy(() => import('../../pages/components-relation/pipeline/components/pipeline-flow'))
const SoftwareComponent = lazy(() => import('../../pages/components-relation/tools'))
const ScriptComponent = lazy(() => import('../../pages/components-relation/script'))
const ScriptV2Component = lazy(() => import('../../pages/components-relation/script/indexV2'))
const EditParamsPanel = lazy(() => import('@/components/edit-params/components/edit-params'));

const FileComponent = lazy(() => import('../../pages/components-relation/file'))
// const CreateOrUpdateScript = lazy(() => import('@/components/script/create-or-update-script'))
const AnalysisResultPageAdapter = lazy(() => import('../../pages/components-relation/components/analysis-result-page'))
const PipelineInputComponent = lazy(() => import('../../pages/components-relation/pipeline/components/pipeline-input'))
const LLMFile = lazy(()=>import("../../pages/components-relation/components/llm-file"))
const LLMTools = lazy(()=>import("../../pages/components-relation/components/llm-tools"))
const ScriptDesc = lazy(()=>import("../../pages/components-relation/components/script-desc"))
const LLMScript = lazy(()=>import("../../pages/components-relation/components/llm-script"))
const ScriptCode = lazy(()=>import("../../pages/components-relation/components/script-code"))
const ComponentStructure = lazy(()=>import("../../pages/components-relation/components/component-structure"))
const ComponentScript = lazy(()=>import("../../pages/components-relation/components/component-script"))
const PreviewRelationExample = lazy(() => import('../../pages/components-relation/components/preview-example'))
const ScriptView = lazy(() => import('../../pages/components-relation/components/script-view'))
const FileView = lazy(() => import('../../pages/components-relation/components/file-view'))
const AnalysisTools = lazy(() => import('../../pages/components-relation/tools/analysis-tools'))
const InputFileComponent = lazy(() => import('@/components/result-list/input-file-component'))
const OutputFileComponent = lazy(() => import('@/components/result-list/output-file-component'))
const AnalysisResultView = lazy(() => import('@/components/analysis-result-view/analysis-reuslt-view'))
const AnalysisList = lazy(() => import('@/components/analysis-list'))
const WorkflowComponent = lazy(() => import('../../components/workflow/workflow-vis'))
const RelationDefinitionDAG = lazy(() => import('../../components/workflow/relation-definition-dag')) 
const WorkflowVisComponent = lazy(() => import('../../components/workflow/workflow-vis-component'))
const viewMapping: {
    key: string;
    label: string;
    component: React.ComponentType<any>;
}[] = [
        { key: "workflow2", label: "workflow", component: PipelineFlowComponent },
        { key: "workflowComponent", label: "workflowComponent", component: WorkflowComponent },
        { key: "software", label: "software", component: SoftwareComponent },
        { key: "tools", label: "software", component: SoftwareComponent },
        { key: "analysisTools", label: "analysisTools", component: AnalysisTools },

        { key: "script", label: "script", component: ScriptComponent },
        { key: "file", label: "file", component: FileComponent },

        { key: "scriptV2", label: "script", component: ScriptV2Component },
        // { key: "createOrUpdateScript", label: "CreateOrUpdateScript", component: CreateOrUpdateScript },
        { key: "analysisResult", label: "analysisResult", component: AnalysisResultPageAdapter },
        
        { key: "llmFile", label: "llmFile", component: LLMFile },
        { key: "llmTools", label: "llmTools", component: LLMTools },
        { key: "llmScript", label: "llmScript", component: LLMScript },
        
        {key:"scriptView", label:"scriptView", component: ScriptView},
        {key:"fileView", label:"fileView", component: FileView},

        { key: "scriptDesc", label: "scriptDesc", component: ScriptDesc },
        { key: "scriptCode", label: "scriptCode", component: ScriptCode },

        { key: "component-structure", label: "component-structure", component: ComponentStructure },
        { key: "component-script", label: "component-script", component: ComponentScript },

        { key: "preview-relation-example", label: "preview-relation-example", component: PreviewRelationExample },
        {key: "editParamsPanel", label: "editParamsPanel", component: EditParamsPanel},
        {key : "inputFileComponent", label: "inputFileComponent", component: InputFileComponent},
        {key : "outputFileComponent", label: "outputFileComponent", component: OutputFileComponent},
        {key: "analysisResultView", label: "analysisResultView", component: AnalysisResultView},
        {key: "analysisList", label: "analysisList", component: AnalysisList},
        {key: "relationDefinitionDAG", label: "relationDefinitionDAG", component: RelationDefinitionDAG},

        { key: "workflow-input", label: "workflow-input", component: PipelineInputComponent },

        {key: "workflow-vis", label: "workflow-vis", component: WorkflowVisComponent},

    ];

const ComponentsDetailsRender: FC<any> = ({ view, ...rest }) => {
    if (!view) return null
    const item = viewMapping.find((v) => v.key === view);
    if (!item) return <div>Unknow component {view}</div>;
    const { component: Component, key } = item
    // const Component = item.component;

    return <Suspense fallback={<Skeleton active></Skeleton>} >
        <Component  {...rest} />
    </Suspense>
}

export default memo(ComponentsDetailsRender);
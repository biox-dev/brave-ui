import { Skeleton } from 'antd';
import { FC, lazy, memo, Suspense } from 'react';


const LLM = lazy(() => import("./components/llm"));
const LLMCard = lazy(() => import("./components/llm-card"));
const ToolsCard = lazy(() => import("../pages/pipeline-components-card-v2/index-component"));
const ToolsDetail = lazy(() => import("../pages/components-relation/workflow-panel"));
const ComponentsV3 = lazy(() => import("../pages/components-relation/script-panel"));
const Md = lazy(() => import("./components/md"));
const AnalysisTree = lazy(() => import("../components/left-panel-components/analysis-tree"));
const viewMapping: {
    key: string;
    label: string;
    component: React.ComponentType<any>;
}[] = [
        { key: "tools", label: "tools", component: ToolsCard },
        { key: "markdown", label: "markdown", component: Md },
        { key: "toolsDetail", label: "toolsDetail", component: ToolsDetail },
        { key: "llm", label: "llm", component: LLM },
        { key: "llm-card", label: "llm-card", component: LLMCard },
        { key: "script", label: "componentsV3", component: ComponentsV3 },
        { key: "file", label: "componentsV3", component: ComponentsV3 },
        { key: "analysis-tree", label: "analysis-tree", component: AnalysisTree },


    ];

const ComponentRender: FC<any> = ({ view, ...rest }) => {
    if (!view) return null
    const item = viewMapping.find((v) => v.key === view);
    if (!item) return <div>Unknow component {view}</div>;
    const { component: Component, key } = item
    // const Component = item.component;

    // Special handling for script and file to inject component_type prop
    let extraProps = {};
    if (view === "script") {
        extraProps = { component_type: "script" };
    } else if (view === "file") {
        extraProps = { component_type: "file" };
    }

    return <Suspense fallback={<Skeleton active></Skeleton>}>
        <Component {...extraProps} {...rest} />
    </Suspense>
}

export default memo(ComponentRender);
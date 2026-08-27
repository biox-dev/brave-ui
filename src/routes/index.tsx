// https://reactrouter.com/start/data/installation
import { FC, lazy, useEffect, useState } from "react";
import Layout from "@/layout";

import LayoutV2 from "@/layout/indexV2";
import MicroGraphLayout from '@/layout/psycmicrograph'
import {
    // createBrowserRouter,
    RouteObject,
    // RouterProvider,
    useRoutes,
} from "react-router";
import { setMenuItems, setSelectedKey } from '../store/menuSlice'


// const router = createBrowserRouter([
//     {
//         path: "/",
//         element: <Layout />,
//         children: [
//             {
//                 path: "/",
//                 Component: Project
//             }, {
//                 path: "/sample",
//                 Component:Sample

//             }
//         ]
//     },
// ]);
// const RenderRouter: FC = () => {

//     return <RouterProvider router={router} />;
// };
const Sample = lazy(() => import('@/pages/sample'));
const Project = lazy(() => import('@/pages/project'));

const Doc = lazy(() => import('@/pages/doc'));
const Mutation = lazy(() => import('@/pages/assembly-genome/mutation'));
const Assembly = lazy(() => import('@/pages/assembly-genome/assembly'));
const GenePrediction = lazy(() => import('@/pages/assembly-genome/gene-prediction'));
const GeneAnnotation = lazy(() => import('@/pages/assembly-genome/gene-annotation'));
const GeneExpressison = lazy(() => import('@/pages/assembly-genome/gene-expression'));
const SampleQC = lazy(() => import('@/pages/sample/sample-qc'));
const PipelineCard = lazy(() => import('@/pages/pipeline-components/pipeline-card'));
const AnalysisResult = lazy(() => import('@/pages/analysis-result'));
const Literature = lazy(() => import('@/pages/literature'));
const AnalysisSoftware = lazy(() => import('@/pages/pipeline-components/software'));
const AnalysisFile = lazy(() => import('@/pages/pipeline-components/file'));
const Script = lazy(() => import('@/pages/pipeline-components/script'));
const Pipeline = lazy(() => import('@/pages/pipeline-components'));

const ComponentsRelation = lazy(() => import('@/pages/components-relation'));
const ComponentsRelationCard = lazy(() => import('@/pages/pipeline-components-card-v2'));
const Components = lazy(() => import('@/pages/components-relation/components'));

const PipelineComponentsCard = lazy(() => import('@/components/pipeline-components-card'));
const SoftwareAnalysisEditor = lazy(() => import('@/pages/software-analysis-editor'));
const AnalysisReport = lazy(() => import('@/pages/analysis-report-route/analsyis-report'));
const ReportWriting = lazy(() => import('@/pages/report-writing'));
const AnalysisNodeReport = lazy(() => import('@/pages/analysis-report-route/analysis-node-report'));

const PsycMicroGraphHome = lazy(() => import("@/pages/psycmicrograph"))
const Test = lazy(() => import("@/pages/test"))
const ToolKit = lazy(() => import("@/pages/tool-kit"))
const ContainerPage = lazy(() => import('@/pages/container'));
const Files = lazy(() => import('@/pages/files'));
const InteractiveTools = lazy(() => import('@/pages/interactive-tools'));
const ToolsPage = lazy(() => import('@/pages/tools-page'))

const ToolsCard = lazy(() => import("../pages/pipeline-components-card-v2/index-component"));
const ToolsDetail = lazy(() => import("../pages/components-relation/workflow-panel"));

const ComponentsV3 = lazy(() => import("../pages/components-relation/script-panel"));
const Login = lazy(() => import("@/pages/users/login"));
const Register = lazy(() => import("@/pages/users/register"));
const DatasetProjectPage = lazy(() => import("@/components/data-dataset-page/dataset-project-page"))
const DatasetFilePage = lazy(() => import("@/components/data-dataset-page/dataset-file-page"))
const SampleProjectPage = lazy(() => import("@/components/data-dataset-page/sample-project-page"))
const ContainerImagePage = lazy(() => import("@/components/container-manager/container-image-page"))
const ContainerTemplatePage = lazy(() => import("@/components/container-manager/container-template-page"))
const AppSessionPage = lazy(() => import("@/components/container-manager/app-session-page"))
const ContainerInstancePage = lazy(() => import("@/components/container-manager/container-instance-page"))
const ContainerEventPage = lazy(() => import("@/components/container-manager/container-event-page"))
const OutboxEventPage = lazy(() => import("@/components/container-manager/outbox-event-page"))
const FilePreviewRoute = lazy(() => import("@/components/file-preview/file-preview-route"))
import axios from "axios";
import { Skeleton } from "antd";
import { useDispatch } from "react-redux";

const rootElement = document.getElementById("root")!;
const appType = rootElement.getAttribute("data-app");
console.log("data-app: ", appType)
let routes: RouteObject[] = []
if (appType == "index") {
    const children = [

        {
            path: "dataset",
            element: <DatasetProjectPage />
        }, {
            path: "dataset-file",
            element: <DatasetFilePage />
        }, {
            path: "app-session",
            element: <AppSessionPage />
        }, {
            path: "container-instance",
            element: <ContainerInstancePage />
        }, {
            path: "container-event",
            element: <ContainerEventPage />
        }, {
            path: "outbox-event",
            element: <OutboxEventPage />
        }, {
            path: "sample-project",
            element: <SampleProjectPage />
        }, {
            path: "container-image",
            element: <ContainerImagePage />
        }, {
            path: "container-template",
            element: <ContainerTemplatePage />
        }, {
            path: "/",
            element: <Project />
        }, {
            path: "/sample",
            element: <Sample />
        }, {
            path: "/sample-qc",
            element: <SampleQC />
        }, {
            path: "/analysis-result",
            element: <AnalysisResult />
        }, {
            path: "/literature",
            element: <Literature />
        },  {
            path: "/container-page",
            element: <ContainerPage />
        },
        {
            path: "/analysis-report/:analysisId",
            element: <AnalysisReport />
        }, {
            path: "/analsyis-node-report/:analysisNodeId",
            element: <AnalysisNodeReport />
        },{
            path: "/report-writing/:project-report-id",
            element: <ReportWriting />
        },
        // {
        //     path: "/c/:component_type",
        //     element: <ToolsPage />
        // },
       

        {
            path: "/c/scripts",
            element: <ComponentsV3 component_type={"script"} />
        }, {
            path: "/c/scripts/:script_id",
            element: <ComponentsV3 component_type={"script"} />
        }, {
            path: "/c/file",
            element: <ComponentsV3 component_type={"file"} />
        },
        // {
        //     path: "/c/tools",
        //     element: <ToolsCard relation_type={"tools"} />
        // },
        {
            path: "/c/tools",
            element: <ToolsDetail />
        },
        {
            path: "/c/tools/:relation_id",
            element: <ToolsDetail />
        }, {
            path: "/c/tools/:relation_id/:analysis_id",
            element: <ToolsDetail />
        },
        // {
        //     path: "/c/:component_type/:relation_id",
        //     element: <ToolsPage />
        // },
        {
            path: "/pipeline-card",
            element: <PipelineComponentsCard
                params={{ component_type: "pipeline" }} />
        },
        {
            path: "/tool-kit",
            element: <ToolKit />
        }, {
            path: "/preview/file",
            element: <FilePreviewRoute />
        }, {
            path: "/files",
            element: <Files />
        }, {
            path: "/workflow-card",
            element: <ComponentsRelationCard
                // map={(item: any) => ({
                //     ...item,
                //     name: item.component_name,
                //     path: `/tools/${item.component_id}`,

                // })}
                params={{ relation_type: "workflow" }}
            />
        }, {
            path: "/tools-card",
            element: <ComponentsRelationCard
                // map={(item: any) => ({
                //     ...item,
                //     name: item.component_name,
                //     path: `/tools/${item.component_id}`,

                // })}
                params={{ relation_type: "tools" }}
            />
        }, {
            path: "/relation/:relation_type/:relation_id",
            element: <ComponentsRelation />
        }, {
            path: "/componentsV2/:component_type",
            element: <Components />
        },





        {
            path: "/software-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    ...item,
                    name: item.component_name,
                    path: `/software/${item.component_id}`,

                })}
                params={{ component_type: "software" }} />
        }, {
            path: "/file-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    ...item,
                    name: item.component_name,
                    path: `/software/${item.component_id}`,
                })}
                params={{ component_type: "file" }} />
        }, {
            path: "/script-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    ...item,
                    name: item.component_name,
                    path: `/software/${item.component_id}`,
                })}
                params={{ component_type: "script" }} />
        },
        {
            path: "/software-analysis-editor/:analysisId",
            element: <SoftwareAnalysisEditor />
        },

        {
            path: "/component/:component_type/:component_id",
            element: <Pipeline />
        },



        {
            path: "/software/:softwareId",
            element: <AnalysisSoftware />
        },
        {
            path: "/file/:fileId",
            element: <AnalysisFile />
        },
        {
            path: "/script/:scriptId",
            element: <Script />
        }, 


       

        {
            path: "/:project/single_genome/mutation",
            element: <Mutation />
        },  {
            path: "/:project/single_genome/assembly",
            element: <Assembly />
        }, {
            path: "/:project/single_genome/gene-prediction",
            element: <GenePrediction />
        }, {
            path: "/:project/single_genome/gene-annotation",
            element: <GeneAnnotation />
        }, {
            path: "/:project/single_genome/gene-expression",
            element: <GeneExpressison />
        }, {
            path: "/interactive-tools",
            element: <InteractiveTools />
        }

    ]
    routes = [
        {
            path: "/login",
            element: <Login />
        }, {
            path: "/register",
            element: <Register />
        }, 
        {
            path: "/doc",
            element: <Doc />
        }, {
            path: "/",
            element: <LayoutV2 />,
            children: [
                ...children,
            ]
        }, {
            path: "/test",
            element: <Test />
        },
    ]
} else if (appType == "micrograph") {
    const children = [

        {
            path: "/",
            element: <PsycMicroGraphHome />
        }, {
            path: "/sample",
            element: <Sample />
        }, {
            path: "/sample-qc",
            element: <SampleQC />
        }, {
            path: "/analysis-result",
            element: <AnalysisResult />
        }, {
            path: "/literature",
            element: <Literature />
        }, {
            path: "/container-page",
            element: <ContainerPage />
        },
        {
            path: "/analysis-report",
            element: <AnalysisReport />
        },
        {
            path: "/pipeline-card",
            element: <PipelineComponentsCard params={{ component_type: "pipeline" }} />
        }, {
            path: "/preview/file",
            element: <FilePreviewRoute />
        },

        {
            path: "/software-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    id: item.id,
                    component_id: item.component_id,
                    name: item.component_name,
                    category: item.category,
                    img: item.img,
                    tags: item.tags,
                    description: item.description,
                    order: item.order_index,
                    path: `/software/${item.component_id}`,
                    namespace: item.namespace,
                    namespace_name: item.namespace_name
                })}
                params={{ component_type: "software" }} />
        }, {
            path: "/file-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    id: item.id,
                    component_id: item.component_id,
                    name: item.component_name,
                    category: item.category,
                    img: item.img,
                    tags: item.tags,
                    description: item.description,
                    order: item.order_index,
                    path: `/file/${item.component_id}`,
                    namespace: item.namespace,
                    namespace_name: item.namespace_name
                })}
                params={{ component_type: "file" }} />
        }, {
            path: "/script-card",
            element: <PipelineComponentsCard
                map={(item: any) => ({
                    id: item.id,
                    component_id: item.component_id,
                    name: item.component_name,
                    category: item.category,
                    img: item.img,
                    tags: item.tags,
                    description: item.description,
                    order: item.order_index,
                    path: `/script/${item.component_id}`,
                    namespace: item.namespace,
                    namespace_name: item.namespace_name
                })}
                params={{ component_type: "script" }} />
        },
        {
            path: "/software-analysis-editor/:analysisId",
            element: <SoftwareAnalysisEditor />
        },

        {
            path: "/component/:component_type/:component_id",
            element: <Pipeline />
        }, {
            path: "/software/:softwareId",
            element: <AnalysisSoftware />
        },
        {
            path: "/file/:fileId",
            element: <AnalysisFile />
        },
        {
            path: "/script/:scriptId",
            element: <Script />
        }, 
        {
            path: "/:project/single_genome/mutation",
            element: <Mutation />
        }, {
            path: "/:project/single_genome/assembly",
            element: <Assembly />
        }, {
            path: "/:project/single_genome/gene-prediction",
            element: <GenePrediction />
        }, {
            path: "/:project/single_genome/gene-annotation",
            element: <GeneAnnotation />
        }, {
            path: "/:project/single_genome/gene-expression",
            element: <GeneExpressison />
        }
    ]
    routes = [
        {
            path: "/login",
            element: <Login />
        },
        {
            path: "/register",
            element: <Register />
        },
        {
            path: "/",
            element: <MicroGraphLayout />,
            children: [
                ...children,
            ]
        }, {
            path: "/test",
            element: <Test />
        },
    ]
}

const RenderRouter: FC = () => {
    // const [routes, setRoutes] = useState<RouteObject[] | null>([]);
    // const dispatch = useDispatch()



    // const loadData = async () => {
    //     const data:any = await listPipeline(dispatch)
    //     const routes = data.flatMap((group:any) =>
    //         group.items.map((item:any) => ({
    //             path: `/${item.path}`,
    //             element: <Pipeline name={item.path} />
    //         }))
    //     );
    //     // console.log(routes)
    //     // const routes = resp.data.pipeline.map((item: any) => {
    //     //     return {
    //     // path: `/:project/${item.path}`,
    //     // element: <Pipeline name={item.path} />
    //     //     }
    //     // })
    //     const router: RouteObject[] = [
    //         {
    //             path: "/",
    //             element: <Layout />,
    //             children: [
    //                 ...routes,
    //                 ...childern,
    //             ]
    //         },
    //     ]
    //     // console.log(router)
    //     setRoutes(router)

    // }
    // useEffect(() => {
    //     loadData()
    //     // console.log("1111111111111111")
    // }, [])
    // const element = routes ? useRoutes(routes) : null;

    // const routes: RouteObject[] = [
    // {
    //     path: "/",
    //     element: <Layout />,
    //     children: [
    //         ...childern,
    //     ]
    // },
    // ]

    // const element = useRoutes(router);
    const element = useRoutes(routes)

    return element;
    // return element;
};

export default RenderRouter;
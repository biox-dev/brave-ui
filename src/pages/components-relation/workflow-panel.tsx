import { Breadcrumb, Button, Card, message, Empty, Flex, Modal, Popconfirm, Skeleton, Switch, Tabs, Tag, Tooltip, Row, Col, Spin, Menu, Dropdown, Space, Collapse, Typography, Segmented, Divider } from "antd"
import { FC, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import AnalysisPanel, { UpstreamAnalysisInput, UpstreamAnalysisOutput } from '../../components/analysis-sotware-panel'
import Meta from "antd/es/card/Meta"
import { colors } from '@/utils/utils'

import axios from "axios"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import { deletePipelineRelationApi, listPipeline } from "@/api/pipeline"
import { CreateORUpdatePipelineCompnentRelation, CreateOrUpdatePipelineComponent } from "../../components/create-pipeline"
import ModuleEdit from "../../components/module-edit"
import { useModal, useModals } from '@/hooks/useModal'
import ImportData from '@/components/import-data'
import BioDatabases from '@/components/bio-databases'
import ParamsView from "../../components/params-view"
// import InstallNamespace from "@/components/namespace-operature"
import DependComponent from "@/components/depend-component"
import MonacoEditorModal from "@/components/react-monaco-editor"
import React from "react"
import { BindSample, MetadataModal } from "@/pages/sample"
import MetadataForm from "@/components/metadata-form"
import AnalysisResultEdit from "@/components/analysis-result-edit"
import OpenFile from "@/components/open-file"
import PipelineFlow from "@/components/pipeline-flow"
import SortSoftwareModal from "@/components/sort-software"
import DescriptionModal from "@/components/description-modal"
import FormProject from "@/components/form-project"
import { useSelector } from "react-redux"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useStickyTop } from "@/hooks/useStickyTop"
import Markdown from "@/components/markdown"
import PipelineComponent from './pipeline'
import ComponentsDetailsRender from "../../core/ui-renderer/ComponentsDetailsRender"
import { AppstoreOutlined, ArrowLeftOutlined, CloseOutlined, DeleteColumnOutlined, DeleteOutlined, DownOutlined, PlusOutlined, QuestionCircleOutlined, RedoOutlined } from '@ant-design/icons'
import { AI } from '@/components/chat'
import { useComponentStore } from "@/store-zustand/components"
import { useStoreRender } from "@/context/render/RenderProvider"
import { renderCloseViewButton, renderViewButton } from "@/utils/render-view-btn"
import { useSideViewContext } from "@/context/side/SideViewContext"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import { invoke } from "@/core/ui-system/invokeV2"
import WorkflowPage from "@/components/workflow-page/workflow-page"
import { http } from "@/api/client/http"
import StoreVersionActions from "./components/store-version-actions"

const Pipeline: FC<any> = ({ }) => {

    // const location = useLocation()
    // const queryParams = new URLSearchParams(location.search);
    // const key = queryParams.get("key");
    // debugger
    const { openAnalysis, analysisId, setAnalysisId, clear, toolsPanelView, setRelation, setToolsPanelView, closeAnalysis, workflow, setWorkflow } = useStoreRender()

    const { setSideView, sideView, sideOptions, setSideOptions } = useSideViewContext();


    console.log("Pipeline")
    // const { relation_id: relation_id_ } = useParams()
    // const [relation_id, setRelationId] = useState<any>(relation_id_ ? relation_id_ : workflow?.relation_id)
    const relation_type = "tools"
    // const [leftPanel, setLeftPanel] = useState<any>("analysisTools")
    const component_type = ""
    // console.log(pipelineId)
    const [pipeline, setPipeline] = useState<any>()
    const navigate = useNavigate();
    const [loading, setLoading] = useState<boolean>(true)

    const [test, setTest] = useState<any>(true)
    const [messageApi, contextHolder] = message.useMessage();
    const [component, setComponent] = useState<any>()
    const [rightPanel, setRightPanel] = useState<any>("llmTools")

    const [size, setSize] = useState<any>((component_type && ["script111"].includes(component_type)) ? [18, 6] : [20, 0])
    const tableRef = {
        inputFile: useRef<HTMLInputElement>(null),
        outputFile: useRef<HTMLInputElement>(null)
    };

    const [parsms, setParams] = useState<any>({})

    // const [editor, setEditor] = useState<any>({
    //     open: false,
    // })
    // const updateEditor = (key: string, value: any) => {
    //     setEditor((prev: any) => ({
    //         ...prev,
    //         [key]: value
    //     }));
    // };
    const { modal, openModal, closeModal } = useModal();
    const { modals, openModals, closeModals } = useModals(["modalD", "metadataModal", "bindSample"])
    // const { project: { project_id } } = useSelector((state: any) => state.context)
    const { project: project_id, componentLayout } = useSelector((state: any) => state.user);
    const leftRef = useRef<any>(null)

    const [menus, setMenus] = useState<any[]>([])
    // const [menuKey, setMenuKey] = useState<string | null>(key)
    const [view, setView] = useState<string>("analysisPage")
    const [openKeys, setOpenKeys] = useState<string[]>([]);

    const [componentMap, setComponentMap] = useState<any>({})
    // 🔍 递归查找 key 的父级路径
    const findParentKeys = (items: any, targetKey: string, path: string[] = []): string[] | null => {
        for (const item of items) {
            if (item.key === targetKey) {
                return path; // 当前路径即为父级 keys
            }
            if (item.children) {
                const found = findParentKeys(item.children, targetKey, [...path, item.key]);
                if (found) return found;
            }
        }
        return null;
    };



    const updateQueryParam = (paramName: string, newValue: string) => {
        const { pathname, search, hash } = window.location;

        // Parse current query string
        const searchParams = new URLSearchParams(search || "");

        // Update or add the parameter
        searchParams.set(paramName, newValue);

        // Determine if the app uses HashRouter
        const isHashRouter = hash.startsWith("#/");

        let newUrl = "";

        if (isHashRouter) {
            // Extract path and query part from the hash
            const [hashPath, hashSearch = ""] = hash.replace(/^#/, "").split("?");

            const hashParams = new URLSearchParams(hashSearch);
            hashParams.set(paramName, newValue);

            // Build new hash-based URL
            newUrl = `#${hashPath}?${hashParams.toString()}`;
        } else {
            // Build new browser-based URL
            newUrl = `${pathname}?${searchParams.toString()}`;
        }

        // Update browser URL without reloading the page
        window.history.pushState({}, "", newUrl);
    };


    const { ref: containerRef, top, isSticky } = useStickyTop(576);

    const loadFunction: any = (data: any[]) => {
        if (!data) return undefined
        return data.map((item: any) => {
            if ("paramsFun" in item) {
                item.paramsFun = eval(item.paramsFun)
            }
            if ("formJson" in item) {
                item['formJson'].map((it2: any) => {
                    if ("filter" in it2) {
                        it2['filter'].map((it3: any) => {
                            it3.method = eval(it3.method)
                            return it3
                        })
                    }

                    it2.field = eval(it2.field)
                    return it2
                })

            }
            return item
        })
    }
    const loadColumnRender: any = (data: any[]) => {
        if (!data) return []
        return data.map((item: any) => {
            if ("render" in item) {
                const render = eval(item.render)
                item.render = (_: any, record: any) => <>
                    {render(record)}
                </>
            }
            return item
        })
    }

    const getData = async (workflowId: any) => {
        // let api = `/get-pipeline-v2/${name}?component_type=${component_type}`
        // if (component_type == "script") {
        //     api = `/get-component-parent/${name}?component_type=${component_type}`
        // }
        const resp = await http.get(`/workflow/${workflowId}/get-workflow`)
        // console.log(resp.data)
        let pipeline = resp.data
        if ("content" in pipeline) {
            const contentJSON = JSON.parse(pipeline['content'])
            const { content, ...pipelineRest } = { ...contentJSON, ...pipeline }
            pipeline = pipelineRest
        }
        // if (pipeline["tags"]) {
        //     pipeline["tags"] = JSON.parse(pipeline["tags"])
        // }
        return pipeline
    }
    const loadData = async () => {
        if (workflow?.id) {
            setLoading(true)
            const pipeline = await getData(workflow?.id)
            setComponent(pipeline)
        }


    }
    const { register, unregister } = useComponentStore();
    const id = "tools-details"
    useEffect(() => {
        if (!id) return;
        register("tables", id, { reload: loadData });
        return () => {
            unregister("tables", id);
        }
    }, [id]);


    const deletePipelineRelation = async (realtionId: any) => {
        try {
            const resp = await deletePipelineRelationApi(realtionId)
            messageApi.success("删除成功!")
            loadData()
        } catch (error: any) {
            console.log(error)
            messageApi.error(`${error.response.data.detail}`)
        }
    }
    const datelePipeline = async (pipelineId: any) => {
        try {
            const resp = await axios.delete(`/delete-pipeline/${pipelineId}`)
            messageApi.success("删除成功!")
            loadData()
        } catch (error: any) {
            console.log(error)
            messageApi.error(`${error.response.data.detail}`)
        }
    }
    const operatePipeline = {
        deletePipelineRelation: deletePipelineRelation,
        openModal: openModal,
        openModals: openModals
    }
    const onOpenChange = (keys: string[]) => {
        setOpenKeys(keys); // 允许多层展开
    };
    // const onOpenChange = (keys: string[]) => {
    //     // 只保持一个父级 SubMenu 展开
    //     const latestOpenKey = keys.find((key) => !openKeys.includes(key));
    //     if (latestOpenKey) {
    //         setOpenKeys([latestOpenKey]);
    //     } else {
    //         setOpenKeys([]);
    //     }
    // };

    useEffect(() => {
        loadData()
    }, [workflow])

    useEffect(() => {

        setSideOptions([
            {
                label: "LLM",
                value: "llm-card"
            }, {
                label: "Container App",
                value: "appSessionPage"
            }, {
                label: "Script",
                value: "scriptPage"
            },
            {
                label: "Parameters",
                value: "editParamsPanel"
            }
        ])
        setSideView("editParamsPanel")
        return () => {
            setSideOptions([])
            setSideView("llm-card")
        }
    }, [])

    useEffect(() => {
        if (component) {
            setRelation(component)

        }
        return () => {
            clear()
        }
    }, [component])

    // const isToolsExist = () => {
    //     if (component?.component_id && component?.component_id != "") return true
    //     return false
    // }


    const instance = useMemo(() => {
        return {
            clone: () => {
                loadData()
                // setContentRefreshToken((value) => value + 1)
                // setSidebarRefreshToken((value) => value + 1)
            }, pull: () => {
                // loadData(storeId)
                loadData()
                // setContentRefreshToken((value) => value + 1)
            }, stop: () => {
                loadData()
                // setSidebarRefreshToken((value) => value + 1)
            }, already_exists: (args: any) => {
                // console.log("111111111111111")
                // search("aaa")
                message.error("Component already exists in your tools, please go to tools page to check or uninstall it first.")
                // if (args?.id) {
                //     setParams({ ...params, storeId: args.id });
                // }
                loadData()
            }
        };
    }, [workflow]);


    useEffect(() => {
        if (component?.store_id) {
            register("store", component?.store_id, instance);
            return () => {
                unregister("store", component?.store_id, instance);
            };
        }

    }, [component?.store_id, instance, register, unregister]);


    return <div >
        <Row gutter={[16, 16]}>
            <Col lg={6} sm={6} xs={24}>
                <Card
                    styles={{
                        body: {
                            padding: "0"
                        }
                    }}
                    extra={<Space>
                        {/* <Button size="small" color="cyan" variant="solid" onClick={() => {
                        
                            setPanel("createOrUpdateComponent")
                            setScript({})
                        }}>
                            Create
                        </Button> */}

                        <Button size="small" color="cyan" variant="solid" onClick={async () => {
                            // openModal("installComponents", { relation_type: "tools" })
                            await invoke.installComponentsV2.openAsync({
                                storeType: "workflow",
                            }, {
                                width: "80%",
                                title: `Install ${relation_type}`,
                                footer: null,
                            })
                            loadData()
                        }}>Intsall</Button>

                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            invoke.createOrUpdateRelation.openAsync({})
                            // openModal("createORUpdateCompnentRelation", {
                            //     data: undefined,
                            // pipelineStructure: {
                            //     relation_type: relation_type,
                            // }
                            // })
                        }}>Create</Button>
                    </Space>}
                    size="small"
                >

                    <WorkflowPage onOk={setWorkflow}></WorkflowPage>
                </Card>
            </Col>
            <Col lg={18} sm={18} xs={24}>
                <Card size="small"
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        height: " 100%"
                    }}
                    styles={{
                        body: {
                            padding: 0,
                            // height: "90%",
                            flex: 1,
                            // overflowY: "auto"
                        }
                    }}
                    title={<Space >
                        <Tooltip title={component?.category}>
                            {component?.name}
                        </Tooltip>
                    
                        {component && (
                            <StoreVersionActions
                                entity="workflow"
                                item={component}
                                onReload={loadData}
                                showStop={Boolean(component?.store_url)}
                            />
                        )}

                    </Space>}
                    extra={<Flex justify={"space-between"} align={"center"} gap="small" >
                        <Space wrap>

                          

                            <QuestionCircleOutlined
                                onClick={() => {
                                    // setSize([14, 6])
                                    invoke.markdown.open({ introduction: component?.description }, {
                                        title: `Description - ${component?.name}`,
                                        footer: null,
                                        width: "60%",
                                    })
                                }}
                                style={{ color: "#1890ff" }} />

                                

                            {renderViewButton(view, setView, "datasetFilePage", "Input File")}
                            {renderViewButton(view, setView, "sampleProjectPage", "Input Sample")}

                            {renderViewButton(view, setView, "analysisPage", "Analysis")}
                            {renderViewButton(view, setView, "outputFileComponent", "Output")}

                            {/* {renderViewButton(view, setView, "analysisTools", "Tools Panel")} */}

                            {renderViewButton(view, setView, "workflowComponent", "Workflow")}
                            {renderViewButton(view, setView, "depContainer", "Container")}


                            {renderViewButton(view, (view) => {
                                setView(view)
                                setParams({
                                    structure: {
                                        relation_type: relation_type,
                                    }
                                })
                            }, "createOrUpdateRelation", "Edit Tools")}
                            {/* {(leftPanel != "workflowComponent") ? <Button size="small" color="cyan" variant="solid" onClick={() => {
                        setLeftPanel("workflowComponent")
                    }}>Workflow</Button> : <>
                        <Button size="small" color="blue" variant="solid" icon={<CloseOutlined />} onClick={() => {
                            setLeftPanel("analysisTools")
                        }}>Close</Button>
                    </>} */}
                            {renderViewButton(view, setView, "PublishToolsV2", "Publish")}
                                
                            <Popconfirm
                                title="Delete this workflow?"
                                description="This workflow cannot be deleted if there are associated analysis records."
                                onConfirm={async () => {
                                    try {
                                        await http.post(`/workflow/delete/${encodeURIComponent(component.id)}`);
                                        message.success("Workflow deleted successfully");
                                        // loadData();
                                    } catch {
                                        message.error("Failed to delete workflow");
                                    }
                                }}
                                okText="Delete"
                                okButtonProps={{ danger: true }}
                            >
                                <Button size="small" color="red" variant="outlined" icon={<DeleteOutlined />}>Delete</Button>
                            </Popconfirm>
                            
                            <Button size="small" color="cyan" variant="outlined" icon={<RedoOutlined />} onClick={loadData}></Button>

                        </Space>
                        {/* <Flex gap="small" wrap>
                               
                            </Flex> */}

                    </Flex>}
                >
                    {/* {JSON.stringify(component)} */}


                    {openAnalysis && openAnalysis.length > 0 &&
                        <>

                            <Flex style={{ marginTop: "0.5rem", marginLeft: "0.5rem" }} >

                                <Space>
                                    {openAnalysis.map((item: any) => (
                                        renderCloseViewButton(`${view}-${analysisId}`, (view) => {
                                            setView("analysisNodePanel")
                                            setAnalysisId(item.analysis_id)
                                        }, `${view}-${item.analysis_id}`, item.analysis_name ? item.analysis_name : "Analysis",
                                            () => {
                                                closeAnalysis(item.analysis_id)
                                                setView("analysisList")

                                            })

                                    ))}
                                </Space>
                            </Flex>
                            <Divider></Divider>

                        </>

                    }

                    {(component) ? <>
                        <ViewResolver
                            type={"workflow"}
                            store={component}
                            setView={setView}
                            ref={leftRef}
                            store_id={component?.store_id}
                            relation_id={component?.relation_id}
                            workflow_id={workflow?.id}
                            // workflow={component}
                            callback={loadData}
                            component_id={component?.component_id}
                            component={component}
                            operatePipeline={operatePipeline}
                            project={project_id}
                            componentLayout={componentLayout}
                            view={view}
                            {...parsms}
                        />
                    </> : <Empty></Empty>}
                    {/* component-structure */}

                    {/* <MemoizedComponentsRender
                            setMenus={setMenus}
                            componentLayout={componentLayout}
                            component_type={component_type || ""}
                            component={pipeline}
                            tableRef={tableRef}
                            operatePipeline={operatePipeline} /> */}
                </Card>
            </Col>
        </Row>

        {contextHolder}

        {/* {
                pipeline_type: "wrap_pipeline",
                parent_pipeline_id: "0"

            } */}
        {/* {(modal.key == "modalC" && modal.visible) && <>


        </>} */}
        {/* <ComponentsDetailsRender
            view={modal.key}
            visible={modal.visible}
            params={modal.params}
            onClose={closeModal}
            callback={loadData}
        ></ComponentsDetailsRender> */}



        <ModuleEdit
            visible={modal.key == "modalB" && modal.visible}
            onClose={closeModal}
            callback={loadData}
            params={modal.params}
        >
        </ModuleEdit>
        <CreateORUpdatePipelineCompnentRelation
            callback={loadData}
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modal.key == "modalA" && modal.visible}
            onClose={closeModal}
            params={{ ...modal.params, namespace: pipeline?.namespace }}></CreateORUpdatePipelineCompnentRelation>
        <CreateOrUpdatePipelineComponent
            callback={loadData}
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modal.key == "createOrUpdatePipelineComponent" && modal.visible}
            onClose={closeModal}
            params={modal.params}></CreateOrUpdatePipelineComponent>

        <CreateORUpdatePipelineCompnentRelation
            callback={loadData}
            visible={modal.key == "createORUpdateCompnentRelation" && modal.visible}
            onClose={closeModal}
            params={modal.params}
        ></CreateORUpdatePipelineCompnentRelation>
        {/* 
        <ImportData
            visible={modals.modalD.visible}
            params={modals.modalD.params}
            onClose={() => closeModals("modalD")}></ImportData> */}
        <BioDatabases
            visible={modal.key == "modalE" && modal.visible}
            onClose={closeModal}
            params={modal.params}></BioDatabases>
        <ParamsView
            visible={modal.key == "modalF" && modal.visible}
            onClose={closeModal}
            params={modal.params}></ParamsView>
        <DependComponent
            visible={modal.key == "modalG" && modal.visible}
            onClose={closeModal}
            callback={loadData}
            params={modal.params}></DependComponent>
        <MonacoEditorModal
            visible={modal.key == "modalH" && modal.visible}
            onClose={closeModal}
            value={modal.params}></MonacoEditorModal>
        {/* <AnalysisResultEdit
            visible={modal.key == "analysisResultEdit" && modal.visible}
            onClose={closeModal}
            params={modal.params}></AnalysisResultEdit> */}
        <MetadataModal
            visible={modals.metadataModal.visible}
            onClose={() => closeModals("metadataModal")}
            params={modals.metadataModal.params}></MetadataModal>
        <MetadataForm
            visible={modal.key == "metadataForm" && modal.visible}
            onClose={closeModal}
            params={modal.params}></MetadataForm>
        <BindSample
            visible={modals.bindSample.visible}
            onClose={() => closeModals("bindSample")}
            operatePipeline={operatePipeline}
            params={modals.bindSample.params}></BindSample>

        <FormProject
            params={modal.params}
            visible={modal.key == "projectForm" && modal.visible}
            onClose={closeModal} />

        <OpenFile
            visible={modal.key == "openFile" && modal.visible}
            onClose={closeModal}
            params={modal.params}></OpenFile>

        <SortSoftwareModal
            visible={modal.key == "sortSoftware" && modal.visible}
            onClose={closeModal}
            params={modal.params} callback={loadData}></SortSoftwareModal>
        <DescriptionModal
            visible={modal.key == "descriptionModal" && modal.visible}
            onClose={closeModal}
            params={modal.params} callback={loadData}></DescriptionModal>
        <PublishModal
            visible={modal.key == "publishModal" && modal.visible}
            onClose={closeModal}
            params={modal.params}></PublishModal>

    </div>
}


export default Pipeline


const PublishModal: FC<any> = ({ visible, onClose, params }) => {
    const [storeList, setStoreList] = useState<any>([])
    const [loading, setLoading] = useState(false)
    const [force, setForce] = useState(false)
    const message = useGlobalMessage()
    const loadStoreList = async () => {
        try {
            setLoading(true)
            const resp = await axios.get(`/component-store/list-stores?address=local`)
            setStoreList(resp.data)

            setLoading(false)

        } catch (error: any) {
            // message.error(error.message)
        }

    }

    // component_id: str
    // store_path:Optional[str]=None
    // force: Optional[bool]=False
    const publishToStore = async (relation_id: any, store_path: any = undefined) => {
        try {
            setLoading(true)
            const resp = await axios.post(`/publish-relation`, {
                relation_id: relation_id,
                store_path: store_path,
                force: force
            })
            message.success("Published successfully")
            setLoading(false)
            onClose()
        } catch (error: any) {
            // message.error(error.response?.data?.detail || error.message)
            setLoading(false)
        }
    }
    useEffect(() => {
        if (visible) {
            loadStoreList()
        }
    }, [visible])

    // const { component_type, component_id} = params
    return <Modal
        loading={loading}
        title={<>
            {`Publish ${params?.name} (${params?.relation_type})`}
            <Switch style={{ marginLeft: "1rem" }} checked={force} onChange={(checked) => { setForce(checked) }} /> Force
        </>}
        open={visible}
        onCancel={onClose}
        footer={null}

    >
        {/* {JSON.stringify(params)} */}
        <Flex gap={"small"} style={{ marginBottom: "1rem" }}>
            {/* <Popconfirm title={"pubpish?"} onConfirm={() => publishToStore(params?.component_id, undefined)}>
                <Button size="small" color="cyan" variant="solid"

                >default</Button>
            </Popconfirm> */}


            {storeList.map((item: any, index: any) => (
                <Tooltip title={item.store_path} key={index}>
                    <Popconfirm title={"pubpish?"} onConfirm={() => publishToStore(params?.relation_id, item.store_path)}>

                        <Button size="small" color="cyan" variant="solid"

                        >{item.name}</Button>

                    </Popconfirm>
                </Tooltip>
            ))}
        </Flex>
        {/* {JSON.stringify(storeList)} */}

    </Modal>
}
// interface PipelineComponentProps {
//     operatePipeline: any,
//     component: any,
//     tableRef: any,
//     componentLayout: string

// }
// interface PipelineComponentRenderProps extends PipelineComponentProps {
//     component_type: string,
//     setMenus?: any,
// }

// const PipelineComponent = lazy(() => import('./pipeline'))
// const ComponentsRender = ({ component_type, operatePipeline, component, ...rest }: PipelineComponentRenderProps) => {
//     if (!component_type || !component) return null

//     const componentMap = {
//         "pipeline": PipelineComponent,
//         // "software": SoftwareComponent,
//         // "file": FileComponent,
//         // "script": ScriptComponent,
//         "module": "module-card",
//     }
//     const Component = componentMap[component_type as keyof typeof componentMap]
//     if (!Component) return null
//     return <Suspense fallback={<Skeleton active></Skeleton>}>
//         <Component operatePipeline={operatePipeline} component={component} {...rest} />
//     </Suspense>
// }
// const MemoizedComponentsRender = React.memo(ComponentsRender, (prevProps, nextProps) => {
//     return JSON.stringify(prevProps) === JSON.stringify(nextProps)
// });



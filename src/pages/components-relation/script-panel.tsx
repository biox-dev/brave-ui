import { Button, Card, Col, Empty, Modal, Popconfirm, Row, Segmented, Skeleton, Space, Spin, Table, Tag, Tooltip } from "antd"
import { FC, use, useEffect, useRef, useState } from "react"
import ComponentsPage from "../../components/workflow-page/component/page"
import { useParams } from "react-router"
import ComponentsDetailsRender from "../../core/ui-renderer/ComponentsDetailsRender"
import { CreateOrUpdatePipelineComponent } from "@/components/create-pipeline"
import { useModal } from "@/hooks/useModal"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ApartmentOutlined, CopyOutlined, DeleteOutlined, RedoOutlined } from "@ant-design/icons"
import { useSideViewContext } from "@/context/side/SideViewContext"
import { useStoreRender } from "@/context/render/RenderProvider"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import ScriptPage from "@/components/workflow-page/script-page"
import { invoke } from "@/core/ui-system/invokeV2"
import { renderViewButton } from "@/utils/render-view-btn"
import { http } from "@/api/client/http"

const ComponentsV3: FC<any> = ({ component_type, navigateView }) => {
    const { modal, openModal, closeModal } = useModal();
    // const [segmentedOptions, setSegmentedOptions] = useState<any[]>([])
    // const { component_type } = useParams()
    const tabeRef = useRef<any>(null)
    // const [component, setComponent] = useState<any>()
    const loadTable = () => {
        tabeRef.current?.reload()
    }
    const { setSideView, setSideOptions } = useSideViewContext();
    const { script, setScript, clear } = useStoreRender()

    let [segmentedOptions, setSegmentedOptions] = useState<any[]>([])
    const [panel, setPanel] = useState<any>("analysisNodePage")
    const [loading, setLoading] = useState(false)

    const loadScript = async (scriptId: any) => {
        setLoading(true)
        const resp = await http.get(`/script/${scriptId}/get-script`)
        setScript(resp.data)
        setLoading(false)
    }
    const loadData = () => {
        if (script?.id) {
            loadScript(script?.id)
        }
    }

    useEffect(() => {

        return () => {
            clear()
        }
    }, [])

    useEffect(() => {
        // setScript(undefined)
        if (component_type == "script") {
            setPanel("analysisNodePage")
            setSegmentedOptions([
                {
                    label: "AnalysisNode",
                    value: "analysisNodePage"
                },
                // {
                //     label: "Script View",
                //     value: "scriptView"
                // },
                {
                    label: "structure",
                    value: "createOrUpdateComponent"
                }, {
                    label: "Code",
                    value: "scriptCode"
                }
            ])
        } else if (component_type == "file") {
            setPanel("fileView")
            setSegmentedOptions([
                {
                    label: "File View",
                    value: "fileView"
                },
                {
                    label: "structure",
                    value: "createOrUpdateComponent"
                }
                , {
                    label: "Files",
                    value: "analysisResult"
                }
            ])
        }
    }, [component_type])
    useEffect(() => {
        setSideOptions([
            {
                label: "LLM",
                value: "llm-card"
            }, {
                label: "Container App",
                value: "appSessionPage"
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
    const message = useGlobalMessage()
    // useEffect(() => {
    //     if (!component?.component_id && panel != "structure") {
    //         setPanel("structure")
    //     }
    //     if (panel == "deleted") {
    //         setPanel("structure")
    //     }

    // }, [component])


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
                        <Button size="small" color="cyan" variant="solid" onClick={async () => {
                            // openModal("installComponents", { relation_type: "tools" })
                            await invoke.installComponentsV2.openAsync({
                                storeType: "script",
                            }, {
                                width: "80%",
                                title: `Install script`,
                                footer: null,
                            })
                            // loadData()
                        }}>Intsall</Button>
                        <Button size="small" color="cyan" variant="solid" onClick={async () => {
                            // openModal("createOrUpdatePipelineComponent", {
                            //     data: undefined,
                            //     structure: {
                            //         component_type: component_type,
                            //     }
                            // })
                            // setPanel("createOrUpdateComponent")
                            // setScript(null)
                            await invoke.createOrUpdateComponent.openAsync({})

                        }}>
                            Create
                        </Button>
                    </Space>}
                    size="small"
                >
                    {/* <ComponentsPage
                        ref={tabeRef}
                        component_type={component_type}
                        setComponent={setScript} ></ComponentsPage> */}
                    <ScriptPage onOk={(script) => {

                        loadScript(script?.id)
                    }}></ScriptPage>
                </Card>

            </Col>
            <Col lg={18} sm={18} xs={24}>
                {/* {JSON.stringify(component)} */}
                <Spin spinning={loading}>

                    {script ? <>


                        <Card
                            size="small"
                            title={<Space>
                                {script?.component_name || ''}
                                {script?.component_id && <>

                                    <Popconfirm title="Copy component ?" onConfirm={async (e: any) => {
                                        e.stopPropagation()
                                        await axios.post(`/copy-component/${script.component_id}`)
                                        message.success("Component copied!")
                                        // reload()
                                        loadTable()
                                    }}>
                                        <CopyOutlined onClick={(e) => {
                                            e.stopPropagation()

                                        }} />

                                    </Popconfirm>


                                </>}

                                {script?.store_origin && <Tag color="blue">{script?.store_origin}</Tag>}

                                {script && <>
                                    {!script?.store_version ? <>
                                        <Tag color="red"> {script?.version} (unpublished)</Tag>
                                    </> : <Tooltip title={script?.store_url}>
                                        {script?.store_version === script?.version ?
                                            <Tag style={{ cursor: "pointer" }} onClick={() => {
                                                window.open(script?.store_url, "_blank")
                                            }}> {script.version}</Tag> :
                                            <Tag color="red" style={{ cursor: "pointer" }} onClick={() => {
                                                window.open(script?.store_url, "_blank")
                                            }}>store/current: {script?.store_version}/{script?.version}</Tag>
                                        }

                                    </Tooltip>}
                                    {/* 
                                    <Popconfirm title="Reinstall?" onConfirm={async () => {
                                        // /reinstall-relation/{relation_id}
                                        await axios.post(`/reinstall-relation/${script.id}`)
                                        message.success("ReInstalled successfully!")
                                        loadScript()

                                    }}>
                                        <Button variant="solid" size="small" style={{ cursor: "pointer" }}>ReInstall</Button>

                                    </Popconfirm> */}

                                </>}


                            </Space>}
                            extra={<Space>

                                {/* <Button size="small" color="primary" variant="solid" onClick={() => navigateView("toolsCard")}>Back</Button> */}

                                <Popconfirm
                                    title="Are you sure to delete this component?"
                                    description="Cannot delete if analysis nodes exist or this script is referenced in a workflow."
                                    onConfirm={async () => {
                                        await http.post(`/script/delete/${encodeURIComponent(script.id)}`);
                                        message.success("Component deleted!");
                                        clear();
                                        loadTable()
                                    }}
                                >
                                    <Button size="small" color="red" variant="outlined" icon={<DeleteOutlined />}>Delete</Button>

                                </Popconfirm>


                                {script?.component_id &&
                                    <>
                                        <ApartmentOutlined style={{ cursor: "pointer" }} onClick={(e) => {
                                            e.stopPropagation()
                                            openModal("componentRelation", {
                                                component_id: script.component_id,
                                                component_name: script.component_name,
                                            })
                                        }} />
                                        <Segmented size="small" value={panel}
                                            onChange={(val: any) => setPanel(val)}
                                            options={segmentedOptions} />
                                    </>}

                                {renderViewButton(panel, setPanel, "PublishToolsV2", "Publish")}
                                <Button size="small" color="cyan" variant="outlined" icon={<RedoOutlined />} onClick={loadData}></Button>

                            </Space>}

                        >
                            {panel ? <>
                                <ViewResolver
                                    type="script"
                                    store={script}
                                    callback={loadTable}
                                    view={panel}
                                    script_id={script.id}
                                    component={script}
                                    openModal={openModal}
                                    structure={{
                                        component_type: component_type,
                                    }}
                                // component_type={component_type}
                                ></ViewResolver>

                            </> : <Skeleton active></Skeleton>}

                            {/* {panel == "deleted" ? <Empty description="Component has been deleted"></Empty> : <>


                        </>} */}
                        </Card >


                    </> : <>
                        <Card>
                            <Empty description="Please select a component on the left"></Empty>
                        </Card>
                    </>}
                </Spin>
                {/* {component_type} */}
                {/* <ComponentDetails componentType={component_type} /> */}
            </Col>
        </Row>

        <ComponentRelation
            visible={modal.key == "componentRelation" && modal.visible}
            onClose={closeModal}
            params={modal.params}></ComponentRelation>
        {/* <CreateOrUpdatePipelineComponent
            callback={loadTable}
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modal.key == "createOrUpdatePipelineComponent" && modal.visible}
            onClose={closeModal}
            params={modal.params}></CreateOrUpdatePipelineComponent> */}
    </div>

}
export default ComponentsV3



const ComponentRelation: FC<any> = ({ visible, onClose, params }) => {
    // /list-component-relation/{component_id}
    const [data, setData] = useState<any[]>([])
    const loadData = async () => {
        const res = await axios.get(`/list-component-relation/${params.component_id}`)
        setData(res.data)
    }
    useEffect(() => {
        if (visible) {
            loadData()
        }
    }, [visible])
    return <Modal
        open={visible}
        onCancel={onClose}
        width={800}
        title={`Component Relation(${params?.component_name})`}
        footer={null}
    >
        {/* {JSON.stringify(data, null, 2)} */}
        <Table
            dataSource={data}
            rowKey={"relation_id"}
            footer={() => `Total ${data.length} items`}
            pagination={false}
            columns={[
                {
                    title: "Relation ID",
                    dataIndex: "relation_id",
                }, {
                    title: "Relation Name",
                    dataIndex: "name",
                }
            ]}
        ></Table>
    </Modal>
}
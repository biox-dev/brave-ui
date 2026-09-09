import { Button, Card, Col, Empty, Modal, Popconfirm, Row, Segmented, Skeleton, Space, Table } from "antd"
import { FC, use, useEffect, useRef, useState } from "react"
import ComponentsPage from "../../components/workflow-page/component/page"
import { useParams } from "react-router"
import ComponentsDetailsRender from "../../core/ui-renderer/ComponentsDetailsRender"
import { CreateOrUpdatePipelineComponent } from "@/components/create-pipeline"
import { useModal } from "@/hooks/useModal"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ApartmentOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons"

const Components: FC<any> = () => {
    const { modal, openModal, closeModal } = useModal();
    // const [segmentedOptions, setSegmentedOptions] = useState<any[]>([])
    const { component_type } = useParams()
    const tabeRef = useRef<any>(null)
    const [component, setComponent] = useState<any>()
    const loadTable = () => {
        tabeRef.current?.reload()
    }
    let [segmentedOptions, setSegmentedOptions] = useState<any[]>([])
    const [panel, setPanel] = useState<string>()

    useEffect(() => {

        if (component_type == "script") {
            setPanel("llmScript")
            setSegmentedOptions([
                {
                    label: "LLM",
                    value: "llmScript"
                },
                {
                    label: "structure",
                    value: "createOrUpdateScript"
                }, {
                    label: "Code",
                    value: "scriptCode"
                }
            ])
        } else if (component_type == "file") {
            setPanel("llmFile")
            setSegmentedOptions([
                {
                    label: "LLM",
                    value: "llmFile"
                },
                {
                    label: "structure",
                    value: "createOrUpdateScript"
                }
                , {
                    label: "Files",
                    value: "analysisResult"
                }
            ])
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


    return <div style={{ maxWidth: "1800px", margin: "1rem auto", padding: '0 16px 0 16px' }}>
        <Row gutter={[16, 16]}>
            <Col lg={6} sm={6} xs={24}>
                <Card
                    styles={{
                        body: {
                            padding: "0"
                        }
                    }}
                    extra={<>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            // openModal("createOrUpdatePipelineComponent", {
                            //     data: undefined,
                            //     structure: {
                            //         component_type: component_type,
                            //     }
                            // })
                            setPanel("createOrUpdateScript")
                            setComponent({})
                        }}>
                            Create
                        </Button>
                    </>}
                    size="small"
                >
                    <ComponentsPage
                        ref={tabeRef}
                        component_type={component_type}
                        setComponent={setComponent} ></ComponentsPage>
                </Card>

            </Col>
            <Col lg={18} sm={18} xs={24}>
                {/* {JSON.stringify(component)} */}
                {component ? <>


                    <Card
                        size="small"
                        title={<Space>
                            {component?.component_name || ''}
                            {component?.component_id && <>

                                <Popconfirm title="Copy component ?" onConfirm={async (e: any) => {
                                    e.stopPropagation()
                                    await axios.post(`/copy-component/${component.component_id}`)
                                    message.success("Component copied!")
                                    // reload()
                                    loadTable()
                                }}>
                                    <CopyOutlined onClick={(e) => {
                                        e.stopPropagation()

                                    }} />

                                </Popconfirm>


                            </>}

                        </Space>}
                        extra={<Space>

                            <Popconfirm title="Are you sure to delete this component?" onConfirm={async (e: any) => {
                                await axios.delete(`/delete-component/${component.component_id}`)
                                message.success("Component deleted!")
                                setPanel("deleted")
                                // reload()
                                loadTable()
                            }}>
                                <DeleteOutlined style={{ color: "red" }} onClick={(e) => {
                                    e.stopPropagation()

                                }} />

                            </Popconfirm>


                            {component?.component_id &&
                                <>
                                    <ApartmentOutlined style={{ cursor: "pointer" }} onClick={(e) => {
                                        e.stopPropagation()
                                        openModal("componentRelation", {
                                            component_id: component.component_id,
                                            component_name: component.component_name,
                                        })
                                    }} />
                                    <Segmented size="small" value={panel}
                                        onChange={(val: any) => setPanel(val)}
                                        options={segmentedOptions} />
                                </>}
                        </Space>}

                    >
                        {panel ? <>

                            <ComponentsDetailsRender
                                callback={loadTable}
                                view={panel}
                                component={component}
                                openModal={openModal}
                                component_type={component_type}
                            ></ComponentsDetailsRender>

                        </> : <Skeleton active></Skeleton>}

                        {/* {panel == "deleted" ? <Empty description="Component has been deleted"></Empty> : <>


                        </>} */}
                    </Card >


                </> : <>
                    <Card>
                        <Empty description="Please select a component on the left"></Empty>
                    </Card>
                </>}
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
export default Components



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
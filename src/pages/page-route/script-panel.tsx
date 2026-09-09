import { Button, Card, Col, Empty, Modal, Popconfirm, Row, Skeleton, Space, Spin, Table } from "antd"
import { FC, use, useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import ComponentsDetailsRender from "../../core/ui-renderer/ComponentsDetailsRender"
import { CreateOrUpdatePipelineComponent } from "@/components/create-pipeline"
import { useModal } from "@/hooks/useModal"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ApartmentOutlined, CopyOutlined, DeleteOutlined, RedoOutlined } from "@ant-design/icons"
import { useSideViewContext } from "@/context/side/SideViewContext"
import { useStoreRender } from "@/context/render/RenderProvider"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import { invoke } from "@/core/ui-system/invokeV2"
import { renderViewButton } from "@/utils/render-view-btn"
import { http } from "@/api/client/http"
import StoreVersionActions from "../components-relation/components/store-version-actions"
import { useI18n } from "@/hooks/useI18n"

const ComponentsV3: FC<any> = ({ component_type, navigateView }) => {
    const { script_id } = useParams()
    const navigate = useNavigate()
    const { modal, openModal, closeModal } = useModal();
    const { locale } = useI18n();

    // const [segmentedOptions, setSegmentedOptions] = useState<any[]>([])
    // const { component_type } = useParams()
    const tabeRef = useRef<any>(null)
    // const [component, setComponent] = useState<any>()
    const loadTable = () => {
        tabeRef.current?.reload()
    }
    // const { setSideView, setSideOptions, setLeftPaneContent, clearLeftPane } = useSideViewContext();
    const { script, setScript, clear } = useStoreRender()

    const [panel, setPanel] = useState<any>("analysisNodePage")
    const [loading, setLoading] = useState(false)

    const loadScript = useCallback(async (scriptId: any) => {
        setLoading(true)
        const resp = await http.get(`/script/${scriptId}/get-script`)
        setScript(resp.data)
        setLoading(false)
    }, [])
    const loadData = () => {
        if (script?.id) {
            loadScript(script?.id)
        }
    }

    useEffect(() => {
        if (component_type !== "script" || !script_id) {
            return
        }
        loadScript(decodeURIComponent(script_id))
    }, [component_type, script_id, loadScript])

    useEffect(() => {

        return () => {
            clear()
        }
    }, [])

    useEffect(() => {
        setPanel("analysisNodePage")
    }, [component_type])

    const message = useGlobalMessage()
 

    return <div >
        <Row gutter={[16, 16]}>
            <Col span={24}>
                {/* {JSON.stringify(component)} */}
                <Spin spinning={loading}>

                    {script ? <>


                        <Card
                            size="small"
                            title={<Space>
                                {script?.component_name || ''}
                            
                                {script && <>
                                    <StoreVersionActions
                                        entity="script"
                                        item={script}
                                        onReload={loadData}
                                    />

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
                                        {renderViewButton(panel, setPanel, "analysisNodePage", "AnalysisNode")}
                                        {renderViewButton(panel, setPanel, "createOrUpdateScript", "structure")}
                                        {renderViewButton(panel, setPanel, "scriptCode", "Code")}
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
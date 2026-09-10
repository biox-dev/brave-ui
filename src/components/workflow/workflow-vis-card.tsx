import ComponentsDetailsRender from "@/core/ui-renderer/ComponentsDetailsRender"
import { Button, Card, Popconfirm, Space } from "antd"
import { FC, useState } from "react"
import { AppstoreOutlined, CloseOutlined, DeleteColumnOutlined, DeleteOutlined, DownOutlined, PlusOutlined, QuestionCircleOutlined, RedoOutlined } from '@ant-design/icons'
import { renderViewButton } from "@/utils/render-view-btn"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import { invoke } from "@/core/ui-system/invokeV2"
import { ActionDispatcher } from "@/event-bus/dispatcher"
import { http } from "@/api/client/http"

const WorkflowComponent: FC<any> = ({ workflow }) => {
    const defaultView = "workflow-vis"
    const [view, setView] = useState<any>(defaultView)
    // const [params, setParams] = useState<any>({})
    // const isToolsExist = () => {
    //     if (workflow?.component_id && component?.component_id != "") return true
    //     return false
    // }
    // relationDefinitionDAG

    return <Card size="small" bordered={false}
        extra={<Space size={"small"}>
            {/* {(view != "relationDefinitionDAG") ? <Button size="small" color="cyan" variant="solid" onClick={() => {
                setView("relationDefinitionDAG")
            }}>DAG Definition</Button> : <>
                <Button size="small" color="blue" variant="solid" icon={<CloseOutlined />} onClick={() => {
                    setView(defaultView)
                }}>Close</Button>
            </>} */}

            {renderViewButton(view, setView, "workflow-vis", "Visualization")}

            {renderViewButton(view, setView, "relationDefinitionDAG", "DAG Definition")}
            <Button size="small" color="cyan" variant={"outlined"} onClick={async () => {
                const script = await invoke.scriptPageCard.openAsync({}, { footer: null, width: 800, title: "Add Script to Node" })
                console.log(script)
                if (!workflow?.id) {
                    console.error("workflow  不存在！")
                    return
                }
                const resp = await http.get(`/workflow/script-to-node?scriptId=${script?.id}&workflowId=${workflow?.id}`)
                // return resp.data
                // console.log("Response from script-to-node API", resp.data)
                const data = {
                    action: "component.invoke",
                    payload: {
                        category: "graph",
                        id: workflow?.id,
                        method: "addNode",
                        args: resp.data
                    }
                }
                ActionDispatcher.dispatch(data.action, data.payload);
            }
            }>
                Add Node
            </Button>
            <Button
                size="small"
                color="cyan"
                variant={"outlined"}
                onClick={async () => {
                    try {
                        await invoke.createOrUpdateScript.openDrawerAsync(
                            {
                                // component_id: data.script_id,
                                structure: {
                                    component_type: "script",
                                },
                            },
                            {
                                width: 960,
                                title: `Create Script`,
                            }
                        );
                        const data = {
                            action: "component.invoke",
                            payload: {
                                category: "tables",
                                id: "script-table",
                                method: "reload",
                                args: {

                                }
                            }
                        }
                        ActionDispatcher.dispatch(data.action, data.payload);
                    } catch (error) {

                    }


                }}
            >
                Create Script
            </Button>

            {/* {(view != "createOrUpdateComponent") ? <Button size="small" color="cyan" variant="solid" onClick={() => {
                setView("createOrUpdateComponent")
                setParams({
                    structure: {
                        component_type: "script",
                    }
                })
            }}>
                {isToolsExist() ? "Update" : "Create"} Script</Button> : <>
                <Button size="small" color="blue" variant="solid" icon={<CloseOutlined />} onClick={() => {
                    setView(defaultView)
                }}>Close</Button>
            </>} */}
            {/* {isToolsExist() && <>
                {(view != "component-script") ? <Button size="small" color="cyan" variant="solid" onClick={() => {
                    setView("component-script")
                }}>Code</Button> : <>
    
                    <Space.Compact>
                        <Button size="small" color="blue" variant="solid" icon={<CloseOutlined />} onClick={() => {
                            setView(defaultView)
                        }}>Code</Button>

                    </Space.Compact>

                </>}

                {(view != "component-structure") ? <Button size="small" color="cyan" variant="solid" onClick={() => {
                    setView("component-structure")
                }}>Structure</Button> : <>
                    <Space.Compact>
                        <Button size="small" color="blue" variant="solid" icon={<CloseOutlined />} onClick={() => {
                            setView(defaultView)
                        }}>Structure</Button>
               
                    </Space.Compact>

                </>}


            </>} */}

        </Space >}
    >

        <ViewResolver
            // {...params}
            workflow_id={workflow?.id}
            dag_definition={workflow.dag_definition}
            component_id={workflow?.component_id}
            view={view}
        />
    </Card >
}
export default WorkflowComponent
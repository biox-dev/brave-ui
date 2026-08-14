import { Button, Input, Popover, Spin, Table, Image, Typography, Collapse, Flex, Card, Skeleton, Tag, Tabs, Row, Col, Popconfirm, Drawer, Form, Tooltip, Space, Select } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC, forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from "react";
import Markdown from '@/components/markdown'
import axios from "axios";
import LogFile from "@/components/log-file";
import { DeleteColumnOutlined, DeleteOutlined, QuestionCircleOutlined } from "@ant-design/icons"
import { MonacoEditor } from "@/components/react-monaco-editor";
import { useNavigate, useOutletContext } from "react-router";
import { findAnalysisById, runAnalysisApi, stopAnalysisNodeApi } from "@/api/analysisv1";
import { useModal, useModals } from "@/hooks/useModal";
// import FormJsonComp from "@/components/form-components";
import ParamsView from "@/components/params-view";
import Project from "@/pages/project";
import BioDatabaseForm from "@/components/bio-database-form";
import BioDatabases from "@/components/bio-databases";
import { useSelector } from "react-redux";
import { useStoreRender } from "@/context/render/RenderProvider";
import { ActionDispatcher } from "@/event-bus/dispatcher";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";
import { http } from "@/api/client/http";
const RenderFromJson = lazy(() => import("./render-form-json"));


const CreateOrUpdateParsms: FC<any> = ({ form, showCreate = false,
    requestParam, dataMap, formJson, jobStatus,
    databases, callback, analysisResultId, showCancal = false }) => {
    const { modals, openModals, closeModals } = useModals(["paramsView", "bioDatabases"]);
    const [loading, setLoading] = useState<boolean>(false)
    const [controllerVersion, setControllerVersion] = useState<"V1" | "V2" | "V3">("V2")
    const messageApi = useGlobalMessage()
    const { project } = useSelector((state: any) => state.user);
    const { setAnalysisId, analysisNodeId, setAnalysisNodeId, formStatus, setFormStatus, analysisId, script } = useStoreRender()

    // const [jobStatus, setJobStatus] = useState<string>(job_status )
    // useEffect(() => {
    //     // setJobStatus(job_status)
    //     jobStatus.current=job_status
    // }, [job_status])

    // useEffect(()=>{

    // },[project])



    const getRequestParams = (values: any) => {
        const requestParams = {
            ...requestParam,
            ...values,
            project: project,
        }
        return requestParams
    }
    // const createAnalysis = async () => {
    //     const values = await form.validateFields()
    //     const requestParams = getRequestParams(values)
    //     delete requestParams.analysis_id
    //     console.log(requestParams)
    //     try {
    //         setLoading(true)

    //         const resp: any = await axios.post(`/fast-api/analysis-controller`, {
    //             request_param: requestParams,
    //             is_report: true,
    //             save: true,
    //             is_submit: false,
    //         })
    //         setLoading(false)
    //         // setFilePlot(resp.data)
    //         // setAnalysisParams(resp.data)
    //         console.log(resp)

    //         messageApi.success("Created Successfully!")
    //         if (callback) {
    //             callback()
    //         }
    //     } catch (error: any) {
    //         console.log(error)
    //         if (error.response?.data) {
    //             messageApi.error(error.response.data.detail)
    //         }
    //     }
    // }
    const saveUpstreamAnalysis = async (save: any, is_submit: any = false) => {
        const values = await form.validateFields()
        const requestParams = getRequestParams(values)
        setLoading(true)
        try {
            // let url = `/fast-api/analysis-controller?save=${save}&is_submit=${is_submit}`
            // if (analysisNodeId){
            //     url = `/fast-api/analysis-node-controller?save=${save}&is_submit=${is_submit}&analysis_node_id=${analysisNodeId}`
            // }
            //             request_param: Dict[str, Any]
            // save: Optional[bool] = False
            // is_submit: Optional[bool] = False
            // is_report: Optional[bool] = None
            // analysis_node_id: Optional[str] = None
            // const resp: any = await axios.post(`/fast-api/analysis-controller`, {
            //     request_param: requestParams,
            //     save: save,
            //     is_submit: is_submit,
            //     analysis_node_id: analysisNodeId
            // })
            const controllerPathMap: Record<"V1" | "V2" | "V3", string> = {
                V1: `/analysis/controller`,
                V2: `/analysis/controllerV2`,
                V3: `/analysis/controllerV3`,
            }
            const controllerPath = script ? "/analysis/controller-script" : controllerPathMap[controllerVersion]

            const resp = await http.post(controllerPath, {
                request_param: requestParams,
                save: save,
                is_submit: is_submit
            })
            // setFilePlot(resp.data)
            // setAnalysisParams(resp.data)
            // console.log(resp)
            // if (jobStatus && is_submit) {
            //     // jobStatus.current = "running"

            // }
            if (is_submit) {
                setFormStatus("running")
            }
            if (save) {
                messageApi.success("save successful!")
                // setToolsPanelView("analysisList")
                if (script) {
                    setAnalysisNodeId(resp.data.analysis_node_id)
                } else {
                    if (resp.data.analysis_id) {
                        setAnalysisId(resp.data.analysis_id)
                    }
                    const data = [
                        {
                            action: "component.invoke",
                            payload: {
                                category: "tables",
                                id: "analysis-list",
                                method: "reload",
                            }
                        }
                    ]
                    if (analysisId) {
                        data.push({
                            action: "component.invoke",
                            payload: {
                                category: "analysis",
                                id: analysisId,
                                method: "reload",
                            }
                        })
                    }

                    ActionDispatcher.dispatchList(data);
                }


                if (callback) {
                    callback()
                }
            } else {
                // openModals("paramsView", resp.data)
                invoke.paramsView.drawer({
                    data: resp.data,
                }, {
                    width: "60%",
                    title: "Parameters",
                    footer: null,
                })
            }
        } catch (error: any) {
            console.log(error)
            if (error.response?.data) {
                messageApi.error(error.response.data.detail)
            }
        }

        // setAnalysisId()
        setLoading(false)
    }



    const saveUpstreamAnalysisOld = async (save: any, is_submit: any = false) => {
        const values = await form.validateFields()
        const requestParams = getRequestParams(values)
        setLoading(true)
        try {
            // let url = `/fast-api/analysis-controller?save=${save}&is_submit=${is_submit}`
            // if (analysisNodeId){
            //     url = `/fast-api/analysis-node-controller?save=${save}&is_submit=${is_submit}&analysis_node_id=${analysisNodeId}`
            // }
            //             request_param: Dict[str, Any]
            // save: Optional[bool] = False
            // is_submit: Optional[bool] = False
            // is_report: Optional[bool] = None
            // analysis_node_id: Optional[str] = None
            const resp: any = await axios.post(`/fast-api/analysis-controller`, {
                request_param: requestParams,
                save: save,
                is_submit: is_submit,
                analysis_node_id: analysisNodeId
            })
            // const resp = await http.post(`/analysis/controller`, {
            //     request_param: requestParams,
            //     save: save,
            //     is_submit: is_submit
            // })
            // setFilePlot(resp.data)
            // setAnalysisParams(resp.data)
            // console.log(resp)
            // if (jobStatus && is_submit) {
            //     // jobStatus.current = "running"

            // }
            if (is_submit) {
                setFormStatus("running")
            }
            if (save) {
                messageApi.success("save successful!")
                // setToolsPanelView("analysisList")
                if (resp.data.analysis_id) {
                    setAnalysisId(resp.data.analysis_id)
                }
                const data = [
                    {
                        action: "component.invoke",
                        payload: {
                            category: "tables",
                            id: "analysis-list",
                            method: "reload",
                        }
                    }
                ]
                if (analysisId) {
                    data.push({
                        action: "component.invoke",
                        payload: {
                            category: "analysis",
                            id: analysisId,
                            method: "reload",
                        }
                    })
                }

                ActionDispatcher.dispatchList(data);

                if (callback) {
                    callback()
                }
            } else {
                // openModals("paramsView", resp.data)
                invoke.paramsView.drawer({
                    data: resp.data,
                }, {
                    width: "60%",
                    title: "Parameters",
                    footer: null,
                })
            }
        } catch (error: any) {
            console.log(error)
            if (error.response?.data) {
                messageApi.error(error.response.data.detail)
            }
        }

        // setAnalysisId()
        setLoading(false)
    }

    return <Suspense fallback={<Skeleton active></Skeleton>}>
        {/* {JSON.stringify(formJson)} */}
        <Spin spinning={loading}>
            <Form size="small" form={form}
                // labelCol={{ span: 8 }}
                // wrapperCol={{ span: 16 }}
                layout="vertical" onValuesChange={(changedValues, allValues) => {
                    // onChange(allFields);
                    // console.log(_)
                    // if(changedValues?.addedProject){
                    //     // console.log(onChangeAddProject)


                    // }

                }}>
                <RenderFromJson
                    analysisResultId={analysisResultId}
                    formJson={formJson}
                    databases={databases}
                    dataMap={dataMap}
                ></RenderFromJson>
                <Form.Item label="Analysyis Name" name={"analysis_name"} style={{ maxWidth: 600 }} rules={[{ required: true, message: 'This field cannot be empty!' }]}>
                    <Input></Input>
                </Form.Item>
                <Flex gap={"small"} justify="space-between">

                    {formStatus == "running" || formStatus == "stopping" || formStatus == "submitted" ?
                        // <Popconfirm title="Are you sure to stop the analysis?" onConfirm={async () => {
                        //     setFormStatus("stopping")
                        //     if (analysisNodeId) {
                        //         await stopAnalysisNodeApi(analysisNodeId, "node")
                        //         messageApi.success("Node analysis stopped!")
                        //     } else {

                        //         await axios.post(`/analysis-runtime/running-dags/${analysisId}/stop`)
                        //         messageApi.success("Analysis stopped!")
                        //     }
                        //     // 
                        // }}>
                        //     <Button disabled={formStatus == "stopping"} size="small" color="cyan" variant="solid" >
                        //         Stop
                        //     </Button>

                        // </Popconfirm>
                        <Button disabled={formStatus == "stopping"} size="small" color="cyan" variant="solid"
                            onClick={async () => {
                                try {
                                    if (script) {
                                        if (!analysisNodeId) {
                                            messageApi.error("analysis_node_id is required")
                                            return
                                        }
                                        setFormStatus("stopping")
                                        await http.post(`/analysis/node/stop/${analysisNodeId}`)
                                        messageApi.success("Node stop requested")
                                        return
                                    }
                                    if (!analysisId) {
                                        messageApi.error("analysis_id is required")
                                        return
                                    }
                                    setFormStatus("stopping")
                                    await http.post(`/analysis/stop/${analysisId}`)
                                    messageApi.success("Analysis stop requested")
                                } catch (error: any) {
                                    setFormStatus("running")
                                    if (error?.response?.data?.detail) {
                                        messageApi.error(error.response.data.detail)
                                    } else {
                                        messageApi.error("Stop request failed")
                                    }
                                }

                            }}>Go Stop</Button>
                        :
                        // <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid"
                        //     onClick={async () => {
                        //         const values = await form.validateFields()
                        //         const requestParams = getRequestParams(values)


                        //     }}>Submit {analysisNodeId ? "Node" : ""}</Button>
                        <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true, true)}>
                            Submit {analysisNodeId ? "Node" : ""}
                        </Button>
                    }
                    <Space >




                        {!analysisNodeId && <Form.Item
                            noStyle
                            initialValue={4}
                            name={`cache_type`}
                        >
                            <Select
                                size="small"
                                disabled={formStatus == "running"}
                                style={{ minWidth: 50 }}
                                options={[
                                    { value: 1, label: "RerunAll" },
                                    { value: 2, label: "ReuseNode" },
                                    { value: 3, label: "ReuseCode" },
                                    { value: 4, label: "ReuseBoth" },
                                ]}
                            />
                        </Form.Item>}
                        {/* <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid"
                            onClick={async () => {
                                const values = await form.validateFields()
                                const requestParams = getRequestParams(values)
                                await http.post(`/analysis/controller`, {

                                    request_param: requestParams,
                                    save: true,
                                    is_submit: false
                                })
                            }}>
                            {requestParam?.analysis_id ? <>Update </> : <>Create</>}</Button> */}
                            {/* {JSON.stringify(requestParam)} */}
                        <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true)}>
                            {requestParam?.analysis_id || requestParam?.analysis_node_id ? <>Update </> : <>Create</>}</Button>

                        <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => {
                            saveUpstreamAnalysis(false)
                        }}>Parameters</Button>

                        {/* {showCreate &&
                            <Popconfirm title="Are you sure to create a new analysis?"
                                onConfirm={createAnalysis}
                            >
                                <Button disabled={formStatus == "running"} size="small" color="orange" variant="solid" onClick={() => form.setFieldValue("analysis_id", undefined)}>Copy</Button>
                            </Popconfirm>
                        } */}
                    </Space>

                    {/* <Space>
                        {!analysisNodeId && <Form.Item
                            noStyle
                            initialValue={false}
                            label="is cache"
                            name={`is_cache`}
                            valuePropName="checked"
                        >
                            <Switch size="small" checkedChildren="cache" unCheckedChildren="no-cache" disabled={formStatus == "running"} />
                        </Form.Item>}

                        <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => {
                            saveUpstreamAnalysis(false)
                        }}>Parameters</Button>

                        <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true)}>
                            {requestParam?.analysis_id ? <>Update </> : <>Create</>}</Button>
                        {(requestParam?.analysis_id && showCancal) && <Button size="small" color="cyan" onClick={() => form.setFieldValue("analysis_id", undefined)}>Cancel</Button>}

                        {showCreate &&
                            <Popconfirm title="Are you sure to create a new analysis?"
                                onConfirm={createAnalysis}
                            >
                                <Button disabled={formStatus == "running"} size="small" color="orange" variant="solid" onClick={() => form.setFieldValue("analysis_id", undefined)}>Copy</Button>
                            </Popconfirm>
                        }
                    </Space> */}


                </Flex>

                {/* <Form.Item name={"anno1"}>
                <Input></Input>
            </Form.Item>
        <Button onClick={()=>{
                    form.setFieldValue("eggnog", 6491)
                }}> aa</Button> */}
                <Collapse ghost items={[
                    {
                        key: "1",
                        label: "More",
                        children: <>
                            <Form.Item noStyle shouldUpdate>
                                {() => (
                                    <Typography>
                                        <pre>{JSON.stringify(getRequestParams(form.getFieldsValue()), null, 2)}</pre>
                                    </Typography>
                                )}
                            </Form.Item>
                        </>
                    }
                ]} />

                {!script && <Space>
                    <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid"
                        onClick={async () => {
                            const values = await form.validateFields()
                            const requestParams = getRequestParams(values)
                            await http.post(`/analysis/parse-params`, {
                                request_param: requestParams
                            })

                        }}> debug Parameters</Button>
                    <Select
                        size="small"
                        value={controllerVersion}
                        onChange={setControllerVersion}
                        style={{ minWidth: 80 }}
                        options={[
                            { value: "V1", label: "V1" },
                            { value: "V2", label: "V2" },
                            { value: "V3", label: "V3" },
                        ]}
                    />
                    {/* <Button disabled={formStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => {
                        saveUpstreamAnalysisOld(false)
                    }}>Old Parameters</Button> */}

                </Space>}

            </Form>
        </Spin>


        <ParamsView

            visible={modals.paramsView.visible}
            onClose={() => closeModals("paramsView")}
            params={modals.paramsView.params}></ParamsView>

    </Suspense>
}

export default CreateOrUpdateParsms;
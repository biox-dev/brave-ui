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


// 分析元数据字段：统一走 controller 请求的顶层字段，绝不写入 request_param，
// 保证 request_param 只包含分析参数。
const RESERVED_PARAM_KEYS = ["analysis_id", "analysis_node_id", "script_id", "workflow_id", "analysis_name", "cache_type", "executor"]

const CreateOrUpdateParsms: FC<any> = ({ form, showCreate = false,
    requestParam, workflowId, scriptId, cacheType, dataMap, formJson, jobStatus,
    databases, callback, analysisResultId, showCancal = false }) => {
    const { modals, openModals, closeModals } = useModals(["paramsView", "bioDatabases"]);
    const [loading, setLoading] = useState<boolean>(false)
    const [scheduler, setScheduler] = useState<string>("dynamic")
    const messageApi = useGlobalMessage()
    const { project } = useSelector((state: any) => state.user);
    const { setAnalysisId, analysisNodeId, setAnalysisNodeId, formStatus, setFormStatus, analysisId, script } = useStoreRender()

    // 把表单值合并进分析参数后剔除元数据键，得到纯净的 request_param。
    const getRequestParams = (values: any = {}) => {
        const requestParams = { ...requestParam, ...values }
        RESERVED_PARAM_KEYS.forEach((key) => delete requestParams[key])
        return requestParams
    }

    // buildPayload 组装统一的 controller 请求体：
    // 分析元数据（主键 / 工作流 / 脚本 / 节点 / 名称 / 缓存策略）全部放顶层。
    const buildPayload = (values: any, save: boolean, is_submit: boolean) => ({
        request_param: getRequestParams(values),
        analysis_id: analysisId ?? undefined,
        analysis_node_id: analysisNodeId ?? undefined,
        script_id: scriptId ?? script?.id,
        workflow_id: workflowId,
        node_name: values?.analysis_name,
        cache_type: values?.cache_type ?? cacheType,
        scheduler,
        save,
        is_submit,
    })

    const saveUpstreamAnalysis = async (save: any, is_submit: any = false) => {
        const values = await form.validateFields()
        setLoading(true)
        try {
            // 脚本节点走 controller-script；流程分析走 controller。
            // 后端按 scheduler 选择编排器，并把它持久化为 analysis.scheduler_mode。
            const controllerPath = analysisNodeId || script ? "/analysis/controller-script" : "/analysis/controller"
            const resp = await http.post(controllerPath, buildPayload(values, save, is_submit))
            if (is_submit) {
                setFormStatus("running")
            }
            if (save) {
                messageApi.success("save successful!")
                if (script) {
                    setAnalysisNodeId(resp.data.analysis_node_id)
                } else {
                    if (resp.data.analysis_id) {
                        setAnalysisId(resp.data.analysis_id)
                    }
                    const actions = [
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
                        actions.push({
                            action: "component.invoke",
                            payload: {
                                category: "analysis",
                                id: analysisId,
                                method: "reload",
                            }
                        })
                    }

                    ActionDispatcher.dispatchList(actions);
                }


                if (callback) {
                    callback()
                }
            } else {
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
                                    if (script || analysisNodeId) {
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
                            {analysisId || analysisNodeId ? <>Update </> : <>Create</>}</Button>

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
                            await http.post(`/analysis/parse-params`, buildPayload(values, false, false))
                        }}> debug Parameters</Button>
                    <Select
                        size="small"
                        value={scheduler}
                        onChange={setScheduler}
                        style={{ minWidth: 110 }}
                        options={[
                            { value: "dag", label: "dag" },
                            { value: "dynamic", label: "dynamic" },
                            { value: "dataflow", label: "dataflow" },
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
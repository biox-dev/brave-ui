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
    databases, callback, analysisResultId, showCancal = false,
    // 显式目标参数（参数面板会传入）：不传时回退到 RenderProvider 的全局上下文，
    // 兼容其它直接使用本组件的页面（分析编辑弹窗、软件分析面板等）。
    analysisId, analysisNodeId, isScriptTarget, formStatus, setFormStatus,
    setAnalysisId, setAnalysisNodeId }) => {
    const { modals, openModals, closeModals } = useModals(["paramsView", "bioDatabases"]);
    const [loading, setLoading] = useState<boolean>(false)
    const [scheduler, setScheduler] = useState<string>("dynamic")
    const messageApi = useGlobalMessage()
    const { project } = useSelector((state: any) => state.user);
    const renderStore = useStoreRender() ?? {}
    // 显式传 null 表示「这个目标没有该 id」，不能回退到全局上下文
    // （否则在多个页面同时打开时会把别的页面选中的分析 / 脚本带进来）。
    const effectiveAnalysisId = analysisId !== undefined ? analysisId : renderStore.analysisId
    const effectiveAnalysisNodeId = analysisNodeId !== undefined ? analysisNodeId : renderStore.analysisNodeId
    const effectiveFormStatus = formStatus !== undefined ? formStatus : renderStore.formStatus
    const effectiveSetFormStatus = setFormStatus ?? renderStore.setFormStatus
    const effectiveSetAnalysisId = setAnalysisId ?? renderStore.setAnalysisId
    const effectiveSetAnalysisNodeId = setAnalysisNodeId ?? renderStore.setAnalysisNodeId
    // 脚本节点：显式 isScriptTarget 优先；否则沿用全局 script（旧调用方）。
    const isScript = isScriptTarget !== undefined ? isScriptTarget : Boolean(renderStore.script)
    const effectiveScriptId = scriptId !== undefined ? scriptId : renderStore.script?.id

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
        analysis_id: effectiveAnalysisId ?? undefined,
        analysis_node_id: effectiveAnalysisNodeId ?? undefined,
        script_id: effectiveScriptId ?? undefined,
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
            const controllerPath = effectiveAnalysisNodeId || isScript ? "/analysis/controller-script" : "/analysis/controller"
            const resp = await http.post(controllerPath, buildPayload(values, save, is_submit))
            if (is_submit) {
                effectiveSetFormStatus?.("running")
            }
            if (save) {
                messageApi.success("save successful!")
                if (isScript) {
                    effectiveSetAnalysisNodeId?.(resp.data.analysis_node_id)
                } else {
                    if (resp.data.analysis_id) {
                        effectiveSetAnalysisId?.(resp.data.analysis_id)
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
                    if (effectiveAnalysisId) {
                        actions.push({
                            action: "component.invoke",
                            payload: {
                                category: "analysis",
                                id: effectiveAnalysisId,
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

                    {effectiveFormStatus == "running" || effectiveFormStatus == "stopping" || effectiveFormStatus == "submitted" ?
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
                        <Button disabled={effectiveFormStatus == "stopping"} size="small" color="cyan" variant="solid"
                            onClick={async () => {
                                try {
                                    if (isScript || effectiveAnalysisNodeId) {
                                        if (!effectiveAnalysisNodeId) {
                                            messageApi.error("analysis_node_id is required")
                                            return
                                        }
                                        effectiveSetFormStatus?.("stopping")
                                        await http.post(`/analysis/node/stop/${effectiveAnalysisNodeId}`)
                                        messageApi.success("Node stop requested")
                                        return
                                    }
                                    if (!effectiveAnalysisId) {
                                        messageApi.error("analysis_id is required")
                                        return
                                    }
                                    effectiveSetFormStatus?.("stopping")
                                    await http.post(`/analysis/stop/${effectiveAnalysisId}`)
                                    messageApi.success("Analysis stop requested")
                                } catch (error: any) {
                                    effectiveSetFormStatus?.("running")
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
                        <Button disabled={effectiveFormStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true, true)}>
                            Submit {effectiveAnalysisNodeId ? "Node" : ""}
                        </Button>
                    }
                    <Space >




                        {!effectiveAnalysisNodeId && <Form.Item
                            noStyle
                            initialValue={4}
                            name={`cache_type`}
                        >
                            <Select
                                size="small"
                                disabled={effectiveFormStatus == "running"}
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
                        <Button disabled={effectiveFormStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true)}>
                            {effectiveAnalysisId || effectiveAnalysisNodeId ? <>Update </> : <>Create</>}</Button>

                        <Button disabled={effectiveFormStatus == "running"} size="small" color="cyan" variant="solid" onClick={() => {
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

                {!isScript && <Space>
                    <Button disabled={effectiveFormStatus == "running"} size="small" color="cyan" variant="solid"
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
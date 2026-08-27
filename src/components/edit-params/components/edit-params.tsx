import { Button, Input, Popover, Spin, Table, Image, Typography, Collapse, Flex, Card, Skeleton, Tag, Tabs, Row, Col, Popconfirm, Drawer, Form, Tooltip, Space, Empty } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC, forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useOutletContext } from "react-router";
import CreateOrUpdateParsms from "./create-or-update-parsms";
import { ClearOutlined, RedoOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
const RenderFromJson = lazy(() => import("./render-form-json"));
import { useStoreRender } from "@/context/render/RenderProvider";
import { useSideViewContext } from "@/context/side/SideViewContext";
const EditParamsPanel: FC<any> = () => {
    const [form] = Form.useForm()
    const { requestParam, analysisNodeId, formStatus, setAnalysisNodeId, relation, setAnalysisId, loadParams, analysisId,loading } = useStoreRender()
    const { setSideView, sideView, sideOptions, setSideOptions } = useSideViewContext();

    // const addedProject = Form.useWatch((values: any) => values?.addedProject, form);
    const jobStatus = useRef<any>(null)
    const [params, setParsms] = useState<any>(requestParam)
    // const { requestParam, dataMap, formJson, databases } = params
    const [data, setData] = useState<any>()

    useEffect(() => {
        setParsms(requestParam)
        // debugger
        if (requestParam?.type && (requestParam?.type == "analysis" || requestParam?.type == "nodeAnalysis")) {
            form.resetFields()
            // console.log(resp.data.request_param)
            form.setFieldsValue(requestParam.requestParam)
        }
        // form.resetFields()
        // if (analysisId) {
        //     analysisIdRef.current = analysisId
        //     loadData()
        // } else {
        //     setParsms(requestParam)
        //     setData({
        //         component_name: relation?.name,
        //     })
        // }
        // loadData()

    }, [requestParam,sideView])
    // form.()
    const [resultData, setResultData] = useState<any>()

    // const navigate = useNavigate()
    // const [loading, setLoading] = useState<any>()

    // const loadData = async () => {
    //     // if (type && bizKey) {
    //     //     switch (type) {
    //     //         case "tools":
    //     //             loadToolsForm(bizKey)
    //     //             break;
    //     //     }
    //     // }
    // }

    // const loadAnalysisResult = async (componentIdList: any) => {
    //     let resp: any = await axios.post(`/analysis-result/list-analysis-result-grouped`, {
    //         project: project,
    //         component_ids: componentIdList,
    //     })
    //     setResultData(resp.data)
    // }
    // const loadAnalysis = async (analysisId: any) => {
    //     setLoading(true)
    //     const resp = await axios.post(`/analysis/edit-params/${analysisId}`)
    //     jobStatus.current = resp.data?.job_status

    //     setData(resp.data)
    //     setParsms({
    //         requestParam: resp.data.request_param,
    //         dataMap: { ...resp.data.analysis_result, first_data_key: getFirstKey(resp.data.analysis_result) },
    //         formJson: resp.data.formJson,
    //         databases: resp.data.databases,
    //         upstreamFormJson: resp.data.upstreamFormJson,
    //         status: resp.data.status,
    //     })

    //     // await loadAnalysisResult(JSON.parse(resp.data.request_param.data_component_ids))
    //     setResultData(resp.data.analysis_result)
    //     form.resetFields()
    //     // console.log(resp.data.request_param)
    //     form.setFieldsValue(resp.data.request_param)
    //     form.setFieldValue("anno", 6491)
    //     // console.log([...resp.data.content?.formJson || [],...resp.data?.inputFormJson || []])
    //     // console.log(resp.data.content?.formJson)
    //     // console.log(resp.data?.inputFormJson)
    //     // setTimeout(() => {
    //     //     form.setFieldsValue(resp.data.request_param)

    //     // }, 50);
    //     setLoading(false)
    // }




    // const sseData = useSelector((state: any) => state.global.sseData)
    // const analysisIdRef = useRef<any>(null)

    // useEffect(() => {
    //     const data = sseData
    //     console.log("sseData in result list:", analysisIdRef.current, data)

    //     if (analysisIdRef.current == data.analysis_id) {
    //         //  || data.event == "analysis_started"
    //         if (data.event == "analysis_complete" || data.event == "analysis_failed") {
    //             // loadData()
    //         } else if (data.event == "analysis_started") {
    //             jobStatus.current = "running"
    //         }
    //     }
    // }, [sseData])

    const getFirstKey = (resultTableList: any) => {
        if (resultTableList && Object.keys(resultTableList).length > 0) {
            return Object.keys(resultTableList)[0]
        } else {
            return undefined
        }
    }




    return <Spin spinning={loading}>
        {/* {JSON.stringify(requestParam)} */}
        {/* {relationId} */}
        {/* {JSON.stringify(params.formJson)} */}
        {/* {type} - {bizKey} */}
        {/* <Button onClick={()=>{
            form.resetFields()
            form.setFieldsValue(requestParam.requestParam)
        111
        }}>test</Button> */}
        
        {params ? <>
            <Space wrap>

                {/* <Tooltip title={bizKey}>
                    <Tag>{type}</Tag>
                </Tooltip> */}

                {analysisId && <Tooltip title={analysisId}>
                    <Tag color="green" closable onClose={() => {
                        setAnalysisId(null)
                        // form.resetFields()
                    }}>Analysis({analysisId})</Tag>
                </Tooltip>}
                {analysisNodeId && <Tooltip title={analysisNodeId}>
                    <Tag color="blue" closable onClose={() => {
                        setAnalysisNodeId(null)
                    }} >Node Analysis ({analysisNodeId})</Tag>
                </Tooltip>}
                {params && <>
                    <Button onClick={() => loadParams(true)} size="small" icon={<RedoOutlined></RedoOutlined>}></Button>

                    <Tag>{formStatus}</Tag>
                    {/* <Tag color="success">{data?.analysis_name}</Tag>
                    <Tooltip title={data?.analysis_id}>
                        <Tag>{String(analysisIdRef.current).slice(0, 8)}</Tag>
                    </Tooltip>
                    <Tag>{jobStatus.current}</Tag> */}

                    {/* <RedoOutlined style={{ cursor: "pointer" }} onClick={loadData} /> */}
                </>}
                <Tooltip title="Reset form">
                    <Button onClick={() => {
                        setAnalysisId(null)
                        form.resetFields()
                    }} size="small" icon={<ClearOutlined></ClearOutlined>}></Button>

                </Tooltip>
            </Space>
            {/* {JSON.stringify(requestParam)} */}

            <CreateOrUpdateParsms
                showCreate={true}
                form={form}

                // requestParam={{ ...data.request_param, analysis_id: data?.analysis_id }}
                // dataMap={{ ...resultData, first_data_key: getFirstKey(resultData) }}
                // formJson={data.formJson}
                // databases={data?.databases}
                // upstreamFormJson={data?.upstreamFormJson}
                {...params}

                jobStatus={jobStatus}
                callback={() => {
                    // loadData()
                    // callback && callback()
                }} ></CreateOrUpdateParsms>

        </> : <Empty ></Empty>}
    </Spin>
}

export default EditParamsPanel
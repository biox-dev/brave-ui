import { Button, Input, Popover, Spin, Table, Image, Typography, Collapse, Flex, Card, Skeleton, Tag, Tabs, Row, Col, Popconfirm, Drawer, Form, Alert, Modal, Tooltip, Divider, Segmented, Space } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC, forwardRef, memo, use, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import axios from "axios";
import { DeleteOutlined, DownloadOutlined, ExportOutlined, QuestionCircleOutlined, RedoOutlined } from "@ant-design/icons"
import { useNavigate, useOutletContext } from "react-router";
import { findAnalysisById, runAnalysisApi, stopAnalysisApi } from "@/api/analysisv1";
import { useModal, useModals } from "@/hooks/useModal";
import { useSelector } from "react-redux";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import BigTable from '@/components/big-table';
import { useSideViewContext } from "@/context/side/SideViewContext";
import { useSideView } from "@/hooks/useLLMARG";
import { useStoreRender } from "@/context/render/RenderProvider";
import ComponentsDetailsRender from "@/core/ui-renderer/ComponentsDetailsRender";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import { componentMap, ImgView, UrlComp } from "./components";
import LogFile from "@/components/log-file";
import { invoke } from "@/core/ui-system/invokeV2";
import { addFileToDatasetApi } from "@/api/data";
import { openFileByPath } from "@/utils/file-open";
// import EditParamsPanel from "../edit-params/components/panel";




export const ComponentsRender0 = ({ type, ...rest }: any) => {
    const Component = componentMap[type] || (() => <div>未知类型 {type}</div>)
    return <div style={{ marginBottom: "1rem" }}>
        <Component {...rest} />
    </div>;
}
export const ComponentsRender = memo(ComponentsRender0)


export const AnalysisResultViewCompV2: FC<any> = ({ analysis_id, onClose, callback, openPanel, overflowY = "hidden" }) => {
    const [loading, setLoading] = useState<boolean>(false)
    const [analsyisResult, setAnalsyisResult] = useState<any>(null)
    const navigate = useNavigate()
    // const { eventSourceRef, status, reconnect } = useSSEContext();
    const analysisIdRef = useRef<any>(null)
    const sseAnalysisIdRef = useRef<any>(null)
    // const { messageApi } = useOutletContext<any>()
    const message = useGlobalMessage()
    const { modals, openModals, closeModals } = useModals(["editParams", "moduleEdit", "createOrUpdatePipelineComponent"]);
    const { containerURL, project, baseURL } = useSelector((state: any) => state.user);
    const [runingLoading, setRuningLoading] = useState<boolean>(false)
    const [form] = Form.useForm();
    const [rightPanel, setRightPanel] = useState<string>("editParamsPanel")
    // const [sideView, setSideView] = useState<string>("llm-card")
    const { setSideView, sideView } = useSideViewContext();
    useSideView({
        bizType: "analysis",
        bizId: analysis_id,
    })
    const loadData = async (analysis_id: any) => {
        setLoading(true)
        // const res = await axios.get(`/file-operation/visualization-results?path=${output_dir}`)
        const res = await axios.get(`/analysis/visualization-results/${analysis_id}`)

        setAnalsyisResult(res.data)
        form.resetFields()
        form.setFieldsValue(res.data.request_param)
        analysisIdRef.current = analysis_id
        setLoading(false)
    }
    function deepMerge(target: any, source: any) {
        for (const key in source) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                // 如果是对象，则递归合并
                if (!target[key] || typeof target[key] !== "object") {
                    target[key] = {};
                }
                deepMerge(target[key], source[key]);
            } else {
                // 否则直接覆盖
                target[key] = source[key];
            }
        }
        return target;
    }
    const buildRequest = (values: any) => {
        const merged = deepMerge({ ...analsyisResult?.request_param }, values);

        const requestParam = {
            analysis_id: analysis_id,
            project: project,
            ...merged,
        }
        return requestParam

    }
    useEffect(() => {
        loadData(analysis_id)
    }, [analysis_id])


    const sseData = useSelector((state: any) => state.global.sseData)
    useEffect(() => {
        // console.log("sseData in result list:", data.msgType)
        const data = sseData
        sseAnalysisIdRef.current = data
        if (analysisIdRef.current == data.analysis_id) {

            if (data.event == "analysis_complete" || data.event == "analysis_failed" || data.event == "analysis_started") {
                loadData(analysisIdRef.current)
            }
        }
    }, [sseData])


    const { setAnalysisId } = useStoreRender()
    useEffect(() => {
        return () => {
            console.log("clear analysis id")
            setAnalysisId(null)

        }
    }, [])
    return <>

        <Card size="small"
            loading={loading}
            style={overflowY == "auto" ? {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                height: " 100%",
                boxShadow: "none"
            } : { boxShadow: "none" }}
            styles={{
                body: {
                    // padding: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    height: " 100%",
                    overflowY: overflowY
                }
            }}
            // style={{ boxShadow: "none" }}
            variant="borderless"
            // bodyStyle={{ padding: 0 }}

            title={<>
                {analsyisResult ? <>
                    <Tag style={{ cursor: "pointer" }} onClick={() => {
                        navigate(`/component/${analsyisResult?.component_type}/${analsyisResult?.component_id}`)
                    }}>{analsyisResult?.name}</Tag>
                    <Tag>{analsyisResult?.analysis_name}</Tag>
                    <Tag>{String(analsyisResult?.analysis_id).slice(0, 8)}</Tag>
                    <Tag>{analsyisResult?.job_status}</Tag>
                    {analysisIdRef.current == sseAnalysisIdRef.current?.analysis_id && <Tag> <>{sseAnalysisIdRef.current?.event}</>
                    </Tag>}

                </> : <>

                </>}



            </>}
            extra={
                <Flex gap={"small"} wrap>
                    {onClose && <>
                        <Button size="small" color="blue" variant="solid" onClick={() => {
                            // setAnalysisId(null)
                            onClose()
                        }}>Close</Button>
                    </>}
                    {sideView == "llm-card" ?
                        <Button size="small" color="blue" variant="solid" onClick={() => {
                            setSideView("analysis-tree")
                        }}>
                            TOC
                        </Button>
                        :

                        <Button size="small" color="blue" variant="solid" onClick={() => {
                            setSideView("llm-card")
                        }}>
                            LLM
                        </Button>
                    }

                    <Tooltip title={`Download Result ${analsyisResult?.analysis_name}`}>
                        {/* <Popconfirm title={"Whether or not to download?"} onConfirm={async () => {
                            // /analysis/download-results/{analysis_id}
                            const res = await axios.post(`/analysis/download-results/${analysis_id}`);
                            const url =`${baseURL}${res.data.download_url}`
                            console.log(url)
                            window.open(url, "_blank")
                            // const blob = new Blob([res.data], { type: 'application/zip' });
                        }}>
                            <Button size="small" color="blue" variant="solid" icon={<DownloadOutlined />} >Download</Button>
                        </Popconfirm> */}

                        <Button
                            onClick={async () => {
                                // /analysis/download-results/{analysis_id}
                                const res = await axios.post(`/analysis/download-results/${analysis_id}`);
                                const url = `${baseURL}${res.data.download_url}`
                                console.log(url)
                                window.open(url, "_blank")
                                // const blob = new Blob([res.data], { type: 'application/zip' });
                            }}
                            size="small" color="blue" variant="solid" icon={<DownloadOutlined />} >Download</Button>

                    </Tooltip>
                    {openPanel && <>
                        {analsyisResult && <Button size="small" color="primary" variant="solid" onClick={() =>
                            navigate(`/relation/${analsyisResult?.relation_type}/${analsyisResult?.relation_id}`)
                        }>Go {analsyisResult?.relation_type}</Button>}
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            openPanel("note")
                        }}>Open Note</Button>

                    </>}
                    {analsyisResult && <Button size="small" color="cyan" variant="solid" onClick={() => {
                        openModals("createOrUpdatePipelineComponent", {
                            data: {
                                component_id: analsyisResult?.component_id,
                            }, structure: {
                                component_type: analsyisResult?.component_type,
                            }
                        })
                    }}>Edit {analsyisResult?.component_type}</Button>}





                    {analsyisResult && <>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            openModals("moduleEdit", {
                                component_id: analsyisResult?.component_id,
                            })
                        }}>Component Code</Button>
                        {/* <Button size="small" color="cyan" variant="solid" onClick={() => {
                            openModals("editParams", analsyisResult.analysis_id)
                        }}>
                            Edit Parameters
                        </Button> */}
                        {analsyisResult?.image_status == "exist" ?
                            <>
                                {analsyisResult?.job_status == "running" ?
                                    <>
                                        <Popconfirm title={"Whether or not to stop?"} onConfirm={async () => {
                                            await stopAnalysisApi(analsyisResult.analysis_id, "job")
                                            message.success("Stop Success")

                                        }}>
                                            <Button size="small" color="red" variant="solid">
                                                Stop
                                            </Button>
                                        </Popconfirm>

                                    </> : <>
                                        <Popconfirm title={"Whether or not to run?"} onConfirm={async () => {
                                            await runAnalysisApi(analsyisResult.analysis_id, "job")
                                            message.success("run successfully")


                                        }}>
                                            <Button size="small" color="cyan" variant="solid">
                                                {analsyisResult.job_status == "created" ? "Run" : "Re-Run"}
                                            </Button>
                                        </Popconfirm>

                                    </>
                                }
                                {analsyisResult?.server_status == "running" ?
                                    <>
                                        {/* 
                                <Tooltip title={<>
                                    {`${containerURL}/container/${analsyisResult.analysis_id}/`}
                                </>}>
                                    <Button size="small" color="blue" variant="solid" onClick={() => {
                                        //  console.log("record", record)

                                        window.open(`${containerURL}/container/${analsyisResult.analysis_id}/`, "_blank")
                                    }}>Open URL</Button>
                                </Tooltip> */}
                                        <Popconfirm title={"Whether or not to stop?"} onConfirm={async () => {
                                            // stopAnalysis(record, "server")
                                            await stopAnalysisApi(analsyisResult.analysis_id, "server")
                                        }}>
                                            <Button size="small" color="red" variant="solid">
                                                Stop Server
                                            </Button>
                                        </Popconfirm>
                                        <Tooltip title={<>
                                            {`${containerURL}/container/server-${analsyisResult.analysis_id}/`}
                                        </>}>
                                            <ExportOutlined style={{ cursor: "pointer" }} onClick={() => {

                                                window.open(`${containerURL}/container/server-${analsyisResult.analysis_id}/`, "_blank")
                                            }} />
                                        </Tooltip>


                                    </> : <>
                                        <Popconfirm title="Whether to start the server?" onConfirm={async () => {
                                            await runAnalysisApi(analsyisResult.analysis_id, "server")
                                        }}>
                                            <Button size="small" color="cyan" variant="solid">Run Server</Button>
                                        </Popconfirm>

                                    </>
                                }
                            </>

                            :
                            <>
                                <Popconfirm title="Pull?" onConfirm={async () => {
                                    await axios.post(`/container/pull-image/${analsyisResult.container_id}`)
                                    loadData(analsyisResult.analysis_id)

                                }}>
                                    <Button size="small" color="cyan" variant="solid"  >
                                        {analsyisResult.image_status == "pulling" ? "pulling" : "Pull"}
                                    </Button>
                                </Popconfirm>
                            </>}


                        <Popconfirm title={analsyisResult?.is_report ? "Whether to cancel the report?" : "Reported or not?"} onConfirm={async () => {
                            await axios.post(`/analysis/update-report/${analsyisResult?.analysis_id}`)
                            message.success("operate successfully!")
                            // setAnalsyisResult(null)
                            loadData(analysis_id)
                            if (callback) {
                                callback()
                            }
                            // loadData()
                        }}>
                            <Button size="small" color={"cyan"} variant="solid">{analsyisResult?.is_report ? "Cancel Report" : "Report"}</Button>
                        </Popconfirm>
                        {onClose && <Button size="small" color="primary" variant="solid" onClick={() =>
                            navigate(`/analysis-report?key=${analsyisResult?.analysis_id}&project=${project}`)
                        }>Go Report</Button>}



                        <Popconfirm title={`Delete ${analysis_id}?`} onConfirm={async () => {
                            await axios.delete(`/fast-api/analysis/${analysis_id}`)
                            message.success("Deleted Successfully!")
                            if (callback) {
                                callback()
                            }
                            onClose()
                        }}>
                            <Button
                                color="red" variant="solid"
                                icon={<DeleteOutlined />} size="small" ></Button>
                            {/* <DeleteOutlined style={{ cursor: "pointer", color: "red" }} /> */}
                        </Popconfirm>
                    </>}



                    <Button
                        color="cyan" variant="solid"
                        icon={<RedoOutlined />} onClick={() => loadData(analysis_id)} size="small" ></Button>
                    {/* <Button size="small" color="cyan" variant="solid" onClick={() => loadData(analysis_id)}>Refresh</Button> */}

                </Flex>
            }>


            <Spin spinning={loading} tip="loading..." style={{ minHeight: "5rem", }}>


                {analsyisResult?.job_status == "failed" ? <div style={{ textAlign: "center" }}>
                    <div style={{ flex: 1, overflowY: "auto", marginBottom: "1rem" }}>
                        <LogFile file_path={analsyisResult?.command_log_path}  ></LogFile>

                    </div>
                </div> : <>
                    {((analsyisResult?.job_status == "running" && analsyisResult?.run_type != "server")) ? <Skeleton active></Skeleton> : <>

                        {analysis_id && <AnalysisResultDisplay analsyisResult={analsyisResult} loading={loading}></AnalysisResultDisplay>}

                    </>
                    }
                </>}
                {analsyisResult?.analysis_id &&
                    <>

                        <ViewResolver
                            analysis_id={analsyisResult?.analysis_id}
                            view="analysisNodes">
                        </ViewResolver>
                        {/* <ViewResolver
                            analysis_id={analsyisResult?.analysis_id}
                            view="analysisEdges">
                        </ViewResolver> */}
                    </>


                }

            </Spin >



        </Card >

    </>

}
export const AnalysisResultViewComp: FC<any> = ({ analysis_id, onClose, callback, openPanel, showDesc = false, overflowY = "hidden" }) => {
    const [loading, setLoading] = useState<boolean>(false)
    const [analsyisResult, setAnalsyisResult] = useState<any>(null)
    const navigate = useNavigate()
    // const { eventSourceRef, status, reconnect } = useSSEContext();
    const analysisIdRef = useRef<any>(null)
    const sseAnalysisIdRef = useRef<any>(null)
    // const { messageApi } = useOutletContext<any>()
    const message = useGlobalMessage()
    const { modals, openModals, closeModals } = useModals(["editParams", "moduleEdit", "createOrUpdatePipelineComponent"]);
    const { containerURL, project, baseURL } = useSelector((state: any) => state.user);
    const [runingLoading, setRuningLoading] = useState<boolean>(false)
    const [form] = Form.useForm();
    const [rightPanel, setRightPanel] = useState<string>("editParamsPanel")
    // const [sideView, setSideView] = useState<string>("llm-card")
    const { setSideView, sideView } = useSideViewContext();
    useSideView({
        bizType: "analysis",
        bizId: analysis_id,
    })
    const loadData = async (analysis_id: any) => {
        setLoading(true)
        // const res = await axios.get(`/file-operation/visualization-results?path=${output_dir}`)
        const res = await axios.get(`/analysis/visualization-results/${analysis_id}`)

        setAnalsyisResult(res.data)
        form.resetFields()
        form.setFieldsValue(res.data.request_param)
        analysisIdRef.current = analysis_id
        setLoading(false)
    }
    function deepMerge(target: any, source: any) {
        for (const key in source) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key])
            ) {
                // 如果是对象，则递归合并
                if (!target[key] || typeof target[key] !== "object") {
                    target[key] = {};
                }
                deepMerge(target[key], source[key]);
            } else {
                // 否则直接覆盖
                target[key] = source[key];
            }
        }
        return target;
    }
    const buildRequest = (values: any) => {
        const merged = deepMerge({ ...analsyisResult?.request_param }, values);

        const requestParam = {
            analysis_id: analysis_id,
            project: project,
            ...merged,
        }
        return requestParam

    }
    useEffect(() => {
        loadData(analysis_id)
    }, [analysis_id])


    const sseData = useSelector((state: any) => state.global.sseData)
    useEffect(() => {
        // console.log("sseData in result list:", data.msgType)
        const data = sseData
        sseAnalysisIdRef.current = data
        if (analysisIdRef.current == data.analysis_id) {

            if (data.event == "analysis_complete" || data.event == "analysis_failed" || data.event == "analysis_started") {
                loadData(analysisIdRef.current)
            }
        }
    }, [sseData])



    return <>

        <Card size="small"
            style={overflowY == "auto" ? {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                height: " 100%",
                boxShadow: "none"
            } : { boxShadow: "none" }}
            styles={{
                body: {
                    // padding: 0,
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    height: " 100%",
                    overflowY: overflowY
                }
            }}
            // style={{ boxShadow: "none" }}
            variant="borderless"
            // bodyStyle={{ padding: 0 }}

            title={<>



            </>}
        >

            {/* <div >
                dew<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />

            </div> */}
            {/* {JSON.stringify(analsyisResult)} */}
            {/* {analysis_id} */}
            <Spin spinning={loading} tip="loading..." style={{ minHeight: "5rem", }}>

                <Row gutter={[8, 8]}

                >
                    <Col lg={16} sm={16} xs={24}>

                        {analsyisResult?.job_status == "failed" ? <div style={{ textAlign: "center" }}>
                            <div style={{ flex: 1, overflowY: "auto", marginBottom: "1rem" }}>
                                <LogFile file_path={analsyisResult?.command_log_path}  ></LogFile>

                            </div>
                        </div> : <>
                            {((analsyisResult?.job_status == "running" && analsyisResult?.run_type != "server")) ? <Skeleton active></Skeleton> : <>

                                {analysis_id && <AnalysisResultDisplay analsyisResult={analsyisResult} loading={loading}></AnalysisResultDisplay>}

                            </>
                            }
                        </>}



                    </Col>
                    <Col lg={8} sm={8} xs={24} style={{}}>
                        <Card

                            size="small"
                            extra={<>
                                <Segmented size="small" value={rightPanel}
                                    onChange={(val: any) => setRightPanel(val)}
                                    options={[
                                        {
                                            label: "Parameters",
                                            value: "editParamsPanel"
                                        },
                                        // {
                                        //     label: "LLM",
                                        //     value: "llmAnalysis"
                                        // }, 
                                        {
                                            label: "Description",
                                            value: "description"
                                        }
                                    ]} />
                            </>}
                        >

                            {/* <EditParamsPanel
                                analysis_id={analysis_id}></EditParamsPanel> */}
                        </Card>




                    </Col>
                </Row>


            </Spin >


        </Card >

    </>

}


const HtmlPreview: FC<any> = ({ visible, onClose, params, baseURL }) => {
    return <Modal open={visible} onCancel={onClose} onClose={onClose} width={"80%"} title={"HTML Preview"} footer={null}>
        {params?.data && <>
            <iframe src={`${baseURL}${params?.data}`} width={"100%"} style={{ height: "80vh", border: "none" }}>
            </iframe>
        </>}

    </Modal>
}
// export default AnalysisResultViewComp

const AnalysisResultDisplay: FC<any> = ({ analsyisResult, prefix = "" }) => {
    const { baseURL } = useSelector((state: any) => state.user)
    const { projectObj } = useSelector((state: any) => state.user);

    const { modal, openModal, closeModal } = useModal()
    const message = useGlobalMessage()

    return <div >

        {analsyisResult && <>

            {analsyisResult.files && Array.isArray(analsyisResult.files) && <>
                <Collapse
                    style={{ marginBottom: "1rem" }}
                    defaultActiveKey={[]}
                    items={[
                        {
                            key: "analysis-files",
                            label: `Files (${analsyisResult.files.length})`,
                            children: (
                                <Flex vertical gap={8}>
                                    {analsyisResult.files.map((item: any, index: any) => {
                                        const filePath = item?.filepath || item?.path || item?.url || ""
                                        const fileName = item?.filename || filePath.split("/").pop() || `File ${index + 1}`
                                        const url = item?.url
                                        return (
                                            <Card key={index} size="small" styles={{ body: { padding: "8px 12px" } }}>
                                                <Flex justify="space-between" align="center" gap={8} wrap>
                                                    <Flex vertical>
                                                        <Typography.Text strong>{fileName}</Typography.Text>
                                                        <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                            {filePath}
                                                        </Typography.Text>
                                                        <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                            {url}
                                                        </Typography.Text>
                                                    </Flex>

                                                    <Space>
                                                        <Button
                                                            size="small"
                                                            type="default"
                                                            onClick={() => {
                                                                if (!filePath) {
                                                                    message.error("Invalid file path")
                                                                    return
                                                                }
                                                                openFileByPath({ filePath, title: fileName, url })
                                                            }}
                                                        >
                                                            Open
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            color="cyan"
                                                            variant="solid"
                                                            onClick={async () => {
                                                                if (!filePath) {
                                                                    message.error("Invalid file path")
                                                                    return
                                                                }
                                                                try {
                                                                    const data = await invoke.datasetProjectPage.openDrawerAsync({}, {
                                                                        width: 600,
                                                                        title: "Select File Type"
                                                                    })
                                                                    const params = {
                                                                        dataset_id: data.id,
                                                                        path: filePath,
                                                                        source: "analysis",
                                                                    }
                                                                    await addFileToDatasetApi(params)
                                                                    message.success("File added to analysis results")
                                                                } catch (error) {
                                                                    console.log("File type selection cancelled or failed", error)
                                                                }
                                                            }}
                                                        >
                                                            Add To
                                                        </Button>
                                                    </Space>
                                                </Flex>
                                            </Card>
                                        )
                                    })}
                                </Flex>
                            ),
                        },
                    ]}
                />
            </>}

            {analsyisResult.images && <div >
                {
                    Array.isArray(analsyisResult.images) ?

                        <Row gutter={[8, 8]}>
                            {analsyisResult.images.map((it: any, index: any) => (
                                <Col lg={8} sm={8} xs={24} key={index} span={4}>
                                    <ImgView {...it} baseURL={baseURL}></ImgView>
                                </Col>))}
                        </Row> :
                        <>
                            <ImgView {...analsyisResult.images} baseURL={baseURL}></ImgView>
                        </>
                }
            </div>}

            <div >
                {analsyisResult.htmls && Array.isArray(analsyisResult.htmls) && <>
                    {analsyisResult.htmls.map((item: any, index: any) => (
                        <div key={index}>

                            {/* <iframe width={"100%"} height={"1000px"} src={`${baseURL}${item.url}`}></iframe> */}
                            <Button size="small" color="cyan" variant="solid" onClick={() => {
                                openModal("HtmlPreview", { data: item.url })
                            }}>Open {item.filename}</Button>
                            &nbsp;
                            <UrlComp url={item.url} filename={item.filename} baseURL={baseURL}></UrlComp>

                        </div>

                    ))}
                </>}
            </div>

            {/* <MicrobiomeSummaryCard></MicrobiomeSummaryCard> */}
            <div >
                {analsyisResult.tables && Array.isArray(analsyisResult.tables) && <>
                    {analsyisResult.tables.map((item: any, index: any) => (
                        <ComponentsRender prefix={prefix} projectObj={projectObj} key={index} {...item} baseURL={baseURL}></ComponentsRender>


                    ))}
                </>}
            </div>

        </>}

        <HtmlPreview
            baseURL={baseURL}
            visible={modal.visible && modal.key == "HtmlPreview"}
            onClose={closeModal}
            params={modal.params}
        ></HtmlPreview>
    </div>
}


export default AnalysisResultDisplay
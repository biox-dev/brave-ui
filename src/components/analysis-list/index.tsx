import { Button, Card, Dropdown, Flex, Form, Input, message, Modal, Pagination, Popconfirm, Popover, Select, Space, Table, Tag, Tooltip } from "antd"
import axios from "axios"
import { FC, forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import { useModal, useModals } from "@/hooks/useModal"
import PipelineInfo, { ParamsFile } from "../pipeline-monitor"
import { runAnalysisApi, stopAnalysisApi } from "@/api/analysisv1"
import { DownOutlined, ExportOutlined, LineChartOutlined, RedoOutlined } from '@ant-design/icons'
export const readHdfsAPi = (contentPath: any) => axios.get(`/api/read-hdfs?path=${contentPath}`)
export const readJsonAPi = (contentPath: any) => axios.get(`/fast-api/read-json?path=${contentPath}`)
import EditParams from '../edit-params'
import { useSelector } from "react-redux"
import { InspectPanel } from "@/pages/container"
import ResultParsePanel from "../result-parse/panel"
import { usePagination } from "@/hooks/usePagination"
import AnalysisTaskPanel from "../analysis-task/panel"
import AnalysisResultPanel from "../analysis-result-view/panel"
import ComponentsRender from "./components"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useStoreRender } from "@/context/render/RenderProvider"
import ComponentsDetailsRender from "@/core/ui-renderer/ComponentsDetailsRender"
import ViewResolver from "@/core/ui-renderer/ViewResolver"

const AnalysisList = forwardRef<any, any>(({
    project,
    component_id,
    component_ids,
    relation_id,
    setView,

}, ref) => {
    const { data, pageNumber, totalPage, loading, reload: loadData, pageSize, setPageNumber, search } = usePagination({
        id: "analysis-list",
        url: `/list-analysis`,
        params: {
            // component_id: component_id,
            // component_ids: component_ids,
            project: project,
            // relation_id: relation_id,
        },
        initialPageSize: 10
    })
    useEffect(() => {
        // console.log("component_id changed:", component_ids)
        closeModal()
    }, [component_ids, component_id])

    useImperativeHandle(ref, () => ({
        reload: loadData
    }))
    console.log("AnalysisList Render")

    const [record, setRecord0] = useState<any>()
    const { modal, openModal, closeModal } = useModal();
    const { modals, openModals, closeModals } = useModals(["inspectPanel"]);
    const message = useGlobalMessage()

    const navigate = useNavigate()
    const location = useLocation()
    // const queryParams = new URLSearchParams(location.search);
    // const key = queryParams.get("key");
    // useEffect(() => {
    //     console.log("key changed:", key)
    //     closeModal()
    // }, [key])
    // const { eventSourceRef, status, reconnect } = useSSEContext();
    // const [data, setData] = useState<any>([])
    const analysisIdRef = useRef<any>([])
    // const analysisResultRef = useRef<any>(null)
    const pipelineInfoRef = useRef<any>(null)
    // const [content,setContent] = useState<any>()
    // const [loading, setLoading] = useState(true)
    const [currentAnalysis, setCurrentAnalysis] = useState<any>()
    const { containerURL } = useSelector((state: any) => state.user);
    const { setAnalysisId, analysisId, setToolsPanelView, addOpenAnalysis, checkIsOpen, closeAnalysis } = useStoreRender()

    useEffect(() => {
        if (data && Array.isArray(data) && data.length > 0) {
            // const runningAnalysis = data.filter((item: any) => item.analysis_status == "running")
            if (modal.visible && modal.params) {
                const analysis = data.find((item: any) => item.analysis_id == modal.params.analysis_id)
                if (analysis) {
                    setCurrentAnalysis(analysis)
                }
            }

        }
    }, [data, modal.params])
    const sseData = useSelector((state: any) => state.global.sseData)
    useEffect(() => {
        // console.log("sseData in result list:", data.msgType)
        const data = sseData
        if (analysisIdRef.current.includes(data.analysis_id)) {

            if (data.event == "analysis_complete" || data.event == "analysis_failed" || data.event == "analysis_started") {
                loadData()
                // if (analysisResultRef.current) {
                //     analysisResultRef.current?.relaod()
                // }
                // if (pipelineInfoRef.current) {
                //     pipelineInfoRef.current?.relaod()
                // }
            }

        } else if (data.run_type == "retry") {
            if (data.event == "container_pulled") {
                loadData()
            }
        }
    }, [sseData])

    // useEffect(() => {
    //     if (eventSourceRef) {
    //         const handler = (event: MessageEvent) => {
    //             // console.log('event', event)
    //             const data = JSON.parse(event.data)
    //             console.log('analysisId', analysisIdRef.current)
    //             if (analysisIdRef.current.includes(data.analysis_id)) {

    //                 if (data.event == "analysis_complete" || data.event == "analysis_failed" || data.event == "analysis_started") {
    //                     loadData()
    //                     // if (analysisResultRef.current) {
    //                     //     analysisResultRef.current?.relaod()
    //                     // }
    //                     if (pipelineInfoRef.current) {
    //                         pipelineInfoRef.current?.relaod()
    //                     }
    //                 }

    //             } else if (data.run_type == "retry") {
    //                 if (data.event == "container_pulled") {
    //                     loadData()
    //                 }
    //             }
    //         };

    //         eventSourceRef.current?.addEventListener('message', handler);

    //         return () => {
    //             console.log("removeEventListener")
    //             eventSourceRef.current?.removeEventListener('message', handler);
    //         };
    //     }
    // }, [eventSourceRef.current, project]);



    const setRecord = (record: any) => {

        setRecord0(record)
    }

    useEffect(() => {
        if (data && data.length > 0) {
            const analysisId = data.map((item: any) => item.analysis_id)

            analysisIdRef.current = analysisId
        }

    }, [data])
    // const loadData = async () => {
    //     setLoading(true)
    //     // ?analysis_method=${analysisMethod}&project=${project}
    //     let resp: any = await axios.post(`/list-analysis`, {
    //         // analysisMethod: analysisMethod,
    //         component_id: component_id,
    //         component_ids: component_ids,
    //         project: project
    //     });
    //     // if (analysisMethod) {
    //     //     resp = await axios.get(`/api/analysis-result?project=${project}&analysis_method=${analysisMethod}`)
    //     // } else {
    //     //     resp 
    //     // }


    //     setData(resp.data)
    //     const analysisId = resp.data.map((item: any) => item.analysis_id)
    //     // console.log('>>>>>>>>analysisId', analysisId)

    //     analysisIdRef.current = analysisId
    //     setLoading(false)
    // }

    const deleteById = async (id: any) => {
        const resp: any = await axios.delete(`/fast-api/analysis/${id}`)
        message.success("successfully delete!")
        loadData()
    }



    const isSelected = (record: any, keys: any[]) => {
        if (!modal.params) return false
        return record.analysis_id == modal.params.analysis_id && keys.includes(modal.key)
    }
    const runAnalysis = async (record: any, run_type: string) => {
        await runAnalysisApi(record.analysis_id, run_type)
        message.success("run successfully")
        loadData()
    }
    const stopAnalysis = async (record: any, run_type: any) => {
        await stopAnalysisApi(record.analysis_id, run_type)
        message.success("Stop Success")
        loadData()
    }
    // useEffect(() => {
    //     if (analysisId) {
    //         // debugger
    //         openModal("componentsRender", {
    //             view: "analysisResultView", analysis_id: analysisId,
    //         })
    //     }else{
    //          closeModal()
    //     }
    // }, [analysisId])
    let columns: any = [
        {
            title: 'Project Name',
            dataIndex: 'project_name',
            key: 'project_name',
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={record.project}>
                    <span style={{ cursor: "pointer" }}>{text}</span>
                </Tooltip>
            }
        }, {
            title: 'Job Status',
            dataIndex: 'job_status',
            key: 'job_status',
            ellipsis: true,
            render: (text: any) => {
                return <Tag color={text === "success" ? "green" : text === "failed" ? "red" : "blue"}>{text}</Tag>
            }
        }, {
            title: 'Server Status',
            dataIndex: 'server_status',
            key: 'server_status',
            ellipsis: true,
            render: (text: any) => {
                return <Tag color={text === "success" ? "green" : text === "failed" ? "red" : "blue"}>{text}</Tag>
            }
        }, {
            title: "Relation Name",
            dataIndex: 'relation_name',
            key: 'relation_name',
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={record.workflow_id}>
                    <span style={{ cursor: "pointer" }}>{text}</span>
                </Tooltip>
            }
        },
        // {
        //     title: "Component Name",
        //     dataIndex: 'component_name',
        //     key: 'component_name',
        //     ellipsis: true,
        //     render: (text: any, record: any) => {
        //         return <Tooltip title={record.component_id}>
        //             <span style={{ cursor: "pointer" }}>{text}</span>
        //         </Tooltip>
        //     }
        // },
        {
            title: "Analysis Name",
            dataIndex: 'analysis_name',
            key: 'analysis_name',
            ellipsis: true,
        }, {
            title: "Report",
            dataIndex: 'is_report',
            key: 'is_report',
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Popconfirm title={record.is_report ? "Whether to cancel the report?" : "Whether to the report?"} onConfirm={async () => {
                    await axios.post(`/analysis/update-report/${record.analysis_id}`)
                    loadData()
                }}>
                    {/* {record.is_report ? "Cancel Report" : "Report"} */}
                    <Tag style={{cursor:"pointer"}} color={text ? "green" : "blue"}>{text ? "Report" : "NonReport"}</Tag>
                </Popconfirm>
                // return 
            }
        },
        {
            title: 'Analysis Id',
            dataIndex: 'analysis_id',
            key: 'analysis_id',
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Popover title={<>
                    <ul>
                        <li>analysis_id:{record.analysis_id}</li>
                        <li>analysis_name:{record.analysis_name}</li>
                        <li>pipeline_script:{record.pipeline_script}</li>
                        <li>work_dir:{record.work_dir}</li>
                        <li>output_dir:{record.output_dir}</li>
                        <li>command_log_path:{record.command_log_path}</li>
                        <li>trace_file:{record.trace_file}</li>
                        <li>executor_log_file:{record.executor_log_file}</li>
                        <li>workflow_log_file:{record.workflow_log_file}</li>

                    </ul>
                </>}><span style={{ cursor: "pointer" }}> <span style={{ cursor: "pointer" }} >{String(text).slice(0, 8)}</span></span></Popover>
            }

        }, {
            title: "Container Name",
            dataIndex: "container_name",
            key: "container_name",
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={<>
                    <ul>
                        <li>{record.container_image}</li>
                        {record.sub_container_image && <li>{record.sub_container_image}</li>}
                    </ul>
                </>}>
                    <Tag style={{ cursor: "pointer" }}>{text}</Tag>
                    {record.sub_container_name && <Tag style={{ cursor: "pointer" }}>{record.sub_container_name}</Tag>}
                </Tooltip>
            }

        }, {
            title: "Image Status",
            dataIndex: "image_status",
            key: "image_status",
            ellipsis: true,
            render: (text: any, record: any) => (
                <Tooltip title={record.image_id}>
                    <Tag color="green">
                        {text}
                    </Tag>
                </Tooltip>
            )
        }, {
            title: "Used",
            dataIndex: "used",
            key: "used",
            ellipsis: true,
            render: (text: any, record: any) => (
                <Popconfirm title={text ? "Whether to cancel the use?" : "Whether to use?"}
                    onConfirm={async () => {
                        const resp: any = await axios.post(`/analysis/update_used/${record?.analysis_id}`)
                        message.info("use successfully")
                        loadData()
                    }}
                >
                    <Tag color={`${text ? "green" : "red"}`} style={{ cursor: "pointer" }} >
                        {text ? "Yes" : "No"}
                    </Tag>
                </Popconfirm>
            )
        }, {
            title: "Created At",
            dataIndex: "created_at",
            key: "created_at",
            ellipsis: true,
        }, {
            title: "Updated At",
            dataIndex: "updated_at",
            key: "updated_at",
            ellipsis: true,
        },
        // {
        //     title: "ports",
        //     dataIndex: 'ports',
        //     key: 'ports',
        //     ellipsis: true,
        //     render:(text: any, record: any)=>(<>
        //         {text}
        //     </>)
        // }, 
        {
            title: 'Action',
            key: 'action',
            fixed: "right",
            ellipsis: true,
            width: 200,
            render: (_: any, record: any) => (
                <Space size="small">

                    {/* /analysis/stop-analysis/{analysis_id} */}

                    {/* {record.image_status == "exist" ? <>
                        {(record.job_status == "running" || record.job_status == "stopping") ?
                            <>
                                <Popconfirm title={"Whether or not to stop?"} onConfirm={() => {
                                    stopAnalysis(record, "job")

                                }}>
                                    <Button size="small" color="red" variant="solid" disabled={record.job_status == "stopping"}>
                                        {record.job_status == "stopping" ? `${record.job_status}` : ` Stop Job`}
                                    </Button>
                                </Popconfirm>

                            </> : <>
                                <Popconfirm title={"Whether or not to run?"} onConfirm={() => {
                                    runAnalysis(record, "job")
                                    // if (record.component_type == "software") {
                                    //     // openModal("resultParsePanel", {
                                    //     //     analysis_id: record.analysis_id,
                                    //     // })
                                    //     openModal("componentsRender", { view: "runningContainer", analysis_id: record.analysis_id })

                                    // } else if (record.component_type == "script") {
                                    //     openModal("modalA", record)
                                    // }
                                    openModal("modalA", record)
                                    // openModal("modalA", record)
                                    setRecord(record)
                                }}>
                                    <Button size="small" color="cyan" variant="solid">
                                        {record.job_status == "created" ? "Run" : "Re-Run"}
                                    </Button>
                                </Popconfirm>

                            </>
                        }



                    </> : <>
                        <Popconfirm title="Pull?" onConfirm={async () => {
                            await axios.post(`/container/pull-image/${record.container_id}`)
                            loadData()

                        }}>
                            <Button size="small" color="cyan" variant="solid"  >
                                {record.image_status == "pulling" ? "pulling" : "Pull"}
                            </Button>
                        </Popconfirm>

                    </>} */}



                    {/* {record.image_status == "exist" && <>
                        {(record.server_status == "running" || record.server_status == "stopping") ?
                            <>


                                <Popconfirm title={"Whether or not to stop?"} onConfirm={() => {
                                    stopAnalysis(record, "server")


                                }}>

                                    <Button size="small" color="red" variant="solid" disabled={record.server_status == "stopping"}>
                                        {record.server_status == "stopping" ? `${record.server_status}` : ` Stop Server`}
                                    </Button>
                                </Popconfirm>
                                <Tooltip title={<>
                                    {`${containerURL}/container/server-${record.analysis_id}/`}
                                </>}>
                                    <ExportOutlined style={{ cursor: "pointer" }} onClick={() => {

                                        window.open(`${containerURL}/container/server-${record.analysis_id}/`, "_blank")
                                    }} />
                                </Tooltip>



                            </> : <>
                                <Popconfirm title="Whether to start the server?" onConfirm={() => {

                                    runAnalysis(record, "server")
                                }}>
                                    <Button size="small" color="cyan" variant="solid">Run Server</Button>
                                </Popconfirm>

                            </>
                        }

                    </>} */}

                    {/* {editParams && <Button size="small" color="cyan" variant="solid" onClick={() => editParams(record)}>编辑参数</Button>} */}
                    {
                        checkIsOpen(record.analysis_id) ?
                            <Button size="small" color={"blue"} variant="solid" onClick={() => {
                                // closeModal()
                                // setAnalysisId(null)
                                closeAnalysis(record.analysis_id)
                            }}>Close</Button> :
                            <Tooltip title={record.component_type}>
                                <Button size="small" color={"cyan"} variant="solid" onClick={() => {
                                    // if (record.component_type == "software") {

                                    // } else if (record.component_type == "script") {

                                    // }
                                    // navigate(`/c/tools/${record.relation_id}/${record.analysis_id}`)
                                    // openModal("componentsRender", {
                                    //     view: "analysisResultView", analysis_id: record.analysis_id,
                                    // })
                                    // openModal("modalA", record)
                                    setAnalysisId(record.analysis_id)
                                    // analysisNodePanel
                                    setView("analysisNodePanel")
                                    addOpenAnalysis({
                                        analysis_id: record.analysis_id,
                                        analysis_name: record.analysis_name
                                    })
                                    //

                                    // setRecord(record)
                                }}>Results</Button>
                            </Tooltip>

                    }


                    <Dropdown menu={{
                        items: [
                            {
                                key: "runningContainer",
                                label: (<a onClick={() => {
                                    openModal("componentsRender", {
                                        view: "runningContainer", analysis_id: record.analysis_id,
                                        component_id: record.component_id
                                    })
                                    // setRecord(record)
                                }}>Running Container</a>)
                            }, {
                                key: "paramsFile",
                                label: (<a onClick={() => {
                                    openModal("paramsFile", { file_path: record.params_path })
                                    // setRecord(record)
                                }}>Parameters</a>)
                            }, {
                                key: "command_path",
                                label: (<a onClick={() => {
                                    openModal("paramsFile", { file_path: record.command_path })
                                    // setRecord(record)
                                }}>Command</a>)
                            }, {
                                key: "output_file",
                                label: (<a onClick={() => {
                                    openModal("componentsRender", { view: "fileBrowser", path: record.output_dir })
                                    // setRecord(record)
                                }}>Output File</a>)
                            }, {
                                key: "log_file",
                                label: (<a onClick={() => {
                                    openModal("componentsRender", { view: "logFile", file_path: record.command_log_path })
                                    // setRecord(record)
                                }}>Log File</a>)
                            }, {
                                key: "GoReport",
                                label: (<>
                                    <Button size="small" color="primary" variant="solid" onClick={() =>
                                        navigate(`/analysis-report?key=${record?.analysis_id}&project=${project}`)
                                    }>Go Report</Button>
                                </>)
                            }, {
                                key: "edit_params",
                                label: (<>
                                    <Button size="small" color="cyan" variant="solid" onClick={() => openModal("editParams", record.analysis_id)}>Edit Parameters</Button>

                                </>)
                            }, {
                                key: "view_workflow",
                                label: <>

                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        openModal("resultParsePanel", {
                                            analysis_id: record.analysis_id,
                                        })
                                    }}>Result Parse</Button>

                                </>
                            },

                            {
                                key: "1",
                                label: (<>
                                    {
                                        isSelected(record, ["modalB"]) ?
                                            <a onClick={() => {
                                                closeModal()
                                            }}>Close</a> :
                                            <a onClick={() => {
                                                openModal("modalB", record)
                                                // setRecord(record)
                                            }}>Details</a>
                                    }
                                </>)
                            },
                            {
                                key: 'inspect_job',
                                disabled: record.job_status != "running",
                                label: (<>
                                    <a onClick={async () => {
                                        // await axios.get(`/container/inspect/${record.analysis_id}`)
                                        openModals("inspectPanel", {
                                            inspect: "inspect",
                                            id: record.analysis_id,
                                            run_type: "job"
                                        })
                                    }}>Inspect Job</a>
                                </>)
                            }, {
                                key: 'inspect_server',
                                disabled: record.server_status != "running",
                                label: (<>
                                    <a onClick={async () => {
                                        // await axios.get(`/container/inspect/${record.analysis_id}`)
                                        openModals("inspectPanel", {
                                            inspect: "inspect",
                                            id: record.analysis_id,
                                            run_type: "server"
                                        })
                                    }}>Inspect Server</a>
                                </>)
                            },
                            {
                                key: '3',
                                label: (<>
                                    <a onClick={() => {
                                        navigate(`/software-analysis-editor/${record.analysis_id}`, {
                                            state: {
                                                location: location.pathname,
                                            }
                                        })
                                    }}>Edit</a>
                                </>)
                            }, {
                                key: '4',
                                label: (<> <Popconfirm title={"Delete or not?"} onConfirm={async () => {
                                    await deleteById(record.analysis_id)
                                    loadData()
                                    setAnalysisId(null)
                                }}>
                                    <a style={{ color: 'red' }}>Delete</a>
                                </Popconfirm></>)
                            }, {
                                key: '5',
                                label: (<> <Popconfirm title={record.is_report ? "Whether to cancel the report?" : "Whether to the report?"} onConfirm={async () => {
                                    await axios.post(`/analysis/update-report/${record.analysis_id}`)
                                    loadData()
                                }}>
                                    {record.is_report ? "Cancel Report" : "Report"}
                                </Popconfirm></>)
                            },
                            {
                                key: 'analysisTaskDrawer',
                                label: (<>
                                    <a onClick={() => {
                                        openModal("analysisTaskDrawer", { analysis_id: record.analysis_id })
                                    }}>Analysis Task</a>
                                </>)
                            },
                            // {
                            //     key: '6',
                            //     label: (<>
                            //         <a onClick={() => {
                            //             openModal("addProject", record)
                            //         }}>Add Project</a>
                            //     </>)
                            // }
                        ]
                    }}>
                        <a onClick={(e) => e.preventDefault()}>
                            <Space>
                                More
                                <DownOutlined />
                            </Space>
                        </a>
                    </Dropdown>
                </Space >
            ),
        },
    ]

    useEffect(() => {
        closeModal()
    }, [project])

    // useEffect(() => {
    //     loadData()
    // }, [project])
    // const [searchText, setSearchText] = useState("");
    // const filteredData = useMemo(() => {
    //     if (!searchText) return data;
    //     return data.filter((item: any) =>
    //         Object.values(item).some((val) =>
    //             String(val).toLowerCase().includes(searchText.toLowerCase())
    //         )
    //     );
    // }, [data, searchText]);
    return <>
        {/* {JSON.stringify(location.pathname)} */}
        <Card size="small"
            variant="borderless"
            style={{
                boxShadow: "none"
            }}
            styles={{
                body: {
                    padding: "0.5rem 0 0 0 "
                }
            }}
            title={<><LineChartOutlined />  Analysis Record</>} extra={
                <Flex gap={"small"} wrap>
                    <Input.Search
                        size="small"
                        placeholder="Search..."
                        allowClear
                        enterButton
                        onSearch={(e: any) => {
                            // console.log(e)
                            search(e)
                        }}
                        // value={searchText}
                        // onChange={(e: any) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                    {/* {software && <>
                    {software.outputFormat && <>
                        {software.outputFormat.map((item: any, index: any) =>
                            <Button key={index} color="cyan" variant="solid" onClick={() => {
                                operatePipeline.openModal("modalB", {
                                    module_type: "py_parse_analysis_result",
                                    module_name: item.module,
                                    component_id: software.component_id,
                                })
                            }}>输出解析模块({item.module})</Button>)}
                    </>}
                </>} */}
                    <RedoOutlined style={{ cursor: "pointer" }} onClick={loadData} />
                    {/* <Button size="small" color="cyan"  variant="solid"  onClick={loadData}>Refresh</Button> */}
                </Flex>
            } >
            {/* {software && <ul style={{ marginBottom: "0.5rem" }}>
                {software.outputFormat && <>
                    {software.outputFormat.map((item: any, index: any) => <li key={index}>
                            输出文件: {item.outputFile} 输出路径: {item.dir}
                    </li>
                    </>}
                    )}
            </ul>} */}

            <Table
                // title={() => (
                //     <Input.Search
                //         size="small"
                //         placeholder="搜索结果..."
                //         allowClear
                //         enterButton
                //         value={searchText}
                //         onChange={(e: any) => setSearchText(e.target.value)}
                //         style={{ width: 300 }}
                //     />
                // )}
                rowKey="analysis_id"
                size="small"
                // bordered
                pagination={false}
                loading={loading}
                scroll={{ x: 'max-content', y: 55 * 5 }}
                columns={columns}
                footer={() => <>
                    {totalPage != 0 && <Flex style={{ marginTop: "1rem" }} justify="space-between" align="center">
                        A total of {totalPage} records  &nbsp;
                        <Pagination
                            size="small"
                            current={pageNumber}
                            pageSize={pageSize}
                            total={totalPage}
                            onChange={(p) => setPageNumber(p)}
                            showSizeChanger={false}
                        />
                    </Flex>}
                </>}
                dataSource={data} />

        </Card>
        <div style={{ marginBottom: "1rem" }}></div>
        {analysisId && <>
            {/* <ComponentsDetailsRender
                analysis_id={analysisId}
                // analysis_id={analysisId}
                view={"analysisResultView"}
            />
             */}
            {/* <ViewResolver
                analysis_id={analysisId}
                view="analysisNodePanel">
            </ViewResolver> */}
        </>}

        {/* <AnalysisResultPanel
            // ref={analysisResultRef}
            callback={loadData}
            visible={modal.key == "modalA" && modal.visible}
            params={modal.params}
            onClose={closeModal}></AnalysisResultPanel> */}

        <ResultParsePanel
            visible={modal.key == "resultParsePanel" && modal.visible}
            onClose={closeModal}
            callback={loadData}
            params={modal.params}
        ></ResultParsePanel>
        <AnalysisTaskPanel
            visible={modal.key == "analysisTaskDrawer" && modal.visible}
            onClose={closeModal}
            callback={loadData}
            params={modal.params}
        ></AnalysisTaskPanel>
        <PipelineInfo
            ref={pipelineInfoRef}
            visible={modal.key == "modalB" && modal.visible}
            params={modal.params}
            onClose={closeModal}
            callback={loadData}></PipelineInfo>
        <ParamsFile
            visible={modal.key == "paramsFile" && modal.visible}
            params={modal.params}
            onClose={closeModal}
            callback={loadData}
        ></ParamsFile>
        <EditParams
            callback={loadData}
            visible={modal.key == "editParams" && modal.visible}
            params={modal.params}
            onClose={closeModal}
        ></EditParams>
        {/* <AddProject
            callback={loadData}
            visible={modal.key == "addProject" && modal.visible}
            params={modal.params}
            onClose={closeModal}
        ></AddProject> */}

        <InspectPanel
            callback={loadData}
            visible={modals.inspectPanel.visible}
            params={modals.inspectPanel.params}
            onClose={() => closeModals("inspectPanel")}
        ></InspectPanel>

        <ComponentsRender
            visible={modal.key == "componentsRender" && modal.visible}
            params={modal.params}
            onClose={closeModal}
            callback={loadData}
        ></ComponentsRender>



        {/* <ResultParse
            visible={modal.key == "modalA" && modal.visible}
            onClose={closeModal}
            // callback={loadData}
            params={modal.params}
        ></ResultParse> */}

    </>
})

export default memo(AnalysisList);


const AddProject: FC<any> = ({ visible, params, onClose, callback }) => {
    const [projectList, setProjectList] = useState<any>([])
    const { messageApi, project } = useOutletContext<any>()
    const [form] = Form.useForm()


    const loadData = async () => {
        const resp: any = await axios.get("/project/list-project")
        // console.log(resp.data)
        const projectList_ = resp.data.map((item: any) => {
            return {
                label: `${item.project_name}`,
                value: item.project_id
            }
        })
        setProjectList(projectList_.filter((item: any) => item.value != project))
    }



    useEffect(() => {
        loadData()
        form.resetFields()
        if (params?.extra_project_ids) {
            form.setFieldValue("project", JSON.parse(params?.extra_project_ids))

        }
    }, [project])
    const updateProject = async () => {

        const values = await form.validateFields()
        await axios.post(`/analysis/update-extra-project/${params?.analysis_id}`, values)
        messageApi.success("添加成功!")
        if (callback) {
            callback()
        }
    }

    return <Modal
        onOk={updateProject}
        title={`添加项目(${params?.analysis_name})`}
        open={visible}
        onCancel={onClose}
        onClose={onClose} >
        {/* {JSON.stringify(params)} */}
        <Form form={form}>
            <Form.Item name={"project"} label="项目">
                <Select options={projectList} mode="multiple"></Select>
            </Form.Item>
        </Form>
    </Modal>
}


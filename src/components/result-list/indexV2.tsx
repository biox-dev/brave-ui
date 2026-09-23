import { SSEContextType } from "@/type/sse"
import { Venn } from "@ant-design/plots"
import { Alert, Button, Card, Dropdown, Empty, Flex, Form, GetProp, Input, InputNumber, Modal, Popconfirm, Popover, Select, Skeleton, Space, Spin, Table, Tabs, Tag, theme, Tooltip, Typography, Upload, UploadFile, UploadProps } from "antd"
import axios from "axios"
import { FC, forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useNavigate, useOutletContext, useParams } from "react-router"
import { CloudDownloadOutlined, CloudUploadOutlined, DeleteFilled, DeleteOutlined, DownloadOutlined, DownOutlined, EditOutlined, FileOutlined, ImportOutlined, InboxOutlined, PlusCircleOutlined, QuestionCircleOutlined, RedoOutlined, UploadOutlined } from "@ant-design/icons"
import ImportData from "../import-data"
import { useModal } from "@/hooks/useModal"
export const readHdfsAPi = (contentPath: any) => axios.get(`/api/read-hdfs?path=${contentPath}`)
export const readJsonAPi = (contentPath: any) => axios.get(`/fast-api/read-json?path=${contentPath}`)
import { listFileByProjectGroupApi } from "@/api/data"
import AnalysisResultEdit from "../analysis-result-edit"
import Dragger from "antd/es/upload/Dragger"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useSelector } from "react-redux"
import BigTable from '@/components/big-table';
import { el, fa } from "@faker-js/faker"
import { EditResultTableModal } from "../edit-table"
import { useStoreRender } from "@/context/render/RenderProvider"
import { invoke } from "@/core/ui-system/invokeV2"
// import PreviewExample from "./components/preview-example"




const ResultList = forwardRef<any, any>((params_, ref) => {
    console.log("ResultList Render")
    const {
        pipeline,
        software,
        title,
        appendSampleColumns = [],
        // setResultTableList,
        cleanDom,
        analysisType,
        setRecord,
        setTableLoading,
        setTabletData,
        // analysisMethod,
        columnsParamsALL,
        // activeTabKey,
        // setActiveTabKey,
        cardExtra,
        operatePipeline,
        relationType,
        onChangeAnalysisResultId,
        // currentAnalysisMethod,
        // setCurrentAnalysisMethod,
        params,
        // componentParentIdsMap,
        // setComponentParentIdsMap,
        ...rest
    } = params_
    useImperativeHandle(ref, () => ({
        reload
    }))
    const { setResultTableList } = useStoreRender()

    const analysisMethod = [
        {
            "name": "raw_reads",
            "mode": "multiple",
            "type": "GroupSelectAssayButton",
            "label": "Raw Reads", "group": "group_field",
            "rules": [{ "required": true, "message": "This field cannot be empty!" }],
            "dir": "", "fileFormat": { "profile": "*.tsv" },
            "inputForm": [
                {
                    "name": ["content", "fastq1"],
                    "initialValue": "/data/wangyang/NGS_TEST/*_1.fastq.gz",
                    "label": "fastq1", "type": "BaseInput", "rules": [{ "required": true, "message": "This field cannot be empty!" }]
                },
                { "name": ["content", "fastq2"], "initialValue": "/data/wangyang/NGS_TEST/*_2.fastq.gz", "label": "fastq2", "type": "BaseInput", "rules": [{ "required": true, "message": "This field cannot be empty!" }] }],

            "id": 11, "component_id": "EXP", 
            "install_key": null, "component_type": "file", "component_name": "Experimental Data List", "description": null, "component_ids": null, "img": "/brave-api/img/pipeline.jpg", "container_id": null, "tools_container_id": null, "prompt": null, "io_schema": null, "sub_container_id": null, "tags": null, 
            "file_type": "collected", "script_type": null, "category": null, "order_index": null, "position": null, "edges": null, "created_at": "2026-06-09T22:30:49", "updated_at": null
        }]
        // individual collected
    const { project, projectObj } = useOutletContext<any>()
    const message = useGlobalMessage()
    const [data, setData] = useState<any>()
    const [groupedData, setGroupedData] = useState<any>()
    // const [content,setContent] = useState<any>()
    const [loading, setLoading] = useState(true)
    // const { eventSource } = useOutletContext<SSEContextType>();
    const { modal, openModal, closeModal } = useModal();
    const [tableRows, setTableRows] = useState<any[]>([])
    const [tableRowsInfo, setTableRowsInfo] = useState<any>({})
    const [tableColumns, setTableColumns_] = useState<any[]>([])
    const [tableRowLoading, setTableRowLoading] = useState<boolean>(true)
    const [analysisResultId, setAnalysisResultId_] = useState<any>()
    const [rowNum, setRowNum] = useState<number>(10)
    const { baseURL } = useSelector((state: any) => state.user)
    const navigate = useNavigate()
    const [activeTabKey, setActiveTabKey] = useState<any>()
    const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})
    const setAnalysisResultId = (analysis_result_id: any) => {
        setAnalysisResultId_(analysis_result_id)
        if (onChangeAnalysisResultId) {
            onChangeAnalysisResultId(analysis_result_id)

        }
    }
    const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()
    const setTableColumns = (columns: any[]) => {
        // const columns_ = columns.map((it: any) => it.columns_name)
        setTableColumns_([])
    }
    const sseData = useSelector((state: any) => state.global.sseData)
    useEffect(() => {
        // console.log("sseData in result list:", data.msgType)
        const data = sseData
        if (data.msgType === "analysis_result") {
            // notify.info({ message: "qqqqqqqqqq" })

            let isReload = false
            if (analysisMethod) {
                const componentIdList = analysisMethod.map((it: any) => it.component_id)
                for (const component_id of data.component_ids) {
                    console.log(component_id)
                    if (componentIdList.includes(component_id)) {
                        isReload = true
                        break
                    }
                }
            }


            if (isReload) {
                reload()
            }
        }
    }, [sseData])

    // useEffect(() => {
    //     if (!eventSourceRef) return;

    //     const handler = (event: MessageEvent) => {
    //         const data = JSON.parse(event.data)
    //         // console.log("analysis_result", data)
    //         if (data.msgType === "analysis_result") {
    //             // message.success(data.msg)
    //             const componentIdList = analysisMethod.map((it: any) => it.component_id)
    //             console.log("componentIdList", componentIdList)
    //             console.log("data.component_id ", data.component_id)
    //             console.log(" componentIdList.includes(data.component_id) ", componentIdList.includes(data.component_id))
    //             if (componentIdList.includes(data.component_id)) {
    //                 reload()
    //                 // console.log("reload", currentAnalysisMethod?.component_id)   
    //             }
    //         }
    //         // if (data.analysis_id == analysis_id) {
    //         //     if (data.msgType === "workflow_log") {
    //         //         setFileTabKey("workflow_log_file")
    //         //         console.log("workflow_log_file", data)
    //         //         readLogFile(fileMap["workflow_log_file"])
    //         //     } else if (data.msgType === "executor_log") {
    //         //         setFileTabKey("executor_log_file")
    //         //         readLogFile(fileMap["executor_log_file"])
    //         //     } else if (data.msgType === "trace") {
    //         //         setFileTabKey("trace_file")
    //         //         readLogFile(fileMap["trace_file"])
    //         //     } else if (data.msgType == "process_end") {
    //         //         setFileTabKey("workflow_log_file")
    //         //         readLogFile(fileMap["workflow_log_file"])
    //         //         if (callback) {
    //         //             callback()
    //         //         }
    //         //     }
    //         // }
    //     };

    //     eventSourceRef.current?.addEventListener('message', handler);

    //     return () => {
    //         console.log("removeEventListener")
    //         eventSourceRef.current?.removeEventListener('message', handler);
    //     };
    // }, [eventSourceRef.current]);
    // const [currentAnalysisMenthod, setCurrentAnalysisMenthod] = useState<any>()
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()
    // const { setPipelineStructure, setOperateOpen, setPipelineRecord, datelePipeline } = operatePipeline

    // const reload = () => {
    //     loadData(currentAnalysisMethod.value)
    // }
    // useEffect(() => {
    //     const currentAnalysisMethod = analysisMethod[0]
    //     initData(currentAnalysisMethod)
    // }, [])
    // const initData = (currentAnalysisMethod:any)=>{
    //     setActiveTabKey(currentAnalysisMethod.key)
    //     setCurrentAnalysisMethod(currentAnalysisMethod)
    //     loadData(currentAnalysisMethod.value)
    // }
    // const onTabChange = (key:any)=>{
    //     const currentAnalysisMethod = analysisMethod.filter((it:any)=>it.key==key)[0]
    //     initData(currentAnalysisMethod)
    // }

    const reload = () => {
        console.log("analysisMethod: ", analysisMethod)
        if (analysisMethod && Array.isArray(analysisMethod)) {

            // const analysisMethodList = analysisMethod.flatMap((it: any) => it.name)
            const componentIdList = analysisMethod.flatMap((it: any) => it.component_id)

            // console.log("componentIdList", componentIdList)
            loadData({ componentIdList: componentIdList })
        } else {
            loadData({ params: params })
        }

    }

    useEffect(() => {
        reload()
    }, [componentParentIdsMap])

    const getCurrentAnalysisMenthod = (activeTabKey: any) => {
        const analysisMethodDict: any = analysisMethod.reduce((acc: any, item: any) => {
            acc[item?.component_id] = item;
            return acc;
        }, {});
        // const analysisMethodDict = analysisMethidtoDict(analysisMethod)
        const currentAnalysisMenthod = analysisMethodDict[activeTabKey]
        return currentAnalysisMenthod
    }
    useEffect(() => {
        // const currentAnalysisMethod = analysisMethod[0]
        if (analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0) {
            // debugger
            if (setActiveTabKey) {

                setActiveTabKey(analysisMethod[0]?.component_id)
                const currentAnalysisMethod = getCurrentAnalysisMenthod(analysisMethod[0]?.component_id)
                // console.log("currentAnalysisMethod",currentAnalysisMethod)

                setCurrentAnalysisMethod(currentAnalysisMethod)
                const componentIdList = analysisMethod.flatMap((it: any) => it.component_id)

                loadData({ componentIdList: componentIdList, activeTabKey: analysisMethod[0]?.component_id })

            } else {
                reload()
            }
        } else {
            reload()
        }


        // initData(currentAnalysisMethod)
    }, [JSON.stringify(params), JSON.stringify(analysisMethod), project, projectObj?.metadata_form])

    const onTabChange = (key: any) => {
        const data = groupedData[key]

        setData(data)
        setActiveTabKey(key)
        const currentAnalysisMethod = getCurrentAnalysisMenthod(key)
        setCurrentAnalysisMethod(currentAnalysisMethod)

        if (data.length > 0) {
            setAnalysisResultId(data[0].analysis_result_id)
            setTableColumns(data[0].columns)
        } else {
            setTableColumns([])
            setAnalysisResultId(undefined)
        }

    }

    // const getKeyMap = () => {
    //     const analysisMethodMap = Object.fromEntries(analysisMethod.map((item: any) => [item.name, item.inputKey]));
    //     // console.log(analysisMethodMap)
    //     const result: any = {};
    //     Object.entries(analysisMethodMap).forEach(([key, values]) => {
    //         if (Array.isArray(values)) {
    //             values.forEach((value: any) => {
    //                 result[value] = key;
    //             });
    //         } else {
    //             result[values] = key;
    //         }


    //     });
    //     return result
    // }

    const loadTable = async () => {
        if (currentAnalysisMethod?.file_type == "collected" && analysisResultId) {
            setTableRowLoading(true)
            const resp = await axios.get(`/analysis-result/table/${analysisResultId}?row_num=${rowNum}`, {
                timeout: 20000
            })
            setTableRows(resp.data.tables)
            setTableRowLoading(false)
            setTableRowsInfo({
                "nrow": resp.data.nrow,
                "ncol": resp.data.ncol
            })
        } else {
            setTableRows([])
            setTableRowLoading(false)
        }
    }

    useEffect(() => {

        loadTable()

    }, [analysisResultId])


    const loadData = async ({ activeTabKey, params, componentIdList }: any) => {
        setLoading(true)


        if (componentIdList) {
            // const keyMap = getKeyMap()
            // console.log(keyMap)
            // let resp: any = await axios.post(`/analysis-result/list-analysis-result-grouped`, {
            //     project: project,
            //     // analysis_method: analysisMethodValues,
            //     component_ids: componentIdList,
            //     component_parent_ids_map: componentParentIdsMap,
            //     // rows: -1,
            //     ...params
            // })
            let resp = await listFileByProjectGroupApi("default")
            setLoading(false)
            const groupedData = resp.data;
            // debugger
            // const groupedData = resp.data.reduce((acc: any, item: any) => {
            //     const key = item.component_id;
            //     // const key = keyMap[item.analysis_method]
            //     if (!acc[key]) {
            //         acc[key] = [];
            //     }
            //     const { sample_name, id, sample_group, ...rest } = item
            //     // debugger
            //     acc[key].push({
            //         label: sample_name,
            //         value: id,
            //         // sample_group: sample_group ? sample_group : "no_group",
            //         sample_name: sample_name,
            //         id: id,
            //         // "aaa":"1111",
            //         ...rest
            //     });
            //     return acc;
            // }, {});
            console.log("groupedData", groupedData)
            if (setResultTableList) {
                // console.log(groupedData)
                // setResultTableList(groupedData)
            }
            setGroupedData(groupedData)
            // console.log("activeTabKey: ", activeTabKey)
            let currentData;
            if (activeTabKey) {
                currentData = groupedData[activeTabKey] ? groupedData[activeTabKey] : []

            } else {
                currentData = groupedData[analysisMethod[0]?.component_id] ? groupedData[analysisMethod[0]?.component_id] : []
                // setData(groupedData[analysisMethod[0]?.component_id] ? groupedData[analysisMethod[0]?.component_id] : [])
            }
            setData(currentData)

            if (currentData.length > 0) {
                setAnalysisResultId(currentData[0].id)
                setTableColumns(currentData[0].columns)
            } else {
                setTableColumns([])
                setAnalysisResultId(undefined)
            }

        } else {
            let resp: any = await axios.post(`/analysis-result/list-analysis-result`, {
                project: project,
                // analysis_method: analysisMethodValues,
                component_ids: componentIdList,
                ...params
            })
            // console.log(resp.data)
            setData(resp.data)
        }

        setLoading(false)
    }

    // useEffect(() => {
    //     reload()

    // }, [])
    const deleteById = async (id: any) => {
        const resp: any = await axios.delete(`/analyais-result/delete-by-id/${id}`)
        message.success("删除成功!")
        reload()
    }
    // const readHdfs = async (contentPath: any) => {
    //     setTableLoading(true)
    //     const resp: any = await readHdfsAPi(contentPath)

    //     setTabletData(resp.data)
    //     setTableLoading(false)
    //     // reset()
    //     // console.log(resp.data)
    //     // setData(resp.data)
    // }
    const readJOSN = async (contentPath: any) => {
        setTableLoading(true)
        const resp: any = await readJsonAPi(contentPath)
        setTabletData(resp.data)
        setTableLoading(false)
        // reset()
        // console.log(resp.data)
        // setData(resp.data)
    }
    const downloadTSV = (tsvData: string, filename = 'data.tsv') => {
        const blob = new Blob([tsvData], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // 释放内存:ml-citation{ref="2,7" data="citationList"}
    };
    const downloadHdfs = async (contentPath: any) => {
        const resp: any = await axios.get(`/api/download-hdfs?path=${contentPath}`)
        // console.log(contentPath.split('/').pop())
        downloadTSV(resp.data, contentPath.split('/').pop())
    }

    const getFileExt = (filePath: string) => {
        const fileName = filePath.split("/").pop() || filePath
        const idx = fileName.lastIndexOf(".")
        if (idx < 0) {
            return ""
        }
        return fileName.slice(idx + 1).toLowerCase()
    }

    const SHEET_FILE_EXTENSIONS = new Set(["xlsx", "xls", "csv", "tsv", "ods"])

    const handleOpenContent = (record: any) => {
        const contentPath = record?.content
        if (!contentPath || typeof contentPath !== "string") {
            operatePipeline.openModal("openFile", { content: record?.content, fileType: record?.file_type })
            return
        }

        const ext = getFileExt(contentPath)
        if (SHEET_FILE_EXTENSIONS.has(ext)) {
            invoke.univerView.open({ path: contentPath }, {
                width: "90%",
                title: record?.file_name || "Sheet Preview",
                footer: null,
            })
            return
        }

        const url = `/brave-api/file-operation/download?path=${encodeURIComponent(contentPath)}`
        window.open(url, "_blank")
    }

    const getMetadataColumns = () => {
        // console.log("projectObj",projectObj?.metadata_form)
        if (!projectObj?.metadata_form || !Array.isArray(projectObj?.metadata_form)) return []
        return projectObj?.metadata_form?.map((item: any) => {
            return {
                title: item.label,
                dataIndex: item.name,
                key: item.name,
                ellipsis: true,
                // render: (text: any, record: any) => {
                //     return <Tooltip title={record[item.name]}>
                //         <span style={{ cursor: "pointer" }}>{text}</span>
                //     </Tooltip>
                // }
            }
        })
    }

    let columns: any = [
        {
            title: 'Project Name',
            dataIndex: 'project_name',
            key: 'project_name',
            width: 100,
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={record.project}>
                    <span style={{ cursor: "pointer" }}>{text}</span>
                </Tooltip>
            }
        }, {
            title: 'File Name',
            dataIndex: 'file_name',
            key: 'file_name',
            width: 100,
            ellipsis: true,
        }, {
            title: 'Analysis Name',
            dataIndex: 'analysis_name',
            key: 'analysis_name',
            width: 100,
            ellipsis: true,
        },

        {
            title: 'Analysis Result ID',
            dataIndex: 'analysis_result_id',
            key: 'analysis_result_id',
            width: 50,
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={record.analysis_result_id}>
                    <span style={{ cursor: "pointer" }} >{String(text).slice(0, 8)}</span>
                </Tooltip>
            }

        }, {
            title: 'Analysis Id',
            dataIndex: 'analysis_id',
            key: 'analysis_id',
            width: 50,
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={record.analysis_id}>
                    <span style={{ cursor: "pointer" }} >{text ? String(text).slice(0, 8) : ""}</span>
                </Tooltip>
            }

        },
        {
            title: 'Component Name',
            dataIndex: 'component_name',
            key: 'component_name',
            width: 100,
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={<>
                    <ul>
                        <li>analysis_id: {record.analysis_id}</li>
                        <li>component_id: {record.component_id}</li>
                        <li>analysis_result_id: {record.analysis_result_id}</li>
                        <li>sample_id: {record.sample_id}</li>
                        <li>file_name: {record.file_name}</li>
                        <li>analysis_result_hash: {record.analysis_result_hash}</li>
                    </ul>
                </>}>
                    <span style={{ cursor: "pointer" }}>{text}</span>
                </Tooltip>
            }
        },
        {
            title: 'Sample Name',
            dataIndex: 'sample_name',
            key: 'sample_name',
            width: 100,
            ellipsis: true,
            render: (text: any, record: any) => {
                return <Tooltip title={<>
                    <ul>
                        <li>sample_id: {record.sample_id}</li>
                        {/* <li>ID: {record.id}</li> */}
                        {/* <li>analysis_id: {record.analysis_id}</li>
                        <li>file_name: {record.file_name}</li> */}
                        {/* <li>analysis_name: {record.analysis_name}</li> */}
                    </ul>
                </>}>
                    <span style={{ cursor: "pointer" }}>{text}</span>
                </Tooltip>
            }

        },
        //  {
        //     title: 'Sample Source',
        //     dataIndex: 'sample_source',
        //     key: 'sample_source',
        //     width: 100,
        //     ellipsis: true,
        // },
        ...getMetadataColumns(),

        ...appendSampleColumns, {
            title: 'Action',
            key: 'action',
            fixed: "right",
            ellipsis: true,
            width: 100,

            render: (_: any, record: any) => (
                <Space size="middle">
                    {/* <Button type="link" size="small" onClick={() => {
                        handleOpenContent(record)
                    }}>
                        Open
                    </Button> */}
                    <Popover content={<>
                        {/* {record.component_id} */}
                        <Typography >
                            <pre>{JSON.stringify(record.content, null, 2)}</pre>
                        </Typography>
                        {/* {record.analysis_name} */}
                    </>} >



                        <Button size="small" color="cyan" type="link" onClick={() => {
                            // record.content = JSON.parse(record.content)
                            if (setRecord) {
                                setRecord(record)
                            }
                            // if (cleanDom) {
                            //     cleanDom(undefined)
                            // }
                            if (record.type == "folder") {
                                setComponentParentIdsMap((prev: any) => ({
                                    ...prev,
                                    [currentAnalysisMethod.component_id]: record.analysis_result_id
                                }))

                            } else {
                                handleOpenContent(record)
                                // operatePipeline.openModal("openFile", { content: record.content, fileType: record.file_type })

                            }

                            // const param = JSON.parse(record.request_param)
                            // console.log(param)
                            // form.resetFields()
                            // form.setFieldsValue(param)
                            // if (record?.id) {
                            //     form.setFieldValue("id", record?.id)
                            // }
                            // readHdfs(record.content)
                        }}>{record.type == "folder" ? "Open Folder" : "Open File"}</Button>
                    </Popover>

                    <Dropdown menu={{
                        items: [
                            {
                                key: 'metadata',
                                label: <>
                                    {
                                        record.sample_name ?
                                            <>
                                                <Button size="small" color="cyan" variant="solid" onClick={() => {
                                                    operatePipeline.openModal("metadataForm", {
                                                        analysis_result_id: record.analysis_result_id,
                                                        sample_id: record.sample_id,
                                                        callback: reload
                                                    })
                                                }}>metadata</Button>
                                            </> :
                                            <>
                                                <Button size="small" color="cyan" variant="solid" onClick={() => {
                                                    operatePipeline.openModal("metadataForm", {
                                                        analysis_result_id: record.analysis_result_id,
                                                        callback: reload
                                                    })
                                                }}>Add Metadata</Button>
                                            </>
                                    }
                                </>
                            }, {
                                key: 'bind-sample',
                                label: <>
                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        console.log(operatePipeline)
                                        operatePipeline.openModals("bindSample", {
                                            analysis_result_id: record.analysis_result_id,
                                            callback: reload
                                        })
                                    }}>Bind Sample </Button>
                                </>
                            }, {
                                key: 'delete',
                                label: <>

                                    <Popconfirm title="Are you sure you want to delete it?" onConfirm={async () => {
                                        await deleteById(record.analysis_result_id)
                                    }}>
                                        <Button size="small" color="danger" variant="solid">Delete</Button>
                                    </Popconfirm>
                                </>
                            }
                        ]
                    }}>
                        <a onClick={(e) => e.preventDefault()}>
                            <Space>
                                More
                                <DownOutlined />
                            </Space>
                        </a>
                    </Dropdown>



                </Space>
            ),
        },
    ]
    const [searchText, setSearchText] = useState("");
    let filteredData: any = useMemo(() => {
        if (!searchText) {
            if (currentAnalysisMethod?.file_type == "collected") {
                return tableRows
            } else {
                return data
            }
        }
        if (currentAnalysisMethod?.file_type == "collected") {
            return tableRows.filter((item: any) =>
                Object.values(item).some((val) =>
                    String(val).toLowerCase().includes(searchText.toLowerCase())
                )
            );
        } else {
            return data.filter((item: any) =>
                Object.values(item).some((val) =>
                    String(val).toLowerCase().includes(searchText.toLowerCase())
                )
            );
        }

    }, [data, tableRows, searchText]);

    // if (currentAnalysisMethod?.file_type == "collected") {
    //     filteredTableRows = useMemo(() => {
    //         if (!searchText) return data;
    //         return tableRows.filter((item: any) =>
    //             Object.values(item).some((val) =>
    //                 String(val).toLowerCase().includes(searchText.toLowerCase())
    //             )
    //         );
    //     }, [data, searchText]);
    // } else {

    // }





    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [uploading, setUploading] = useState(false);
    // const [file, setFile] = useState<any>();

    const props: UploadProps = {
        onRemove: (file) => {
            const index = fileList.indexOf(file);
            const newFileList = fileList.slice();
            newFileList.splice(index, 1);
            setFileList(newFileList);
        },
        beforeUpload: (file) => {
            // setFileList([...fileList, file]);
            // console.log("file", file)
            handleUpload(file);
            // setFile(file)
            return false;
        },
        fileList,
        // onChange(info) {
        //     console.log("onChange: ", info.fileList);
        //     // if (info.fileList.length > 0) {
        //     //     handleUpload(info.fileList[0] as FileType);
        //     // }

        // }
    };
    type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];

    const handleUpload = async (file: any) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project', project);
        // formData.append('file_type', currentAnalysisMethod?.file_type)
        formData.append('component_id', currentAnalysisMethod?.component_id)
        // console.log("formData", formData)f
        for (let [key, value] of formData.entries()) {
            console.log(key, value);
        }
        // /analysis-result/upload
        try {
            const resp = await axios.post('/analysis-result/upload', formData, {
                timeout: 60000
            })
            message.success(`${resp.data.file_path} file uploaded successfully`);
        } catch (error) {

        }

        setUploading(false);
        reload()



        // fileList.forEach((file) => {
        //     formData.append('files[]', file as FileType);
        // });
        // setUploading(true);
        // You can use any AJAX library you like
        // fetch('https://660d2bd96ddfa2943b33731c.mockapi.io/api/upload', {
        //     method: 'POST',
        //     body: formData,
        // })
        //     .then((res) => res.json())
        //     .then(() => {
        //         setFileList([]);
        //         message.success('upload successfully.');
        //     })
        //     .catch(() => {
        //         message.error('upload failed.');
        //     })
        //     .finally(() => {
        //         setUploading(false);
        //     });
    };

    const getCurrectParent = () => {
        if (!componentParentIdsMap || !currentAnalysisMethod) return null
        return <a onClick={() => {
            setComponentParentIdsMap((prev: any) => ({
                ...prev,
                [currentAnalysisMethod.component_id]: undefined
            }))
        }}>
            {componentParentIdsMap[currentAnalysisMethod.component_id]}
        </a>
    }
    return <>
        <Card size="small"
            variant="borderless"
            style={{
                boxShadow: "none"
            }}
            styles={{
                body: {
                    padding: "0.5rem"
                }
            }}
            title={<Flex gap={"small"}><FileOutlined />

                {currentAnalysisMethod?.component_name && <Tooltip title={<>
                    <ul>
                        {pipeline?.component_id && <li>pipeline: {pipeline?.component_id}</li>}
                        {software?.component_id && <li>software: {software?.component_id}</li>}
                        {currentAnalysisMethod?.component_id && <li>file: {currentAnalysisMethod?.component_id}</li>}
                        {currentAnalysisMethod?.name && <li>name: {currentAnalysisMethod?.name}</li>}
                    </ul>
                </>}>
                    <span
                        onClick={() => {
                            navigate(`/component/file/${currentAnalysisMethod.component_id}`)
                        }}
                        style={{ cursor: "pointer" }}>{title} ({currentAnalysisMethod?.component_name})</span>

                </Tooltip>}

                {currentAnalysisMethod?.file_type && <Tag color="success">{currentAnalysisMethod?.file_type}</Tag>}
            </Flex>}

            extra={<>{cardExtra}

                <Flex gap={"small"} wrap>

                    {/* {JSON.stringify(analysisMethod)} */}
                    {getCurrectParent()}
                    <Input.Search
                        size="small"
                        placeholder="Search..."
                        allowClear
                        enterButton
                        value={searchText}
                        onChange={(e: any) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />





                    {/* <a onClick={()=>{openModal("previewExample",{component_id:currentAnalysisMethod.component_id})}}>Example</a> */}
                    {/* /analysis-result/preview-example/{component_id} */}



                    <ImportOutlined style={{ cursor: "pointer" }} onClick={() => {
                        openModal("importFile", {
                            ...currentAnalysisMethod,
                            analysisResultParentId: componentParentIdsMap ? componentParentIdsMap[currentAnalysisMethod.component_id] : undefined,
                            operatePipeline: operatePipeline
                        })
                    }} />


                    {currentAnalysisMethod?.file_type != "collected" && <>
                        <a onClick={() => {
                            openModal("createFolder", { ...currentAnalysisMethod })
                        }}>Create Folder</a>

                    </>}


                    {operatePipeline?.openModal && <>
                        <Dropdown menu={{
                            items: [


                                {
                                    key: '3',
                                    label: (
                                        <Tooltip title={currentAnalysisMethod?.component_name}>
                                            <a onClick={() => {
                                                operatePipeline.openModal("createOrUpdatePipelineComponent", {
                                                    data: currentAnalysisMethod, structure: {
                                                        component_type: "file",
                                                    }
                                                })
                                            }}>Edit File</a>
                                        </Tooltip>
                                    )
                                },

                                {
                                    label: (
                                        <Tooltip title={currentAnalysisMethod?.component_name}>
                                            <Popconfirm title="Whether bind metadata?" onConfirm={async () => {
                                                await axios.post(`/analysis-result/batch-bind-sample/${currentAnalysisMethod.component_id}?project_id=${project}`)
                                                message.success("Bind metadata successfully!")
                                                reload()
                                            }}>
                                                <a>Bind metadata</a>
                                            </Popconfirm>
                                        </Tooltip>
                                    ),
                                    key: '9',
                                },
                                {
                                    label: (
                                        <Tooltip title={currentAnalysisMethod?.component_name}>
                                            <Popconfirm title="Remove all?" onConfirm={async () => {
                                                await axios.post(`/analysis-result/batch-remove/${currentAnalysisMethod.component_id}?project_id=${project}`)
                                                message.success("Remove all successfully!")
                                                reload()
                                            }}>
                                                <a>Remove all</a>
                                            </Popconfirm>
                                        </Tooltip>
                                    ),
                                    key: '10',
                                }
                            ]
                        }}>
                            <a onClick={(e) => e.preventDefault()}>
                                <Space>
                                    More
                                    <DownOutlined />
                                </Space>
                            </a>
                        </Dropdown>
                    </>}

                    <RedoOutlined style={{ cursor: "pointer" }} onClick={reload} />
                    <Popconfirm title="Create metadata?" onConfirm={async () => {
                        await axios.post(`/analysis-result/create-metadata?project_id=${project}&component_id=${currentAnalysisMethod.component_id}`)
                    }}>
                        <PlusCircleOutlined style={{ cursor: "pointer" }} />
                    </Popconfirm>

                    {currentAnalysisMethod?.file_type != "collected" && <EditOutlined style={{ cursor: "pointer" }} onClick={() => {
                        openModal("editTable", {
                            data: data,
                        })
                    }} />}

                    {/* <RedoOutlined style={{ cursor: "pointer"}}  onClick={reload}/> */}
                    <QuestionCircleOutlined onClick={() => {
                        operatePipeline.openModal("descriptionModal", currentAnalysisMethod.description)
                    }} style={{ cursor: "pointer" }} />
                </Flex>
            </>}
            tabList={analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 1 ?
                analysisMethod.map((it: any) => ({
                    key: it?.component_id, label:
                        <Tooltip title={it?.component_id}>{it?.component_name ? it?.component_name : "no_name"}</Tooltip>
                })) : undefined}
            activeTabKey={activeTabKey}
            onTabChange={onTabChange}

        >


            {sseData.msgType === "analysis_result" && <>
                {/* <Alert closable message={`${sseData?.analysis_name}: Add Analsyis: ${sseData?.add_num}; Update Analysis: ${sseData?.update_num}; Complete Analysis: ${sseData?.complete_num}`} /> */}
                {/* {JSON.stringify(sseData)} */}
            </>}

            {/* {analysisResultId} */}
            {currentAnalysisMethod?.file_type == "collected" ? <>
                {data ? <>

                    <Spin spinning={uploading} tip={"Uploading..."}>

                        {(Array.isArray(data) && data.length == 0) ? <>


                            <Dragger {...props} maxCount={1} >
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined />
                                </p>
                                <p className="ant-upload-text">Click or drag file to this area to upload</p>
                                {/* <p className="ant-upload-hint">
                                Support for a single or bulk upload. Strictly prohibited from uploading company data or other
                                banned files.
                            </p> */}
                            </Dragger>


                        </>
                            :
                            <>

                                <Tabs

                                    activeKey={analysisResultId}
                                    onChange={(key) => {
                                        // debugger
                                        const currentData = data.filter((it: any) => it.analysis_result_id == key)
                                        if (currentData.length > 0) {
                                            setTableColumns(currentData[0].columns)
                                        }

                                        setAnalysisResultId(key)
                                    }}
                                    tabBarExtraContent={
                                        <Flex gap={"small"}>

                                            <InputNumber size="small" value={rowNum} onChange={(val: any) => setRowNum(val)} />

                                            <Upload {...props}>
                                                <Tooltip title="Upload new file">
                                                    <CloudUploadOutlined style={{ cursor: "pointer" }} />
                                                </Tooltip>

                                            </Upload>


                                            <EditOutlined style={{ cursor: "pointer" }}
                                                onClick={() => {
                                                    console.log("analysisResultId", analysisResultId)
                                                    openModal("analysisResultEdit", { analysis_result_id: analysisResultId })
                                                }} />

                                            <Popconfirm title={`Are you sure you want to delete ${analysisResultId}?`} onConfirm={async () => {
                                                await deleteById(analysisResultId)
                                            }}>
                                                <Tooltip title={`Delete current tab ${analysisResultId}`}>
                                                    <DeleteOutlined style={{ cursor: "pointer", color: "red" }} />
                                                </Tooltip>
                                            </Popconfirm>
                                            <RedoOutlined style={{ cursor: "pointer" }} onClick={() => loadTable()} />

                                        </Flex>
                                    }
                                    items={data.map((item: any, index: any) => ({
                                        key: item.analysis_result_id,
                                        label: <Tooltip title={`${item?.content} ${item.analysis_result_id}`}>
                                            {`${item?.file_name}`}
                                            {/* {item?.url} */}

                                            <CloudDownloadOutlined style={{ cursor: "pointer", marginLeft: "0.2rem" }} onClick={() => {
                                                // const currentData = data.find((it: any) => it.analysis_result_id == analysisResultId)
                                                console.log("currentData", item)
                                                window.open(`${baseURL}${item.url}`, '_blank');
                                            }} />

                                        </Tooltip>
                                    }))}></Tabs>
                                <Spin spinning={tableRowLoading} tip={"Loading table data..."}>

                                    <BigTable shape={tableRowsInfo} rows={[tableColumns,
                                        ...filteredData]} />
                                </Spin>
                            </>}

                    </Spin>

                </> : <Skeleton active />}
            </> : <>

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
                    rowKey={(it: any) => it.id}
                    size="small"
                    // bordered
                    // pagination={undefined}
                    pagination={{ pageSize: 10 }}
                    loading={loading}
                    scroll={{ x: 'max-content', y: 55 * 5 }}
                    columns={columnsParamsALL ? columnsParamsALL : columns}
                    footer={() => `A total of ${filteredData && Array.isArray(filteredData) && filteredData.length} records`}
                    dataSource={filteredData} />

            </>}


            {/* {JSON.stringify(data)} */}


            {currentAnalysisMethod?.parseFormat && currentAnalysisMethod?.relation_type == "software_output_file" && <Typography>
                <pre>
                    {JSON.stringify(currentAnalysisMethod.parseFormat, null, 2)}
                </pre>
            </Typography>}

        </Card>


        <ImportData
            visible={modal.visible && modal.key == "importFile"}
            params={modal.params}
            callback={reload}
            onClose={closeModal}></ImportData>

        <AnalysisResultEdit
            visible={modal.visible && modal.key == "analysisResultEdit"}
            params={modal.params}
            callback={reload}
            onClose={closeModal}
        ></AnalysisResultEdit>

        <EditResultTableModal
            visible={modal.visible && modal.key == "editTable"}
            params={modal.params}
            onClose={closeModal}
            callback={reload}
        ></EditResultTableModal>
        <CreateFolderModal
            visible={modal.visible && modal.key == "createFolder"}
            params={modal.params}
            onClose={closeModal}
            callback={reload}
        ></CreateFolderModal>
    </>

})



// const Test:FC<any> = ()=>{
//     console.log("Test Component Render")
//     return <div>Test Component</div>
// }

export default memo(ResultList);


export const AnalysisResultModal: FC<any> = ({ visible, onClose, params }) => {
    if (!visible) return null
    return <>
        <Modal title="分析结果" open={visible} onCancel={onClose} width={"80%"} >
            {/* {JSON.stringify(params)} */}
            <ResultList {...params} analysisType="sample" ></ResultList>
        </Modal>
    </>
}

const CreateFolderModal: FC<any> = ({ visible, onClose, params, callback }) => {
    // use form create a folder
    const [form] = Form.useForm();
    const { project } = useSelector((state: any) => state.user);

    const message = useGlobalMessage();
    const handleOk = async () => {
        const values = await form.validateFields();
        const reqParams = {
            component_id: params.component_id,
            project: project,
            ...values

        }
        console.log("Create Folder Params:", reqParams);
        // api post /analysis-result/create
        const resp = await axios.post('/analysis-result/create', reqParams)
        message.success("Folder created successfully!")
        onClose()
        if (callback) {
            callback()
        }
    };

    return <>
        <Modal title="Create Folder" open={visible} onCancel={onClose} onOk={handleOk}>
            {/* form with fields:
            file_name: str
            parent_id: Optional[str]=None
            type: str  # 'folder','file'
            component_id: str */}
            <Form form={form} layout="vertical">
                <Form.Item name="type" label="Type" initialValue="folder" rules={[{ required: true, message: 'Please select the type!' }]}>
                    <Select>
                        <Select.Option value="folder">Folder</Select.Option>
                        <Select.Option value="file">File</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item name="file_name" label="Folder Name" rules={[{ required: true, message: 'Please input the folder name!' }]}>
                    <Input />
                </Form.Item>
                {/* <Form.Item name="parent_id" label="Parent ID">
                    <Input />
                </Form.Item> */}

            </Form>
        </Modal>
    </>

}




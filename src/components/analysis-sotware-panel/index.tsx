import { FC, memo, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { Button, Col, Drawer, Input, Row, Space, Table, TableProps, Image, Form, Select, Spin, Modal, Tabs, Typography, message, Empty, Collapse, Card, Popover, Flex, Popconfirm, Tooltip } from "antd"
import { useOutletContext, useParams } from "react-router"
import ResultList from '@/components/result-list'
// import AnalysisForm from "../analysis-form"
import SampleAnalysisResult from '../sample-analysis-result'
import React from "react"

import FormJsonComp from "../form-components"
import AnalysisList from '../analysis-list'
import { GroupSelectAssayButton, BaseSelect } from '@/components/form-components'
import AnalysisForm from '../analysis-form'
import PipelineMonitor from '@/components/pipeline-monitor'
import { listAnalysisFiles } from '@/api/analysis-software'
import { useSelector } from "react-redux"
import BioDatabaseForm from "@/components/bio-database-form"
import { CloseCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons"
import SortTable from "@/components/sort-table"
import Markdown from "../markdown"
import Item from "antd/es/list/Item"
import CreateOrUpdateParsms from "../edit-params/components/create-or-update-parsms"
type AnalysisFile = {
    name: string,
    label: string
}
type AnalysisSoftware = {
    inputFile?: AnalysisFile[],
    outputFile?: any[],
    relation_id?: any,
    pipeline?: any,
    pipeline_id?: any,
    component_id?: any,
    parseAnalysisModule?: any,
    parseAnalysisResultModule?: any,
    databases?: any,
    software?: any,

    wrapAnalysisPipeline?: any,
    analysisPipline?: any,
    inputAnalysisMethod?: any,
    analysisMethod?: any,
    appendSampleColumns?: any,
    analysisType?: any,
    children?: any,
    cardExtra?: any,
    upstreamFormJson?: any,
    downstreamAnalysis?: any,
    operatePipeline?: any,
    label?: any,
    hiddenUpstreamAnalysis?: boolean
    component_type?: string
    description?: string
    componentLayout?: string
    component_name?: string
    name?: string
}

const AnalysisSoftwarePanel: FC<AnalysisSoftware> = ({
    inputFile,
    outputFile,
    pipeline,
    wrapAnalysisPipeline,
    analysisPipline,
    inputAnalysisMethod,
    analysisMethod,
    appendSampleColumns,
    analysisType = "nonSample",
    children,
    cardExtra,
    upstreamFormJson,
    downstreamAnalysis,
    operatePipeline,
    ...rest }) => {
    const { project } = useOutletContext<any>()

    // const getAnalsyisFiles = async () => {
    //     const analysisFileType: any = []
    //     analysisFileType.push({
    //         type: "input",
    //         names: inputFile.map(item => item.name)
    //     })
    //     analysisFileType.push({
    //         type: "output",
    //         names: outputFile.map(item => item.name)
    //     })
    //     console.log(analysisFileType)

    //     const typeMap: any = {};
    //     analysisFileType.forEach(({ names, ...rest }: any) => {
    //         names.forEach((value: any) => {
    //             typeMap[value] = rest;
    //         });
    //     });

    //     const analysisFileNames = analysisFileType.flatMap((it: any) => it.names)
    //     const data = await listAnalysisFiles({ project: project, analysisFileNames: analysisFileNames })
    //     const groupedData = data.reduce((acc: any, item: any) => {
    //         const analysisFileName = item.analysis_method;
    //         const key = typeMap[analysisFileName].type
    //         // if (!acc[key]) {
    //         //     acc[key] = [];
    //         // }
    //         if (!acc[key][analysisFileName]) {
    //             acc[key][analysisFileName] = [];
    //         }
    //         const { sample_key, id, sample_group, ...rest } = item
    //         // debugger

    //         acc[key][analysisFileName].push({
    //             label: sample_key,
    //             value: id,
    //             sample_group: sample_group ? sample_group : "no_group",
    //             sample_key: sample_key,
    //             id: id,
    //             ...rest
    //         });
    //         return acc;
    //     }, { input: {}, output: {} });
    //     console.log(groupedData)
    //     console.log(typeMap)

    // }

    useEffect(() => {
        // getAnalsyisFiles()
    }, [])

    const [record, setRecord] = useState<any>()

    const checkAvailable = (analysisMethod: any) => {
        return analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0
    }
    return <>

        <Row>
            <Col lg={24} sm={24} xs={24}>


                <UpstreamAnalysisInput
                    {...rest}
                    pipeline={pipeline}
                    record={record}
                    // software={{
                    //     component_id: rest.component_id
                    // }}
                    onClickItem={setRecord}
                    project={project}
                    operatePipeline={operatePipeline}
                    cardExtra={cardExtra}
                    // wrapAnalysisPipeline={wrapAnalysisPipeline}
                    upstreamFormJson={upstreamFormJson}
                    analysisPipline={analysisPipline}
                    analysisMethod={analysisMethod}
                    inputAnalysisMethod={inputFile}></UpstreamAnalysisInput>

                {/* {checkAvailable(inputFile) ? <>

                </> : <>


                    <Flex justify="center" style={{ margin: "2rem" }} gap={"small"}>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            operatePipeline.openModal("modalC", {
                                data: undefined,
                                structure: {
                                    relation_type: "software_input_file", 
                                    parent_component_id: rest.component_id,
                                    component_type: "file"
                                }
                            })
                        }}>New File</Button>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            operatePipeline.openModal("modalA", {
                                data: undefined,
                                pipelineStructure: {
                                    relation_type: "software_input_file", 
                                    parent_component_id: rest.component_id,
                                }
                            })
                        }}>Add File</Button>
                    </Flex>
                </>} */}


                {checkAvailable(outputFile) && <>
                    <Collapse
                        // activeKey={collapseActiveKey}
                        style={{ marginTop: "1rem" }}
                        // defaultActiveKey={['1']}
                        size="small"
                        items={[
                            {
                                key: '1',
                                label: `Output File  (${rest?.name})`,
                                children: <>
                                    <UpstreamAnalysisOutput
                                        {...rest}
                                        pipeline={pipeline}

                                        software={{
                                            pipeline_id: rest.pipeline_id,
                                            component_id: rest.component_id
                                        }}

                                        children={children}
                                        onClickItem={setRecord}
                                        downstreamAnalysis={downstreamAnalysis}
                                        operatePipeline={operatePipeline}
                                        project={project}
                                        analysisType={analysisType}
                                        analysisMethod={outputFile}
                                        appendSampleColumns={appendSampleColumns}></UpstreamAnalysisOutput>
                                    {/* {checkAvailable(outputFile) ?
                                    : <> */}
                                    {/* {wrapAnalysisPipeline != analysisPipline &&
                            */}
                                    {/* <Flex justify="center" style={{ margin: "2rem" }} gap={"small"}>
                                            <Button size="small" color="cyan" variant="solid" onClick={() => {
                                                operatePipeline.openModal("modalC", {
                                                    data: undefined,
                                                    structure: {
                                                        relation_type: "software_output_file", //"software_input_file",
                                                        parent_component_id: rest.component_id,
                                                        // pipeline_id: pipeline.component_id,
                                                        component_type: "file"
                                                    }
                                                })
                                            }}>New File</Button>
                                            <Button size="small" color="cyan" variant="solid" onClick={() => {
                                                operatePipeline.openModal("modalA", {
                                                    data: undefined,
                                                    pipelineStructure: {
                                                        relation_type: "software_output_file", //"software_input_file",
                                                        parent_component_id: rest.component_id,
                                                        // pipeline_id: pipeline.component_id
                                                    }
                                                })
                                            }}>Add File</Button>
                                        </Flex> */}
                                    {/* </>} */}
                                </>
                            },

                        ]}
                    >
                    </Collapse>
                </>}



                {/* <div style={{ marginBottom: "1rem" }}></div> */}



            </Col>
            {/* <Col lg={5} sm={24} xs={24} style={{ paddingLeft: "1rem" }}>



                <div style={{ marginBottom: "1rem" }}></div>
                <Card title={`介绍 - ${rest.component_type}`} size="small">
            
                </Card>
            </Col > */}


        </Row >
    </>
}

export default AnalysisSoftwarePanel


export const CreateAnalysisComp: FC<any> = ({ pipeline, operatePipeline, markdown, analysisPipline, upstreamFormJson, inputFile, onClickItem, cardExtra, ...rest }) => {
    const [upstreamForm] = Form.useForm();
    const [resultTableList, setResultTableList] = useState<any>()
    const [messageApi, contextHolder] = message.useMessage();
    // const [loading, setLoading] = useState<boolean>(false)
    const formId = Form.useWatch((values) => values?.analysis_id, upstreamForm);
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>(analysisMethod[0].value[0])
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>(analysisPipline ? analysisPipline : "")
    // const [activeTabKey, setActiveTabKey] = useState<any>()
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()
    // const [analysisParams, setAnalysisParams] = useState<any>()
    const [modal, modalContextHolder] = Modal.useModal();
    const [inputFileList, setInputFileList] = useState<any>([])
    const { project } = useOutletContext<any>()

    useEffect(() => {
        if (inputFile) {
            const inputFileList = inputFile.map((item: any) => {
                if (item.component_id in rest) {
                    const replaceData = rest[item.component_id]
                    return {
                        ...item,
                        ...replaceData
                    }
                }
                return item
            })
            setInputFileList(inputFileList)

        }
    }, [inputFile])

    // const {    setPipelineStructure,setOperateOpen,setPipelineRecord,datelePipeline} = operatePipeline
    const tableRef = useRef<any>(null)

    const buildRequestParams = () => {
        let dataComponentIds: any = []
        if (inputFile) {
            dataComponentIds = inputFile.map((item: any) => item.component_id)

        }
        const requestParams = {
            // ...values,
            project: project,
            // inputFormJson: inputAnalysisMethod,
            // analysis_pipline: analysisPipline,
            // parse_analysis_module: rest.parse_analysis_module,
            component_id: rest.component_id,
            data_component_ids: JSON.stringify(dataComponentIds),
            component_parent_ids_map: componentParentIdsMap,
            workflow_id: rest.workflow_id ?? rest.relation_id,

        }
        return requestParams

    }

    const checkAvailable = (analysisMethod: any) => {
        return analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0
    }

    const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})
    return <>
        {contextHolder}
        {modalContextHolder}


        {!rest?.hiddenUpstreamAnalysis && <>



            <div style={{ marginBottom: "1rem" }}></div>

            <>

                {/* {JSON.stringify(componentParentIdsMap)} */}

                {checkAvailable(inputFile) ? <ResultList
                    {...rest}
                    componentParentIdsMap={componentParentIdsMap}
                    setComponentParentIdsMap={setComponentParentIdsMap}
                    pipeline={pipeline}
                    software={rest}
                    // currentAnalysisMethod={currentAnalysisMethod}
                    // setCurrentAnalysisMethod={setCurrentAnalysisMethod}
                    operatePipeline={operatePipeline}
                    relationType="software_input_file"
                    cardExtra={cardExtra}
                    title={`Input File ${inputFile.length > 0 ? "" : inputFile.map((it: any) => it.label)}`}
                    // activeTabKey={activeTabKey}
                    // setActiveTabKey={setActiveTabKey}
                    shouldTrigger={true}
                    analysisType={"sample"}
                    analysisMethod={inputFile}
                    setResultTableList={setResultTableList}></ResultList> : <>


                </>
                }



                <div style={{ maxWidth: "40rem", margin: "0 auto" }}>
                    {rest.component_id ?
                        <CreateOrUpdateParsms
                            // analysisResultId={analysisResultId}
                            form={upstreamForm}
                            requestParam={buildRequestParams()}
                            dataMap={resultTableList ? resultTableList : {}}
                            formJson={rest.formJson}
                            databases={rest.databases}
                            callback={() => {
                                if (tableRef.current) {
                                    tableRef.current.reload()
                                }
                            }} ></CreateOrUpdateParsms> :
                        <Empty description="Please select a script!"></Empty>

                    }
                </div>




            </>

            {/* <div style={{ marginBottom: "1rem" }}></div>

            <AnalysisList
                ref={tableRef}
                project={project}
                relation_id={rest?.relation_id}
            ></AnalysisList>

            <div style={{ marginBottom: "1rem" }}></div> */}
        </>}
    </>
}



export const UpstreamAnalysisInput: FC<any> = ({ record, pipeline, operatePipeline, project, markdown, analysisPipline, upstreamFormJson, inputAnalysisMethod, onClickItem, cardExtra, ...rest }) => {
    const [upstreamForm] = Form.useForm();
    const [resultTableList, setResultTableList] = useState<any>()
    const [messageApi, contextHolder] = message.useMessage();
    // const [loading, setLoading] = useState<boolean>(false)
    const formId = Form.useWatch((values) => values?.analysis_id, upstreamForm);
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>(analysisMethod[0].value[0])
    // const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>(analysisPipline ? analysisPipline : "")
    const [activeTabKey, setActiveTabKey] = useState<any>()
    const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()
    // const [analysisParams, setAnalysisParams] = useState<any>()
    const [modal, modalContextHolder] = Modal.useModal();
    const [inputFileList, setInputFileList] = useState<any>([])

    useEffect(() => {
        if (inputAnalysisMethod) {
            const inputFileList = inputAnalysisMethod.map((item: any) => {
                if (item.component_id in rest) {
                    const replaceData = rest[item.component_id]
                    return {
                        ...item,
                        ...replaceData
                    }
                }
                return item
            })
            setInputFileList(inputFileList)

        }
    }, [inputAnalysisMethod])

    // const {    setPipelineStructure,setOperateOpen,setPipelineRecord,datelePipeline} = operatePipeline
    const tableRef = useRef<any>(null)

    const buildRequestParams = () => {
        let dataComponentIds: any = []
        if (inputAnalysisMethod) {
            dataComponentIds = inputAnalysisMethod.map((item: any) => item.component_id)

        }
        const requestParams = {
            // ...values,
            project: project,
            // inputFormJson: inputAnalysisMethod,
            // analysis_pipline: analysisPipline,
            // parse_analysis_module: rest.parse_analysis_module,
            component_id: rest.component_id,
            data_component_ids: JSON.stringify(dataComponentIds),
            component_parent_ids_map: componentParentIdsMap,
            relation_id: rest.relation_id,
            // pipeline_id: pipeline.component_id
            // parse_analysis_result_module: rest.parseAnalysisResultModule
        }
        return requestParams

    }
    // const saveUpstreamAnalysis = async (save: any) => {
    //     const values = await upstreamForm.validateFields()
    //     const requestParams = getrRequestParams(values)
    //     setLoading(true)
    //     try {
    //         const resp: any = await axios.post(`/fast-api/analysis-controller?save=${save}`, requestParams)
    //         // setFilePlot(resp.data)
    //         // setAnalysisParams(resp.data)
    //         console.log(resp)

    //         if (save) {
    //             messageApi.success("执行成功!")
    //             if (tableRef.current) {
    //                 tableRef.current.reload()
    //             }
    //         } else {
    //             operatePipeline.openModal("modalF", resp.data)
    //         }
    //     } catch (error: any) {
    //         console.log(error)
    //         if (error.response?.data) {
    //             messageApi.error(error.response.data.detail)
    //         }
    //     }
    //     setLoading(false)
    // }
    // const host_genome_index = [
    //     {
    //         label: "人类",
    //         value: "/data/metagenome_data/bowtie2_index/human/human38"
    //     }, {
    //         label: "小鼠",
    //         value: "/data/databases/mouse/bowtie2/Mus_musculus.GRCm39.dna_sm.toplevel.fa"
    //     }
    // ]

    // const dataMap: any = {
    //     "host_genome_index": host_genome_index
    // }
    const checkAvailable = (analysisMethod: any) => {
        return analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0
    }

    const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})
    return <>
        {/* {JSON.stringify(software)} */}
        {contextHolder}
        {modalContextHolder}


        {!rest?.hiddenUpstreamAnalysis && <>



            <div style={{ marginBottom: "1rem" }}></div>
            {/* <Form form={upstreamForm}> */}
            {/* {JSON.stringify(rest)} */}
            <Collapse
                style={{ marginTop: "1rem" }}
                size="small"
                items={[
                    {
                        key: '1',
                        label: `Input File (${rest.name})`,
                        children: <>

                            {/* {JSON.stringify(componentParentIdsMap)} */}

                            {checkAvailable(inputAnalysisMethod) ? <ResultList
                                {...rest}
                                componentParentIdsMap={componentParentIdsMap}
                                setComponentParentIdsMap={setComponentParentIdsMap}
                                pipeline={pipeline}
                                software={rest}
                                currentAnalysisMethod={currentAnalysisMethod}
                                setCurrentAnalysisMethod={setCurrentAnalysisMethod}
                                operatePipeline={operatePipeline}
                                relationType="software_input_file"
                                cardExtra={cardExtra}
                                title={`Input File ${inputAnalysisMethod.length > 0 ? "" : inputAnalysisMethod.map((it: any) => it.label)}`}
                                activeTabKey={activeTabKey}
                                setActiveTabKey={setActiveTabKey}
                                shouldTrigger={true}
                                analysisType={"sample"}
                                analysisMethod={inputAnalysisMethod}
                                setResultTableList={setResultTableList}></ResultList> : <>
                                {/* 
                                {!rest?.disableInputFile && <>
                                    <Flex justify="center" style={{ margin: "2rem" }} gap={"small"}>
                                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                                            operatePipeline.openModal("modalC", {
                                                data: undefined,
                                                structure: {
                                                    relation_type: "software_input_file",
                                                    parent_component_id: rest.component_id,
                                                    component_type: "file"
                                                }
                                            })
                                        }}>New File</Button>
                                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                                            operatePipeline.openModal("modalA", {
                                                data: undefined,
                                                pipelineStructure: {
                                                    relation_type: "software_input_file",
                                                    parent_component_id: rest.component_id,
                                                }
                                            })
                                        }}>Add File</Button>
                                    </Flex>
                                </>} */}

                            </>
                            }


                            {/* {JSON.stringify(inputFileList)} */}
                            {/* <Spin spinning={loading}> */}

                            <div style={{ maxWidth: "40rem", margin: "0 auto" }}>
                                {rest.component_id ?
                                    <CreateOrUpdateParsms
                                        // analysisResultId={analysisResultId}
                                        form={upstreamForm}
                                        requestParam={buildRequestParams()}
                                        dataMap={resultTableList ? resultTableList : {}}
                                        formJson={rest.formJson}
                                        databases={rest.databases}
                                        callback={() => {
                                            if (tableRef.current) {
                                                tableRef.current.reload()
                                            }
                                        }} ></CreateOrUpdateParsms> :
                                    <Empty description="Please select a script!"></Empty>

                                }
                            </div>


                            {/* {!rest?.disableGroupField && <>
                                    <FormJsonComp formJson={[{
                                        "name": "group_field",
                                        "label": "Group Field",
                                        "rules": [
                                            {
                                                "required": true,
                                                "message": "This field cannot be empty!"
                                            }
                                        ],
                                        "type": "GroupFieldSelect"
                                    }]} dataMap={[]}></FormJsonComp>

                                </>} */}


                            {/* {rest?.reInputFile ? <FormJsonComp formJson={rest?.reInputFile} dataMap={resultTableList}></FormJsonComp> :
                                    <FormJsonComp formJson={inputFileList} dataMap={resultTableList}></FormJsonComp>} */}

                            {/* {JSON.stringify(inputFileList)} */}
                            {/* <BioDatabaseForm openModal={() => operatePipeline.openModal("modalE", rest.databases)} formJson={rest.databases}></BioDatabaseForm> */}


                            {/* {upstreamFormJson &&
                                    <FormJsonComp formJson={upstreamFormJson} dataMap={dataMap}></FormJsonComp>
                                }
                                {rest?.formJson &&
                                    <FormJsonComp formJson={rest?.formJson} dataMap={dataMap}></FormJsonComp>
                                } */}
                            {/* initialValue={`${rest.name}`}  */}
                            {/* <Form.Item name={"analysis_name"} label={"Analysis Name"} rules={[{ required: true, message: '该字段不能为空!' }]}>
                                    <Input></Input>
                                </Form.Item> */}

                            {/* <Flex gap={"small"}>
                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        saveUpstreamAnalysis(false)

                                    }}>View Parameters                                        </Button>

                                    <Button size="small" color="cyan" variant="solid" onClick={() => saveUpstreamAnalysis(true)}>{formId ? <>Update Analysis</> : <>Save  Analysis</>}</Button>
                                    {formId && <Button size="small" color="cyan" variant="solid" onClick={() => upstreamForm.setFieldValue("analysis_id", undefined)}>Cancel Update</Button>}

                                </Flex> */}
                            {/* <hr />
                            
                            <hr /> */}
                            {/* <Collapse ghost items={[
                                    {
                                        key: "1",
                                        label: "More",
                                        children: <>
                                            <Form.Item noStyle shouldUpdate>
                                                {() => (
                                                    <Typography>
                                                        <pre>{JSON.stringify(getrRequestParams(upstreamForm.getFieldsValue()), null, 2)}</pre>
                                                    </Typography>
                                                )}
                                            </Form.Item>
                                        </>
                                    }
                                ]} /> */}


                            {/* </Spin> */}

                        </>
                    },

                ]}
            >
            </Collapse>

            {/* </Form> */}
            <div style={{ marginBottom: "1rem" }}></div>




            <AnalysisList
                ref={tableRef}
                project={project}
                relation_id={rest?.relation_id}
            // component_id={rest?.component_id}
            ></AnalysisList>

            <div style={{ marginBottom: "1rem" }}></div>
        </>}
    </>
}






export const UpstreamAnalysisOutput: FC<any> = (rest) => {
    const { pipeline, component_id, component_type, componentLayout, operatePipeline, children, project, onClickItem, analysisType, analysisMethod, appendSampleColumns, script } = rest
    const [form] = Form.useForm();

    // const [loading, setLoading] = useState(false)
    // const [data, setData] = useState<any>()
    const [record, setRecord] = useState<any>()
    const [filePlot, setFilePlot] = useState<any>()
    const [plotLoading, setPlotLoading] = useState<boolean>(false)

    const [formDom, setFormDom] = useState<any>()
    const [formJson, setFormJson] = useState<any>()


    // const [htmlUrl, setHtmlUrl_] = useState<any>()
    const [params, setParams] = useState<any>()
    // const [tableDesc, setTableDesc] = useState<any>()
    const [downstreamData, setDownstreamData] = useState<any>()

    const [resultTableList, setResultTableList] = useState<any>([])
    const [saveAnalysisMethod, setSaveAnalysisMethod] = useState<any>()
    const [collapseActiveKey, setCollapseActiveKey] = useState<any>("1")
    const [activeTabKey, setActiveTabKey] = useState<any>()
    const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()

    const [sampleGroupJSON, setSampleGroupJSON] = useState<any>()
    const [btnName, setBtnName] = useState<any>()
    const [origin, setOrigin] = useState<any>(false)

    const tableRef = useRef<any>(null)


    const [sampleGroupApI, setSampleGroupApI] = useState<any>(false)
    const analysis_id = Form.useWatch((values: any) => values?.analysis_id, form);



    useEffect(() => {
        if (downstreamData && currentAnalysisMethod?.downstreamAnalysis) {
            const findDownstreamData = currentAnalysisMethod?.downstreamAnalysis.find((item: any) => item.component_id == downstreamData.component_id)
            // console.log("1111",findDownstreamData)
            // setDownstreamData(findDownstreamData)
            plot(findDownstreamData)
        }

    }, [JSON.stringify(currentAnalysisMethod?.downstreamAnalysis)])


    const plot = async (data: any) => {
        let { origin = false, url, moduleName, params, paramsFun, formDom, formJson, saveAnalysisMethod, sampleSelectComp = false, sampleGroupJSON = true, sampleGroupApI = false, ...rest } = data
        cleanDom()
        setCollapseActiveKey("1")
        setDownstreamData(data)
        setFormDom(formDom)
        setParams(params)
        setSampleGroupApI(sampleGroupApI)
        setOrigin(origin)
        form.resetFields()
        form.setFieldValue("analysis_name", rest.component_name)
        // setBtnName(name)
        setFormJson(formJson)
        setSampleGroupJSON(sampleGroupJSON)
        // debugger
        // console.log(paramsFun)
        if (paramsFun) {
            paramsFun = eval(paramsFun)
            params = paramsFun(record)
            console.log(params)
            setParams(params)
        }

        if (saveAnalysisMethod) {

            setSaveAnalysisMethod(saveAnalysisMethod)
        }

        if (origin) {
            const resp: any = await axios.post(`/fast-api/file-parse-plot/${moduleName}`, {
                ...params,
                is_save_analysis_result: false,
                origin: true
            })
            console.log(resp)
            setFilePlot(resp.data)
            // await runPlot({ moduleName: moduleName, params: params })
        }





    }

    const cleanDom = () => {
        setFormDom(undefined)
        setFilePlot(undefined)
        // setHtmlUrl(undefined)
        setDownstreamData(undefined)
        setSaveAnalysisMethod(undefined)
    }

    const getScript = (item: any) => {
        const { name, analysisType, ...rest } = item

        if (record && analysisType == 'one') {
            return <Button size="small" color="purple" variant={downstreamData?.component_id == rest.component_id ? "solid" : "filled"} onClick={() => plot({ ...rest })}>{rest.component_name}({record.sample_name})</Button>
        } else {
            return <Button size="small" color="primary" variant={downstreamData?.component_id == rest.component_id ? "solid" : "filled"} onClick={() => plot({ ...rest })}>{rest.component_name}</Button>

        }

    }
    // const [componentIds, setComponentIds] = useState<any>()
    // useEffect(() => {
    //     const downstreamAnalysisList = analysisMethod.filter((item: any) => item.downstreamAnalysis).map((item: any) => item.downstreamAnalysis).flat()

    //     console.log(downstreamAnalysisList)
    //     const componentIds = downstreamAnalysisList.map((item: any) => item.component_id)
    //     if (componentIds.length > 0) {
    //         setComponentIds(componentIds)

    //     }
    // }, [])
    // useEffect(() => {
    //     if (script) {
    //         plot({ ...script, name: script.name })

    //         setComponentIds([script.component_id])
    //     }
    // }, [script])


    const [analysisResultId, setAnalysisResultId] = useState<any>()
    const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})

    return <>

        {analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0 && <>
            <ResultList
                {...rest}
                componentParentIdsMap={componentParentIdsMap}
                setComponentParentIdsMap={setComponentParentIdsMap}
                onChangeAnalysisResultId={setAnalysisResultId}
                pipeline={pipeline}
                software={rest}
                currentAnalysisMethod={currentAnalysisMethod}
                setCurrentAnalysisMethod={setCurrentAnalysisMethod}
                operatePipeline={operatePipeline}
                relationType="software_output_file"
                title={`Output File ${analysisMethod.length > 0 ? "" : analysisMethod.map((it: any) => it.name)}`}
                appendSampleColumns={appendSampleColumns}
                activeTabKey={activeTabKey}
                setActiveTabKey={setActiveTabKey}
                cleanDom={cleanDom}
                analysisType={"sample"}
                analysisMethod={analysisMethod}
                setResultTableList={setResultTableList}
                setRecord={(data: any) => { setRecord(data) }}
            ></ResultList>
        </>}
        {/* {(!script && currentAnalysisMethod) && <Flex gap={"small"} justify="center" style={{ margin: "2rem" }}>
            <Button size="small" color="cyan" variant="solid" onClick={() => {
                operatePipeline.openModal("modalC", {
                    data: undefined,
                    structure: {
                        relation_type: "file_script",
                        parent_component_id: currentAnalysisMethod?.component_id,
                        component_type: "script"
                    }
                })
            }}>New Script ({currentAnalysisMethod?.component_name})</Button>
            <Button size="small" color="cyan" variant="solid" onClick={() => {
                operatePipeline.openModal("modalA", {
                    data: undefined,
                    pipelineStructure: {
                        relation_type: "file_script",
                        parent_component_id: currentAnalysisMethod?.component_id,
                    }
                })

            }}>Add Script ({currentAnalysisMethod.component_name})</Button>


        </Flex>} */}


    </>
}


export const ScriptAnalysis: FC<any> = (rest) => {
    const { pipeline, component_id, component_type, componentLayout, operatePipeline, children, project, onClickItem, analysisType, analysisMethod, appendSampleColumns, script } = rest
    const [form] = Form.useForm();

    // const [loading, setLoading] = useState(false)
    // const [data, setData] = useState<any>()
    const [record, setRecord] = useState<any>()
    const [filePlot, setFilePlot] = useState<any>()
    const [plotLoading, setPlotLoading] = useState<boolean>(false)

    const [formDom, setFormDom] = useState<any>()
    const [formJson, setFormJson] = useState<any>()


    // const [htmlUrl, setHtmlUrl_] = useState<any>()
    const [params, setParams] = useState<any>()
    // const [tableDesc, setTableDesc] = useState<any>()
    const [downstreamData, setDownstreamData] = useState<any>()

    const [resultTableList, setResultTableList] = useState<any>([])
    const [saveAnalysisMethod, setSaveAnalysisMethod] = useState<any>()
    const [collapseActiveKey, setCollapseActiveKey] = useState<any>("1")
    const [activeTabKey, setActiveTabKey] = useState<any>()
    const [currentAnalysisMethod, setCurrentAnalysisMethod] = useState<any>()

    const [sampleGroupJSON, setSampleGroupJSON] = useState<any>()
    const [btnName, setBtnName] = useState<any>()
    const [origin, setOrigin] = useState<any>(false)

    const tableRef = useRef<any>(null)


    const [sampleGroupApI, setSampleGroupApI] = useState<any>(false)
    const analysis_id = Form.useWatch((values: any) => values?.analysis_id, form);



    useEffect(() => {
        if (downstreamData && currentAnalysisMethod?.downstreamAnalysis) {
            const findDownstreamData = currentAnalysisMethod?.downstreamAnalysis.find((item: any) => item.component_id == downstreamData.component_id)
            // console.log("1111",findDownstreamData)
            // setDownstreamData(findDownstreamData)
            plot(findDownstreamData)
        }

    }, [JSON.stringify(currentAnalysisMethod?.downstreamAnalysis)])


    const plot = async (data: any) => {
        let { origin = false, url, moduleName, params, paramsFun, formDom, formJson, saveAnalysisMethod, sampleSelectComp = false, sampleGroupJSON = true, sampleGroupApI = false, ...rest } = data
        cleanDom()
        setCollapseActiveKey("1")
        setDownstreamData(data)
        setFormDom(formDom)
        setParams(params)
        setSampleGroupApI(sampleGroupApI)
        setOrigin(origin)
        form.resetFields()
        form.setFieldValue("analysis_name", rest.component_name)
        // setBtnName(name)
        setFormJson(formJson)
        setSampleGroupJSON(sampleGroupJSON)
        // debugger
        // console.log(paramsFun)
        if (paramsFun) {
            paramsFun = eval(paramsFun)
            params = paramsFun(record)
            console.log(params)
            setParams(params)
        }

        if (saveAnalysisMethod) {

            setSaveAnalysisMethod(saveAnalysisMethod)
        }

        if (origin) {
            const resp: any = await axios.post(`/fast-api/file-parse-plot/${moduleName}`, {
                ...params,
                is_save_analysis_result: false,
                origin: true
            })
            console.log(resp)
            setFilePlot(resp.data)
            // await runPlot({ moduleName: moduleName, params: params })
        }





    }

    const cleanDom = () => {
        setFormDom(undefined)
        setFilePlot(undefined)
        // setHtmlUrl(undefined)
        setDownstreamData(undefined)
        setSaveAnalysisMethod(undefined)
    }

    const getScript = (item: any) => {
        const { name, analysisType, ...rest } = item

        if (record && analysisType == 'one') {
            return <Button size="small" color="purple" variant={downstreamData?.component_id == rest.component_id ? "solid" : "filled"} onClick={() => plot({ ...rest })}>{rest.component_name}({record.sample_name})</Button>
        } else {
            return <Button size="small" color="primary" variant={downstreamData?.component_id == rest.component_id ? "solid" : "filled"} onClick={() => plot({ ...rest })}>{rest.component_name}</Button>

        }

    }
    const [componentIds, setComponentIds] = useState<any>()
    useEffect(() => {
        const downstreamAnalysisList = analysisMethod.filter((item: any) => item.downstreamAnalysis).map((item: any) => item.downstreamAnalysis).flat()

        console.log(downstreamAnalysisList)
        // if (currentAnalysisMethod?.downstreamAnalysis) {
        const componentIds = downstreamAnalysisList.map((item: any) => item.component_id)
        if (componentIds.length > 0) {
            setComponentIds(componentIds)

        }
        // }
    }, [])
    useEffect(() => {
        if (script) {
            plot({ ...script, name: script.name })
            // const componentIds = analysisMethod.map((item: any) => item.component_id)
            // setComponentIds(componentIds)
            setComponentIds([script.component_id])
        }
    }, [script])


    const [analysisResultId, setAnalysisResultId] = useState<any>()
    const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})

    return <>




        <Flex wrap style={{ marginBottom: "1rem" }} gap={"small"}>
            {currentAnalysisMethod?.downstreamAnalysis && currentAnalysisMethod?.downstreamAnalysis.map((item: any, index: any) => {
                return <span key={index}>
                    {getScript(item)}

                </span>
            })}

            {/* 
                {downstreamData?.component_id && <CloseCircleOutlined onClick={() => {
                    setDownstreamData(undefined)
                }} />} */}
        </Flex>


        <div>
            {downstreamData && <>
                <Collapse
                    style={{ marginTop: "1rem" }}
                    // defaultActiveKey={['1']}
                    size="small"
                    items={[
                        {
                            key: '1',
                            label: <Tooltip title={<>
                                <ul>
                                    <li>software:{rest?.component_id}</li>
                                    <li>file:{currentAnalysisMethod?.component_id}</li>
                                    <li>script:{downstreamData?.component_id}</li>
                                </ul>
                            </>}>Input File {downstreamData ? `(${downstreamData.component_name})` : ""}{analysis_id ? `(${analysis_id})` : ""}</Tooltip>,
                            children: <>
                                {analysisMethod && Array.isArray(analysisMethod) && analysisMethod.length > 0 && <>
                                    <ResultList
                                        {...rest}
                                        componentParentIdsMap={componentParentIdsMap}
                                        setComponentParentIdsMap={setComponentParentIdsMap}
                                        onChangeAnalysisResultId={setAnalysisResultId}
                                        pipeline={pipeline}
                                        software={rest}
                                        currentAnalysisMethod={currentAnalysisMethod}
                                        setCurrentAnalysisMethod={setCurrentAnalysisMethod}
                                        operatePipeline={operatePipeline}
                                        relationType="software_output_file"
                                        title={`Output File ${analysisMethod.length > 0 ? "" : analysisMethod.map((it: any) => it.name)}`}
                                        appendSampleColumns={appendSampleColumns}
                                        activeTabKey={activeTabKey}
                                        setActiveTabKey={setActiveTabKey}
                                        cleanDom={cleanDom}
                                        analysisType={"sample"}
                                        analysisMethod={analysisMethod}
                                        setResultTableList={setResultTableList}
                                        setRecord={(data: any) => { setRecord(data) }}
                                    ></ResultList>
                                </>}

                                <Flex gap={"small"} wrap>
                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        operatePipeline.openModal("modalB", {
                                            // module_type: "py_plot",
                                            // file_type: "py",
                                            // module_name: downstreamData.moduleName,
                                            component_id: downstreamData.component_id,
                                            // module_dir: downstreamData.moduleDir
                                        })
                                    }}>Component Code</Button>
                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        operatePipeline.openModal("modalC", {
                                            data: downstreamData, structure: {
                                                component_type: "script",
                                            }
                                        })
                                    }}>Edit Script</Button>

                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        operatePipeline.openModal("modalA", {
                                            data: undefined,
                                            pipelineStructure: {
                                                relation_type: "parent_file_script",
                                                // pipeline_id: pipeline.component_id,
                                                component_id: downstreamData.component_id,
                                            }
                                        })

                                    }}>Add File</Button>


                                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                                        operatePipeline.openModal("modalA", {
                                            data: { relation_id: currentAnalysisMethod?.relation_id },
                                            pipelineStructure: {
                                                relation_type: "parent_file_script", //"software_input_file",
                                                component_id: downstreamData.component_id,
                                                // pipeline_id: pipeline.component_id
                                            }
                                        })
                                    }}>Update File</Button>


                                    {downstreamData.relation_id && <>

                                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                                            operatePipeline.openModal("modalA", {
                                                data: downstreamData,
                                                pipelineStructure: {
                                                    relation_type: "file_script",
                                                    // pipeline_id: downstreamData.component_id,

                                                }
                                            })

                                        }}>Replace Analysis</Button>
                                        <Popconfirm title="Are you sure to delete?" onConfirm={() => {
                                            operatePipeline.deletePipelineRelation(downstreamData.relation_id)
                                            setBtnName(undefined)
                                        }}>
                                            <Button size="small" color="danger" variant="solid" >Delete Analysis</Button>
                                        </Popconfirm>
                                    </>
                                    }

                                    <QuestionCircleOutlined onClick={() => {
                                        operatePipeline.openModal("descriptionModal", downstreamData.description)
                                    }} style={{ cursor: "pointer" }} />
                                </Flex>
                                <div style={{ marginBottom: "1rem" }}></div>


                                <AnalysisForm
                                    {...downstreamData}
                                    analysisResultId={analysisResultId}
                                    pipeline={pipeline}
                                    form={form}
                                    resultTableList={resultTableList}
                                    formJson={formJson}
                                    formDom={formDom}
                                    // activeTabKey={activeTabKey}
                                    sampleGroupApI={sampleGroupApI}
                                    // moduleName={moduleName}
                                    operatePipeline={operatePipeline}
                                    params={params}
                                    name={btnName}
                                    setPlotLoading={setPlotLoading}
                                    componentParentIdsMap={componentParentIdsMap} // component_parent_ids_map
                                    dataComponentIds={analysisMethod.map((item: any) => item.component_id)}
                                    inputAnalysisMethod={currentAnalysisMethod}
                                    saveAnalysisMethod={saveAnalysisMethod}
                                    project={project}
                                    setFilePlot={setFilePlot}
                                    callback={() => {
                                        if (tableRef.current) {
                                            tableRef.current.reload()
                                        }
                                    }}
                                    plotReloadTable={() => {
                                        if (tableRef.current) {
                                            tableRef.current.reload()
                                        }
                                    }}

                                ></AnalysisForm>
                            </>
                        },

                    ]}
                />
            </>}
        </div>
        <div style={{ marginBottom: "1rem" }}></div>
        {componentIds &&
            <AnalysisList
                ref={tableRef}
                project={project}
                component_ids={componentIds}
            ></AnalysisList>
        }


        <Collapse
            style={{ marginTop: "1rem" }}
            // defaultActiveKey={['1']}
            size="small"
            items={[
                {
                    key: '1',
                    label: "Output File",
                    children: <>
                        {/* {JSON.stringify(currentAnalysisMethod)} */}

                        <Flex justify="center" style={{ margin: "2rem" }} gap={"small"}>
                            {/* <Button size="small" color="cyan" variant="solid" onClick={() => {
                                operatePipeline.openModal("modalC", {
                                    data: undefined,
                                    structure: {
                                        relation_type: "script_file", //"software_input_file",
                                        parent_component_id: script.component_id,
                                        // pipeline_id: pipeline.component_id,
                                        component_type: "file"
                                    }
                                })
                            }}>New File</Button> */}
                            <Button size="small" color="cyan" variant="solid" onClick={() => {
                                operatePipeline.openModal("modalA", {
                                    data: { relation_id: currentAnalysisMethod?.relation_id },
                                    pipelineStructure: {
                                        relation_type: "script_file", //"software_input_file",
                                        parent_component_id: script.component_id,
                                        // pipeline_id: pipeline.component_id
                                    }
                                })
                            }}>Add Output File</Button>
                        </Flex>

                    </>
                },

            ]}
        />

    </>
}


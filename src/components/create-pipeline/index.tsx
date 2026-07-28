import { Button, Card, Collapse, Divider, Drawer, Flex, Form, Input, InputNumber, Modal, Popconfirm, Select, Skeleton, Space, Spin, Tabs, Typography, Upload, UploadFile, UploadProps } from "antd"
import TextArea from "antd/es/input/TextArea"
import axios from "axios"
import { FC, lazy, memo, Suspense, use, useEffect, useRef, useState } from "react"
import { listPipelineComponents as listPipelineComponentsApi } from '@/api/pipeline'
import { useModal } from "@/hooks/useModal"
import { MonacoEditor } from "../react-monaco-editor"
import { PlusOutlined } from '@ant-design/icons'




const PipelineSoftwareComponent: FC<any> = ({ components }) => {
    return <>
        <Form.Item name={"parent_component_id"} label="form_component">
            <Select showSearch options={components}></Select>
        </Form.Item>
        <Form.Item name={"component_id"} label="to_component_id">
            <Select showSearch options={components}></Select>
        </Form.Item>
    </>
}


const UploadRelationComp: FC<any> = ({ value, onChange, relation_id }) => {
    const [fileList, setFileList] = useState<any>([])
    const { baseURL } = useSelector((state: any) => state.user)

    const handleChange: UploadProps['onChange'] = ({ file, fileList }) => {
        // console.log()
        setFileList([file]);
        if (file.status === 'done') {
            console.log(file)
            onChange(`${file.response.url}`)

        }

        // console.log(fileList)
    }

    useEffect(() => {
        if (value) {
            setFileList([{
                uid: '-1',
                name: 'image.png',
                status: 'done',
                url: `${baseURL}${value}`
            }])
        }

    }, [value])
    return <>
        {/* {value} */}
        <Upload
            onChange={handleChange}
            fileList={fileList}
            action={`${baseURL}/brave-api/component/relation-img-upload/${relation_id}`} listType="picture-card"  >
            <button
                style={{ color: 'inherit', cursor: 'inherit', border: 0, background: 'none' }}
                type="button"
            >
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>Upload</div>
            </button>
        </Upload>
    </>
}

const UploadComp: FC<any> = ({ value, onChange, component_id }) => {
    const [fileList, setFileList] = useState<any>([])
    const { baseURL } = useSelector((state: any) => state.user)

    const handleChange: UploadProps['onChange'] = ({ file, fileList }) => {
        // console.log()
        setFileList([file]);
        if (file.status === 'done') {
            console.log(file)
            onChange(`${file.response.url}`)

        }

        // console.log(fileList)
    }

    useEffect(() => {
        if (value) {
            setFileList([{
                uid: '-1',
                name: 'image.png',
                status: 'done',
                url: `${baseURL}${value}`
            }])
        }

    }, [value])
    return <>
        {/* {value} */}
        <Upload
            onChange={handleChange}
            fileList={fileList}
            action={`${baseURL}/brave-api/component/upload/${component_id}`} listType="picture-card"  >
            <button
                style={{ color: 'inherit', cursor: 'inherit', border: 0, background: 'none' }}
                type="button"
            >
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>Upload</div>
            </button>
        </Upload>
    </>
}

const AddFileComponentRelation: FC<any> = ({ data, form, components }) => {
    return <>

        <Form.Item name={"parent_component_id"} label="File Component">
            <Select showSearch options={components}></Select>
        </Form.Item>

    </>
}
const DefaultComponentRelation: FC<any> = ({ data, form, components }) => {
    return <>

        <Form.Item name={"component_id"} label="Component">
            <Select showSearch options={components}></Select>
        </Form.Item>

    </>
}
const Tools: FC<any> = ({ components }) => {
    const [containers, setContainers] = useState<any>([])

    const loadData = async () => {
        const resp = await axios.get(`/container/list-all`)
        const opentions = resp.data.map((item: any) => ({ label: `${item.name}`, value: item.container_id }))
        setContainers(opentions)
    }


    useEffect(() => {
        loadData()

    }, [])
    return <>
        {/* <Form.Item name={"component_id"} label="Script" >
            <Select showSearch optionFilterProp="label" options={components?.scripts} ></Select>
        </Form.Item> */}
        {/* <Form.Item name={"container_id"} label="Container" rules={[{ required: true, message: 'Please select container!' }]}>
            <SelectContainer mode="none" containers={containers}></SelectContainer>
        </Form.Item> */}
        <Form.Item name={"input_component_ids"} label="Input File">
            <Select showSearch optionFilterProp="label" options={components?.files} mode="multiple"></Select>
        </Form.Item>
        <Form.Item name={"output_component_ids"} label="Output File">
            <Select showSearch optionFilterProp="label" options={components?.files} mode="multiple"></Select>
        </Form.Item>
        {/* prompt */}
        <Form.Item name={"prompt"} label="Prompt" >
            <TextArea rows={4}></TextArea>
        </Form.Item>
    </>
}
import { softwareTemplete, scriptTemplete, fileTemplete, INPUTS } from './templete'
import ContainerPage from "@/pages/container"
import { useSelector } from "react-redux"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ActionDispatcher } from "@/llmv2/dispatcher"
import { invoke } from "@/core/ui-system/invokeV2"
import { http } from "@/api/client/http"
const SoftwareContent: FC<any> = ({ data, form }) => {
    const [templete, setTemplete] = useState<any>()
    const [containers, setContainers] = useState<any>([])

    const loadData = async () => {
        const resp = await axios.get(`/container/list-all`)
        const opentions = resp.data.map((item: any) => ({ label: `${item.name}`, value: item.container_id }))
        setContainers(opentions)
    }
    useEffect(() => {
        loadData()
        if (!data?.componemt_id) {
            setTemplete(JSON.stringify(softwareTemplete, null, 2))
        }
    }, [])
    return <>
        <Form.Item name={"container_id"} label="Container" rules={[{ required: true, message: 'Please select container!' }]}>
            <SelectContainer mode="none" containers={containers}></SelectContainer>
        </Form.Item>
        <Form.Item name={"tools_container_id"} label="Tools Container Id" rules={[{ required: true, message: 'Please select container!' }]}>
            <SelectContainer mode="multiple" containers={containers}></SelectContainer>
        </Form.Item>
        {/* <Form.Item name={"sub_container_id"} label="Sub Container">
            <SelectContainer container={data?.sub_container}></SelectContainer>
        </Form.Item> */}
        <Form.Item name={"script_type"} label="Script Type" rules={[{ required: true, message: 'Please select script type!' }]}>
            <Select options={
                [{ label: "python", value: "python" },
                { label: "nextflow", value: "nextflow" },
                { label: "shell", value: "shell" },
                { label: "R", value: "r" }]}></Select>
        </Form.Item>
        <Form.Item name={"content"} label="content" rules={[{ required: true, message: 'Please input content!' }]}>
            <TextAreaComp templete={templete}></TextAreaComp>
        </Form.Item>
        {/* <Form.Item name={"component_id"} label="component_id">
            <Input></Input>
        </Form.Item> */}
    </>
}
const ScriptContent: FC<any> = ({ data, form }) => {
    // const [templete, setTemplete] = useState<any>()
    // const [containers, setContainers] = useState<any>([])

    // const loadData = async () => {
    //     const resp = await axios.get(`/container/list-all`)
    //     const opentions = resp.data.map((item: any) => ({ label: `${item.name}`, value: item.container_id }))
    //     setContainers(opentions)
    // }


    // useEffect(() => {
    //     // loadData()
    //     if (!data?.componemt_id) {
    //         // console.log(scriptTemplete)
    //         setTemplete(JSON.stringify(scriptTemplete, null, 2))
    //     }
    // }, [])
    return <>
        <Form.Item
            name={"container_template_id"}
            label="Container"
            rules={[{ required: true, message: 'Please select container!' }]}
            dependencies={["container_name"]}
            getValueProps={(value) => ({
                value: form.getFieldValue("container_name") || value,
            })}
        >
            {/* <SelectContainer mode="none" containers={containers}></SelectContainer> */}
            <Input
                readOnly
                placeholder="Click to select container template"
                onClick={async () => {
                    const selected = await invoke.containerTemplatePage
                        .openAsync({}, { title: "Select Container Template", width: "80%", footer: false })
                        .catch(() => undefined);
                    if (selected?.id) {
                        form.setFieldsValue({
                            container_template_id: selected.id,
                            container_name: selected.name,
                        });
                        await form.validateFields(["container_template_id"]);
                    }
                }}
            ></Input>
        </Form.Item>
        {/* <Form.Item name={"container_name"} hidden>
            <Input />
        </Form.Item> */}
        {/* <Form.Item name={"tools_container_id"} label="Tools Container Id" >
            <SelectContainer mode="multiple" containers={containers}></SelectContainer>
        </Form.Item> */}
        <Form.Item name={"script_type"} label="Script Type" rules={[{ required: true, message: 'Please select script type!' }]}>
            <Select options={
                [{ label: "python", value: "python" },
                { label: "nextflow", value: "nextflow" },
                { label: "shell", value: "shell" },
                 { label: "qmd", value: "qmd" },
                { label: "R", value: "r" }]}></Select>
        </Form.Item>
        <Form.Item  name={"io_schema"} label="io_schema">
            {/* <TextArea ></TextArea> */}
            <TextAreaComp templete={""}></TextAreaComp>
        </Form.Item>

                    

        <Form.Item name={"content"} label="content" >
            {/* <TextAreaComp templete={""}></TextAreaComp> */}
            <TextArea></TextArea>
        </Form.Item>




        {/* <Form.Item name={"component_id"} label="component_id">
            <Input></Input>
        </Form.Item> */}
    </>
}


const PreviewJsonForm: FC<any> = ({ value }) => {
    const message = useGlobalMessage()

    const [formJson, setFormJson] = useState<any>([])
    const [databases, setDatabases] = useState<any>([])

    const renderFormJson = () => {
        if (formJson.length > 0 || databases.length > 0) {
            setFormJson([])
            setDatabases([])
        } else {
            try {
                const data = JSON.parse(value)
                if (data?.formJson) {
                    setFormJson(data.formJson)
                    message.success("Render form json success!")
                }
                if (data?.databases) {
                    setDatabases(data.databases)
                }
            } catch (error) {
                message.error("Invalid JSON format!")
            }
        }

    }
    return <>
        <Button size="small" onClick={renderFormJson}>render</Button>

        <Suspense fallback={<Skeleton active />}>
            {(formJson.length > 0 || databases.length > 0) && <RenderFromJson
                formJson={formJson}
                databases={databases}
                dataMap={{}}
            ></RenderFromJson>}
        </Suspense>
    </>
}
const FileContent: FC<any> = ({ data, form, structure }) => {
    const [templete, setTemplete] = useState<any>()
    const [options, setOptions] = useState<any>([])
    const loadData = async () => {
        const resp = await listPipelineComponentsApi({
            component_type: "file",
        })
        const data = resp.data.map((item: any) => {
            return {
                label: `${item.component_name}(${item.component_id})`,
                value: item.component_id
            }

        })
        setOptions(data)
    }
    useEffect(() => {
        loadData()
        if (!data?.componemt_id) {
            setTemplete(JSON.stringify(fileTemplete, null, 2))
        }
    }, [])
    return <>
        {structure?.files && <Card style={{ maxHeight: "20rem", overflow: "auto", marginBottom: "1rem" }}>
            <Typography>
                <pre>{JSON.stringify(structure?.files, null, 2)}</pre>
            </Typography>
        </Card>}
        {/* <Form.Item name={"container_id"} label="Container">
            <SelectContainer container={data?.container}></SelectContainer>
        </Form.Item> */}
        <Form.Item name={"file_type"} label="File Type" rules={[{ required: true, message: 'Please select file type!' }]}>
            <Select options={
                [{ label: "collected", value: "collected" },
                { label: "individual", value: "individual" }]}></Select>
        </Form.Item>

        <Form.Item name={"component_ids"} label="Component Ids">
            <Select options={options} mode="multiple"></Select>
        </Form.Item>

        <Form.Item name={"content"} label="content" rules={[{ required: true, message: 'Please input content!' }]}>
            <TextAreaComp templete={templete}></TextAreaComp>
        </Form.Item>
        {/* <Form.Item name={"component_id"} label="component_id">
            <Input></Input>
        </Form.Item> */}
    </>
}
const SelectContainer: FC<any> = ({ value, onChange, mode, containers }) => {

    return <>
        <Select mode={mode} value={value} onChange={onChange} options={containers}></Select>
    </>
}
const SelectContainer2: FC<any> = ({ value, onChange, container: container_ }) => {
    const { modal, openModal, closeModal } = useModal()
    const [container, setContainer] = useState<any>(container_)
    return <>
        <Input value={container?.name} style={{ cursor: "pointer" }} onClick={() => openModal("modalA")}></Input>
        {/* {JSON.stringify(container)}
        {data?.container_image}{data?.container_name} */}
        <Modal footer={false} width={"50%"} title="Select container" open={modal.visible && modal.key == "modalA"} onClose={closeModal} onCancel={closeModal}>
            <ContainerPage rowSelection={{
                type: "radio",
                onChange: (selectedRowKeys: any, selectedRows: any) => {
                    // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
                    // setSelectedRowKey(selectedRowKeys)

                    if (selectedRows.length > 0) {
                        setContainer(selectedRows[0])
                        onChange(selectedRows[0].container_id)
                        closeModal()
                    }

                },
            }}></ContainerPage>
        </Modal>
    </>
}
const TextAreaContent: FC<any> = ({ data, form }) => {
    return <>
        <Form.Item name={"content"} label="content">
            <TextAreaComp ></TextAreaComp>
        </Form.Item>
        {/* <Form.Item name={"component_id"} label="component_id">
            <Input></Input>
        </Form.Item> */}
    </>
}
const RenderFromJson = lazy(() => import("@/components/edit-params/components/render-form-json"));
const TextAreaComp: FC<any> = ({ value, onChange, templete }) => {
    // const [data, setData] = useState<any>(JSON.stringify(value))
    const editorRef = useRef<any>(null)

    useEffect(() => {
        if (templete) {
            onChange(templete)
        }
    }, [])

    // useEffect(()=>{
    //     // setData(JSON.stringify(value))
    //     // editorRef.current.getValue()
    //     // onChange(editorRef.current.getValue())
    // },[editorRef.current])
    return <>
        {/* <TextArea rows={10} value={data} onChange={(e: any) => {
            setData(e.target.value)
            onChange(e.target.value)
            // console.log(e.target.value)
        }}></TextArea> */}
        {/* {templete} */}
        {/* {value} */}
        <MonacoEditor value={value} onChange={onChange} editorRef={editorRef} defaultLanguage="json" ></MonacoEditor>



        {/* <Button onClick={() => {
            setData(JSON.stringify(value, null, 2))
        }}>格式化</Button> */}
    </>
}

const WrapPipeline: FC<any> = ({ data, form }) => {
    // "content": {
    //     "name": "test",
    //     "analysisPipline": "reads-alignment-based-abundance-analysis",
    //     "parseAnalysisModule": "reads-alignment-based-abundance-analysis",
    //     "parseAnalysisResultModule": [
    //       {
    //         "module": "bowtie2_align",
    //         "dir": "bowtie2_align_metaphlan",
    //         "analysisMethod": "bowtie2_align_metaphlan"
    //       }
    //     ],
    //     "description": "使用reads基于marker gene的丰度分析",
    //     "tags": [
    //       "metaphlan",
    //       "bowtie2",
    //       "Alignment-based strategies"
    //     ],
    //     "img": "pipeline.jpg",
    //     "category": "metagenomics",
    //     "order": 1
    //   }
    const [containers, setContainers] = useState<any>([])

    const loadData = async () => {
        const resp = await axios.get(`/container/list-all`)
        const opentions = resp.data.map((item: any) => ({ label: `${item.name}`, value: item.container_id }))
        setContainers(opentions)
    }
    useEffect(() => {
        loadData()
    }, [])
    return <>
        {/* <Form.Item name={"pipeline_key"} label="pipeline_key">
            <Input disabled={data ? true : false}></Input>
        </Form.Item> */}
        {/* <Form.Item name={"namespace"} label="namespace">
            <NamespaceSelect />
        </Form.Item> */}
        {/* <Form.Item name={["content", "name"]} label="name">
            <Input></Input>
        </Form.Item> */}
        <Form.Item name={"script_type"} label="Script Type">
            <Select options={
                [{ label: "python", value: "python" },
                { label: "nextflow", value: "nextflow" },
                { label: "shell", value: "shell" },
                { label: "R", value: "R" }]}></Select>
        </Form.Item>
        {/* <Form.Item name={["content", "image"]} label="Image">
            <Input></Input>
        </Form.Item> */}
        <Form.Item name={"container_id"} label="Container">
            <SelectContainer mode="none" containers={containers}></SelectContainer>
        </Form.Item>
        {/* <Form.Item name={["content", "analysisPipline"]} label="analysisPipline">
            <Input></Input>
        </Form.Item> */}
        {/* <Form.Item name={["content", "parseAnalysisModule"]} label="parseAnalysisModule">
            <Input></Input>
        </Form.Item> */}
        {/* <Form.Item name={["content", "img"]} label="img">
            <Input></Input>
        </Form.Item> */}
        {/* <Form.Item name={["content", "category"]} label="category">
            <Input></Input>
        </Form.Item> */}
        {/* <Form.Item name={["content", "tags"]} label="tags">
            <Select
                mode="tags"
                style={{ width: '100%' }}
            />
        </Form.Item> */}
        {/* <Form.Item name={["content", "description"]} label="description">
            <TextArea></TextArea>
        </Form.Item> */}
        {/* <Typography>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </Typography> */}
        {/* <Form.Item name={"content"} label="content">
            <TextArea rows={10}></TextArea>
        </Form.Item> */}
        {/* <Form.Item name={"content"} label="content">
            <TextArea rows={10}></TextArea>
        </Form.Item> */}
        {/* {JSON.stringify(data)} */}
    </>
}

export const NamespaceSelect: FC<any> = ({ value, onChange, disabled }) => {
    const [namespace, setNamespace] = useState<any>([])
    // const { modal, openModal, closeModal } = useModal();
    const loadNamespace = async () => {
        const resp = await axios.get(`/list-namespace`)
        const data = resp.data
        setNamespace(data)
    }
    useEffect(() => {
        loadNamespace()
    }, [])
    return <>
        <Flex justify="space-between">
            {/* {JSON.stringify(namespace)} */}
            <Select
                placeholder="Please select namespace!"
                style={{ width: "100%" }} disabled={disabled} value={value} onChange={onChange} options={namespace.map((item: any) => ({ label: item.name, value: item.namespace_id }))}>
            </Select>
            {/* {modal.key == "namespaceOperation" && modal.visible ?
                <Button onClick={() => {
                    closeModal()
                }}>取消</Button>
                : <Button onClick={() => {
                    openModal("namespaceOperation", namespace)
                }}>新增</Button>} */}
        </Flex>
        {/* <NamespaceOperation style={{ marginTop: "0.5rem" }}
            visible={modal.key == "namespaceOperation" && modal.visible}
            callback={loadNamespace}
            onClose={closeModal}
            params={namespace} ></NamespaceOperation> */}
    </>
}

const NamespaceOperation: FC<any> = ({ visible, onClose, params, callback }) => {
    if (!visible) return null;
    const [namespace, setNamespace] = useState<any>()
    const [record, setRecord] = useState<any>()
    // const [form] = useForm()
    const saveNamespace = async () => {
        // const values = await form.validateFields()
        if (record) {
            await axios.post("/save-or-update-context", {
                name: namespace,
                type: "namespace",
                context_id: record.context_id
            })
        } else {
            await axios.post("/save-or-update-context", {
                name: namespace,
                type: "namespace"
            })
        }
        if (callback) {
            callback()
        }
        // onClose()
    }
    const deleteNamespace = async (context_id: any) => {
        await axios.delete(`/delete-namespace-by-context-id/${context_id}`)
        if (callback) {
            callback()
        }
    }


    return <Card title="新增namespace">
        {/* {JSON.stringify(params)} */}


    </Card>
}


const componentMap: any = {
    pipeline: WrapPipeline,
    // pipeline: WrapPipeline,
    software: SoftwareContent,
    file: FileContent,
    script: ScriptContent,
}
// const ComponentsRender = memo(({ component_type, data, form, structure }: any) => {
//     const Component = componentMap[component_type] || (() => <div>未知类型 {JSON.stringify(data)}</div>);
//     return <Component data={data} form={form} structure={structure}></Component>
// })
const ComponentsRender = ({ component_type, data, form, structure }: any) => {
    const Component = componentMap[component_type] || (() => <div>未知类型 {JSON.stringify(data)}</div>);
    return <Component data={data} form={form} structure={structure}></Component>
}
export const CreateOrUpdatePipelineComponent: FC<any> = ({ visible, onClose, params, callback }) => {
    if (!visible) return null;

    const { data, structure } = params

    return <>
        <Drawer
            // loading={loading}
            title={`${data ? "Update" : "Create"} Component(${structure?.component_type})`}
            // okText={data ? "Update" : "Create"}
            // onCancel={() => onClose()}
            // onOk={savePipeline}
            forceRender={true}

            open={visible}
            width={"50%"}
            extra={<>

            </>}
            onClose={() => onClose()}
        // onCancel={() => onClose()}
        >
            <CreateOrUpdatePipeline data={data} structure={structure} callback={() => {
                onClose()
                if (callback) {
                    callback()
                }

            }} />

        </Drawer>
    </>
}
export const CreateOrUpdatePipelineV2: FC<any> = ({ script_id, structure, callback }) => {
    // if (!visible) return null;

    // const { data, structure } = params
    const [form] = Form.useForm()
    const [component, setComponent] = useState<any>()
    const { namespace } = useSelector((state: any) => state.user);

    const [loading, setLoading] = useState<any>(false)

    const content = Form.useWatch((values: any) => values?.content, form);


    const getPipeleine = async (script_id: any) => {
        const resp = await http.get(`/find-script/${script_id}`)

        const data = resp.data
        // data['content'] = JSON.parse(data['content']) //JSON.stringify(JSON.parse(data['content']), null, 2)
        if (data['tags']) {
            data['tags'] = JSON.parse(data['tags'])
        }
        if (data["component_ids"]) {
            data["component_ids"] = JSON.parse(data["component_ids"])
        }
        if (data["tools_container_id"]) {
            data["tools_container_id"] = JSON.parse(data["tools_container_id"])
        }

        setComponent(data)
        console.log(data)
        if (structure.component_type == "pipeline") {
            data['content'] = JSON.parse(data['content'])
            form.setFieldsValue(data)
        } else {
            form.setFieldsValue(data)
        }

    }



    useEffect(() => {
        if (script_id) {
            getPipeleine(script_id)
        } else {
            setComponent({})
            form.resetFields()
        }
    }, [script_id])
    const getParams = (values: any) => {
        const params = {
            ...values,
            ...structure,

        }
        if (script_id) {
            // params['relation_id'] = pipelineRelation.relation_id
            // params['parent_component_id'] = pipelineRelation.parent_component_id
            params['id'] = script_id


        }


        return params
    }
    const getParamsFormat = (values: any) => {
        const params = getParams(values)
        if (typeof params['content'] == 'string') {
            try {
                params['content'] = JSON.parse(params['content'])

            } catch (error) {

            }
        }

        return params
    }
    const savePipeline = async () => {
        setLoading(true)
        const values = await form.validateFields()
        const params = getParams(values)
        if (typeof params['content'] != 'string') {
            params['content'] = JSON.stringify(params['content'])
        }
        if (typeof params['tags'] != 'string') {
            params['tags'] = JSON.stringify(params['tags'])
        }
        if (!params['content']) {
            params['content'] = "{}"
        }
        // for file component
        if (params["component_ids"]) {
            params["component_ids"] = JSON.stringify(params["component_ids"])
        }
        if (params["tools_container_id"]) {
            params["tools_container_id"] = JSON.stringify(params["tools_container_id"])
        }
        // if (data["relation_id"]) {
        //     params["relation_id"] = data["relation_id"]
        // }

        console.log(params)
        try {
            // const resp = await axios.post("/save-pipeline", params)
            const resp = await http.post(`/workflow/save-script`,params)
            
            console.log(resp)
            setLoading(false)
            if (callback) {
                callback()
                // await axios.get("/get-pipeline-v2/d9830ebd-240e-4758-adab-dd3a9d17e414")
            }


            const data = {
                action: "component.invoke",
                payload: {
                    category: "forms",
                    id: "analysis",
                    method: "reload",
                }
            }

            ActionDispatcher.dispatch(data.action, data.payload);

            // onClose()
        } catch (error) {
            setLoading(false)
        }

    }

    useEffect(() => {
        form.setFieldValue("namespace", namespace)
    }, [namespace])
    const normFile = (e: any) => {
        console.log(e)
        if (Array.isArray(e)) {
            return e;
        }
        return [{
            uid: '-4',
            name: 'image.png',
            status: 'done',
            url: 'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png',
        }];
    };
    return <>
        {/* {JSON.stringify(data)} */}
        {/* <Drawer
            loading={loading}
            title={`${data ? "Update" : "Create"} Component(${structure?.component_type})`}
            // okText={data ? "Update" : "Create"}
            // onCancel={() => onClose()}
            // onOk={savePipeline}
            forceRender={true}

            open={visible}
            width={"80%"}
            extra={<>

            </>}
            onClose={() => onClose()}

        > */}
        {/* {namespace} */}

        <Spin spinning={loading}>
            {/* {JSON.stringify(component)} */}
            <Flex justify="end" gap="small" style={{ marginBottom: "0.5rem" }}>
                {script_id &&
                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                        getPipeleine(script_id)
                    }}>
                        Refresh
                    </Button>
                }

                <Button size="small" color="cyan" variant="solid" onClick={savePipeline}>
                    {script_id ? "Update" : "Create"}
                </Button>
            </Flex>
            <Form form={form} >

                <Form.Item name={"component_name"} label="Component Name" rules={[{ required: true, message: 'Please input component name!' }]}>
                    <Input ></Input>
                </Form.Item>



                <ComponentsRender structure={structure} {...structure} data={component} form={form}></ComponentsRender>
                <Form.Item name={"prompt"} label="Prompt" >
                    <TextArea rows={4}></TextArea>
                </Form.Item>

                <Form.Item name={"tags"} label="Tags">
                    <Select
                        mode="tags"
                        style={{ width: '100%' }}
                    />
                </Form.Item>
                <Form.Item name={"category"} label="Category">
                    <Input ></Input>
                </Form.Item>
                {/* valuePropName="fileList"  getValueFromEvent={normFile}*/}
                {script_id && <Form.Item label="Upload" name={"img"}  >
                    <UploadComp component_id={script_id}></UploadComp>
                </Form.Item>}
                <Form.Item label="Order" name={"order_index"} initialValue={0}>
                    <InputNumber ></InputNumber >
                </Form.Item>

                <Form.Item name={"description"} label="Description">
                    {/* <TextAreaComp templete={""}></TextAreaComp> */}
                    <TextArea></TextArea>

                </Form.Item>
                {/* <Tabs

                    items={[
                        {
                            label: "Component Info",
                            key: "1",
                            children: <>
                             

                            </>
                        }, {
                            label: "Component Description",
                            key: "2",
                            children: <>



                            </>
                        }
                    ]}>
                </Tabs> */}

                <Collapse ghost items={[
                    {
                        key: "1",
                        label: "More",
                        children: <>
                            <Form.Item noStyle shouldUpdate>
                                {() => (
                                    <Typography>
                                        <pre>{JSON.stringify(getParamsFormat(form.getFieldsValue()), null, 2)}</pre>
                                    </Typography>
                                )}
                            </Form.Item>

                                    <Typography>
                                        <pre>{JSON.stringify(INPUTS, null, 2)}</pre>
                                    </Typography>
                        </>
                    }
                ]} />

            </Form>
            <PreviewJsonForm value={content}></PreviewJsonForm>

        </Spin>



        {/* </Drawer> */}
    </>
}


export const CreateOrUpdatePipeline: FC<any> = ({ data, structure, callback }) => {
    // if (!visible) return null;

    // const { data, structure } = params
    const [form] = Form.useForm()
    const [component, setComponent] = useState<any>()
    const { namespace } = useSelector((state: any) => state.user);

    const [loading, setLoading] = useState<any>(false)

    const content = Form.useWatch((values: any) => values?.content, form);


    const getPipeleine = async (componentId: any) => {
        const resp = await axios.post("/find-pipeline", { component_id: componentId })

        const data = resp.data
        // data['content'] = JSON.parse(data['content']) //JSON.stringify(JSON.parse(data['content']), null, 2)
        if (data['tags']) {
            data['tags'] = JSON.parse(data['tags'])
        }
        if (data["component_ids"]) {
            data["component_ids"] = JSON.parse(data["component_ids"])
        }
        if (data["tools_container_id"]) {
            data["tools_container_id"] = JSON.parse(data["tools_container_id"])
        }

        setComponent(data)
        console.log(data)
        if (structure.component_type == "pipeline") {
            data['content'] = JSON.parse(data['content'])
            form.setFieldsValue(data)
        } else {
            form.setFieldsValue(data)
        }

    }



    useEffect(() => {
        if (data?.component_id) {
            getPipeleine(data.component_id)
        } else {
            setComponent({})
            form.resetFields()
        }
    }, [data])
    const getParams = (values: any) => {
        const params = {
            ...values,
            ...structure,

        }
        if (data?.component_id) {
            // params['relation_id'] = pipelineRelation.relation_id
            // params['parent_component_id'] = pipelineRelation.parent_component_id
            params['component_id'] = data.component_id


        }


        return params
    }
    const getParamsFormat = (values: any) => {
        const params = getParams(values)
        if (typeof params['content'] == 'string') {
            try {
                params['content'] = JSON.parse(params['content'])

            } catch (error) {

            }
        }

        return params
    }
    const savePipeline = async () => {
        setLoading(true)
        const values = await form.validateFields()
        const params = getParams(values)
        if (typeof params['content'] != 'string') {
            params['content'] = JSON.stringify(params['content'])
        }
        if (typeof params['tags'] != 'string') {
            params['tags'] = JSON.stringify(params['tags'])
        }
        if (!params['content']) {
            params['content'] = "{}"
        }
        // for file component
        if (params["component_ids"]) {
            params["component_ids"] = JSON.stringify(params["component_ids"])
        }
        if (params["tools_container_id"]) {
            params["tools_container_id"] = JSON.stringify(params["tools_container_id"])
        }
        if (data["relation_id"]) {
            params["relation_id"] = data["relation_id"]
        }

        console.log(params)
        try {
            const resp = await axios.post("/save-pipeline", params)
            console.log(resp)
            setLoading(false)
            if (callback) {
                callback()
                // await axios.get("/get-pipeline-v2/d9830ebd-240e-4758-adab-dd3a9d17e414")
            }
            // onClose()
        } catch (error) {
            setLoading(false)
        }

    }

    useEffect(() => {
        form.setFieldValue("namespace", namespace)
    }, [namespace])
    const normFile = (e: any) => {
        console.log(e)
        if (Array.isArray(e)) {
            return e;
        }
        return [{
            uid: '-4',
            name: 'image.png',
            status: 'done',
            url: 'https://zos.alipayobjects.com/rmsportal/jkjgkEfvpUPVyRjUImniVslZfWPnJuuZ.png',
        }];
    };
    return <>
        {/* {JSON.stringify(data)} */}
        {/* <Drawer
            loading={loading}
            title={`${data ? "Update" : "Create"} Component(${structure?.component_type})`}
            // okText={data ? "Update" : "Create"}
            // onCancel={() => onClose()}
            // onOk={savePipeline}
            forceRender={true}

            open={visible}
            width={"80%"}
            extra={<>

            </>}
            onClose={() => onClose()}

        > */}
        {/* {namespace} */}

        <Spin spinning={loading}>
            {/* {JSON.stringify(component)} */}

            <Form form={form} >
                <Tabs
                    tabBarExtraContent={<Space>
                        {data?.component_id &&
                            <Button size="small" color="cyan" variant="solid" onClick={() => {
                                getPipeleine(data.component_id)
                            }}>
                                Refresh
                            </Button>
                        }

                        <Button size="small" color="cyan" variant="solid" onClick={savePipeline}>
                            {data?.component_id ? "Update" : "Create"}
                        </Button>
                    </Space>
                    }
                    items={[
                        {
                            label: "Component Info",
                            key: "1",
                            children: <>
                                {/* <Form.Item name={"namespace"} label="Namespace"   >
                                <Input disabled></Input>
                            </Form.Item> */}

                                <Form.Item name={"component_name"} label="Component Name" rules={[{ required: true, message: 'Please input component name!' }]}>
                                    <Input ></Input>
                                </Form.Item>



                                <ComponentsRender structure={structure} {...structure} data={component} form={form}></ComponentsRender>

                            </>
                        }, {
                            label: "Component Description",
                            key: "2",
                            children: <>

                                <Form.Item name={"prompt"} label="Prompt" >
                                    <TextArea rows={4}></TextArea>
                                </Form.Item>

                                <Form.Item name={"tags"} label="Tags">
                                    <Select
                                        mode="tags"
                                        style={{ width: '100%' }}
                                    />
                                </Form.Item>
                                <Form.Item name={"category"} label="Category">
                                    <Input ></Input>
                                </Form.Item>
                                {/* valuePropName="fileList"  getValueFromEvent={normFile}*/}
                                {data?.component_id && <Form.Item label="Upload" name={"img"}  >
                                    <UploadComp component_id={data?.component_id}></UploadComp>
                                </Form.Item>}
                                <Form.Item label="Order" name={"order_index"} initialValue={0}>
                                    <InputNumber ></InputNumber >
                                </Form.Item>

                                <Form.Item name={"description"} label="Description">
                                    <TextAreaComp templete={""}></TextAreaComp>

                                </Form.Item>

                            </>
                        }
                    ]}>
                </Tabs>

                <Collapse ghost items={[
                    {
                        key: "1",
                        label: "More",
                        children: <>
                            <Form.Item noStyle shouldUpdate>
                                {() => (
                                    <Typography>
                                        <pre>{JSON.stringify(getParamsFormat(form.getFieldsValue()), null, 2)}</pre>
                                    </Typography>
                                )}
                            </Form.Item>
                        </>
                    }
                ]} />

            </Form>
            <PreviewJsonForm value={content}></PreviewJsonForm>

        </Spin>



        {/* </Drawer> */}
    </>
}

const componentRelationMap: any = {
    // wrap_pipeline: WrapPipeline,
    // pipeline: WrapPipeline,
    pipeline_software: DefaultComponentRelation,
    software_input_file: DefaultComponentRelation,
    software_output_file: DefaultComponentRelation,
    file_script: DefaultComponentRelation,
    parent_file_script: AddFileComponentRelation,
    tools: Tools
}
const ComponentsRelationRender = ({ relation_type, data, form, components }: any) => {
    const Component = componentRelationMap[relation_type] || (() => <div>未知类型 {JSON.stringify(data)}</div>);
    return <Component data={data} form={form} components={components}></Component>
}

export const CreateORUpdateRelationComp: FC<any> = (params) => {

    const { data, pipelineStructure, namespace, callback } = params
    const [form] = Form.useForm()
    const [pipeline, setPipeline] = useState<any>()
    const [pipelineRelation, setPipelineRelation] = useState<any>()
    const [components, setComponents] = useState<any>([])
    const [loading, setLoaidng] = useState<any>(false)
    const message = useGlobalMessage()

    const listPipelineComponents = async (componentType: any) => {
        const resp = await listPipelineComponentsApi({
            component_type: componentType,
            namespace: namespace
        })
        const data = resp.data.map((item: any) => {
            const content = JSON.parse(item.content)
            if (pipelineStructure.relation_type == "pipeline_software") {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            } else if (pipelineStructure.relation_type == "file_script") {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            } else {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            }

        })
        return data
    }

    const loadData = async () => {
        setLoaidng(true)
        if (pipelineStructure.relation_type == "pipeline_software") {
            const data = await listPipelineComponents("software")
            setComponents(data)
        } else if (pipelineStructure.relation_type == "software_input_file"
            || pipelineStructure.relation_type == "parent_file_script"
            || pipelineStructure.relation_type == "software_output_file") {
            const data = await listPipelineComponents("file")
            setComponents(data)

        } else if (pipelineStructure.relation_type == "file_script") {
            const data = await listPipelineComponents("script")
            setComponents(data)
        } else if (pipelineStructure.relation_type == "tools") {
            const files = await listPipelineComponents("file")
            const scripts = await listPipelineComponents("script")

            setComponents({
                files: files,
                scripts: scripts
            })
        }


        if (data) {
            await getPipeleineRelation(data.relation_id)

            // 
        } else {
            form.resetFields()
        }
        setLoaidng(false)
    }
    const getPipeleineRelation = async (relationId: any) => {
        const resp = await axios.post(`/find-pipeline-relation/${relationId}`)

        const data = resp.data
        // if (data?.tags) {
        //     data['tags'] = JSON.parse(data['tags'])
        // }
        // if (data?.input_component_ids) {
        //     data['input_component_ids'] = JSON.parse(data['input_component_ids'])
        // }
        // if (data?.dag_definition) {
        //     data['dag_definition'] = JSON.stringify(data['dag_definition'], null, 2)
        // }
        setPipelineRelation(data)
        form.setFieldsValue(data)
    }
    // const getPipeleine = async (componentId: any) => {
    //     const resp = await axios.post("/find-pipeline", { component_id: componentId })

    //     const data = resp.data
    //     data['content'] = JSON.parse(data['content']) //JSON.stringify(JSON.parse(data['content']), null, 2)
    //     setPipeline(data)
    //     // form.setFieldsValue(data)
    // }

    useEffect(() => {

        loadData()

    }, [])
    const getParams = (values: any) => {
        const params = {
            ...values,
            ...pipelineStructure,

        }
        if (params.relation_type == "parent_file_script") {
            params.relation_type = "file_script"
        }
        if (data) {
            params['relation_id'] = pipelineRelation.relation_id
            // params['parent_component_id'] = pipelineRelation.parent_component_id
        }
        // if (pipelineStructure.relation_type == "pipeline_software") {
        //     params['component_id'] = values.to_component_id
        // }else{

        // }
        // if (data) {
        //     params['parent_component_id'] =data.componemt_id
        //     params['pipeline_id'] =data.pipeline_id
        // }

        return params
    }
    const savePipeline = async () => {
        setLoaidng(true)
        const values = await form.validateFields()
        const params = getParams(values)
        if (typeof params['content'] != 'string') {
            params['content'] = JSON.stringify(params['content'])
        }
        // if (typeof params['dag_definition'] != 'object') {
        //     params['dag_definition'] = JSON.parse(params['dag_definition'])
        // }

        console.log(params)
        try {
            const resp = await http.post("/workflow/save-workflow", params)
            console.log(resp)
            setLoaidng(false)
            if (callback) {
                callback()
            }
            message.success("Save relation success!")
        } catch (error) {
            setLoaidng(false)
        }


    }
    return <Spin spinning={loading}>
        <Card size="small"
            extra={<Space>
                <Button size="small" color="cyan" variant="solid" onClick={savePipeline}>
                    {data ? "Update" : "Create"}
                </Button>

            </Space>}
        >


            <Form form={form}>
                <Form.Item name={"name"} label="Name" rules={[{ required: true, message: 'Please input name!' }]}>
                    <Input ></Input>
                </Form.Item>


                <Form.Item name={"dag_definition"} label="DAG Definition" >
                    <TextArea rows={4}></TextArea>
                </Form.Item>
                <ComponentsRelationRender components={components} {...pipelineStructure} data={pipeline} form={form}></ComponentsRelationRender>

                <Form.Item name={"tags"} label="Tags">
                    <Select
                        mode="tags"
                        style={{ width: '100%' }}
                    />
                </Form.Item>
                <Form.Item name={"category"} label="Category">
                    <Input ></Input>
                </Form.Item>

                {/* valuePropName="fileList"  getValueFromEvent={normFile}*/}
                {/* {JSON.stringify(data)} */}
                {data?.relation_id && <Form.Item label="Upload" name={"img"}  >
                    {/* {data?.relation_id} */}
                    <UploadRelationComp relation_id={data?.relation_id}></UploadRelationComp>
                </Form.Item>}
                <Form.Item label="Order" name={"order_index"} initialValue={0}>
                    <InputNumber ></InputNumber >
                </Form.Item>

                <Form.Item name={"description"} label="Description">
                    {/* <TextArea></TextArea> */}
                    <TextAreaComp></TextAreaComp>
                </Form.Item>

                <Collapse ghost items={[
                    {
                        key: "1",
                        label: "More",
                        children: <>
                            <Form.Item noStyle shouldUpdate>
                                {() => (
                                    <Typography>
                                        <pre>{JSON.stringify(getParams(form.getFieldsValue()), null, 2)}</pre>
                                    </Typography>
                                )}
                            </Form.Item>
                        </>
                    }
                ]} />

            </Form>
        </Card>
        {/* savePipeline */}



    </Spin>
}

export const CreateORUpdatePipelineCompnentRelation: FC<any> = ({ visible, onClose, params, callback }) => {
    if (!visible) return null;

    const { data, pipelineStructure, namespace } = params
    const [form] = Form.useForm()
    const [pipeline, setPipeline] = useState<any>()
    const [pipelineRelation, setPipelineRelation] = useState<any>()
    const [components, setComponents] = useState<any>([])
    const [loading, setLoaidng] = useState<any>(false)

    const listPipelineComponents = async (componentType: any) => {
        const resp = await listPipelineComponentsApi({
            component_type: componentType,
            namespace: namespace
        })
        const data = resp.data.map((item: any) => {
            const content = JSON.parse(item.content)
            if (pipelineStructure.relation_type == "pipeline_software") {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            } else if (pipelineStructure.relation_type == "file_script") {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            } else {
                return {
                    label: `${item.component_name}(${item.component_id})`,
                    value: item.component_id
                }
            }

        })
        return data
    }

    const loadData = async () => {
        setLoaidng(true)
        if (pipelineStructure.relation_type == "pipeline_software") {
            const data = await listPipelineComponents("software")
            setComponents(data)
        } else if (pipelineStructure.relation_type == "software_input_file"
            || pipelineStructure.relation_type == "parent_file_script"
            || pipelineStructure.relation_type == "software_output_file") {
            const data = await listPipelineComponents("file")
            setComponents(data)

        } else if (pipelineStructure.relation_type == "file_script") {
            const data = await listPipelineComponents("script")
            setComponents(data)
        } else if (pipelineStructure.relation_type == "tools") {
            const files = await listPipelineComponents("file")
            const scripts = await listPipelineComponents("script")

            setComponents({
                files: files,
                scripts: scripts
            })
        }


        if (data) {
            await getPipeleineRelation(data.relation_id)

            // 
        } else {
            form.resetFields()
        }
        setLoaidng(false)
    }
    const getPipeleineRelation = async (relationId: any) => {
        const resp = await axios.post(`/find-pipeline-relation/${relationId}`)

        const data = resp.data
        // if (data?.tags) {
        //     data['tags'] = JSON.parse(data['tags'])
        // }
        // if (data?.input_component_ids) {
        //     data['input_component_ids'] = JSON.parse(data['input_component_ids'])
        // }
        // if (data?.output_component_ids) {
        //     data['output_component_ids'] = JSON.parse(data['output_component_ids'])
        // }
        setPipelineRelation(data)
        form.setFieldsValue(data)
    }
    // const getPipeleine = async (componentId: any) => {
    //     const resp = await axios.post("/find-pipeline", { component_id: componentId })

    //     const data = resp.data
    //     data['content'] = JSON.parse(data['content']) //JSON.stringify(JSON.parse(data['content']), null, 2)
    //     setPipeline(data)
    //     // form.setFieldsValue(data)
    // }

    useEffect(() => {

        if (visible) {
            loadData()
        }

    }, [visible])
    const getParams = (values: any) => {
        const params = {
            ...values,
            ...pipelineStructure,

        }
        if (params.relation_type == "parent_file_script") {
            params.relation_type = "file_script"
        }
        if (data) {
            params['relation_id'] = pipelineRelation.relation_id
            // params['parent_component_id'] = pipelineRelation.parent_component_id
        }
        // if (pipelineStructure.relation_type == "pipeline_software") {
        //     params['component_id'] = values.to_component_id
        // }else{

        // }
        // if (data) {
        //     params['parent_component_id'] =data.componemt_id
        //     params['pipeline_id'] =data.pipeline_id
        // }

        return params
    }
    const savePipeline = async () => {
        setLoaidng(true)
        const values = await form.validateFields()
        const params = getParams(values)
        if (typeof params['content'] != 'string') {
            params['content'] = JSON.stringify(params['content'])
        }

        console.log(params)
        try {
            const resp = await axios.post("/save-pipeline-relation", params)
            console.log(resp)
            setLoaidng(false)
            onClose()
            if (callback) {
                callback()
            }
        } catch (error) {
            setLoaidng(false)
        }


    }
    return <>
        {/* savePipeline */}
        <Drawer
            loading={loading}
            title={`${data ? "Update" : "Create"} (${pipelineStructure?.relation_type})`}
            open={visible}
            extra={<>
                <Button size="small" color="cyan" variant="solid" onClick={savePipeline}>
                    {data ? "Update" : "Create"}
                </Button>
            </>}
            width={"80%"}
            onClose={() => onClose()}>


            <Form form={form}>
                <Form.Item name={"name"} label="Name" rules={[{ required: true, message: 'Please input name!' }]}>
                    <Input ></Input>
                </Form.Item>
                <ComponentsRelationRender components={components} {...pipelineStructure} data={pipeline} form={form}></ComponentsRelationRender>

                <Form.Item name={"tags"} label="Tags">
                    <Select
                        mode="tags"
                        style={{ width: '100%' }}
                    />
                </Form.Item>
                <Form.Item name={"category"} label="Category">
                    <Input ></Input>
                </Form.Item>
                {/* valuePropName="fileList"  getValueFromEvent={normFile}*/}
                {/* {JSON.stringify(data)} */}
                {data?.relation_id && <Form.Item label="Upload" name={"img"}  >
                    {/* {data?.relation_id} */}
                    <UploadRelationComp relation_id={data?.relation_id}></UploadRelationComp>
                </Form.Item>}
                <Form.Item label="Order" name={"order_index"} initialValue={0}>
                    <InputNumber ></InputNumber >
                </Form.Item>

                <Form.Item name={"description"} label="Description">
                    <TextArea></TextArea>
                </Form.Item>

                <Collapse ghost items={[
                    {
                        key: "1",
                        label: "More",
                        children: <>
                            <Form.Item noStyle shouldUpdate>
                                {() => (
                                    <Typography>
                                        <pre>{JSON.stringify(getParams(form.getFieldsValue()), null, 2)}</pre>
                                    </Typography>
                                )}
                            </Form.Item>
                        </>
                    }
                ]} />

            </Form>

        </Drawer>
    </>
}
export default CreateORUpdatePipelineCompnentRelation

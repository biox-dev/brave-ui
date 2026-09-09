import AI from "@/components/chat/ai";
import { FC, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import AnalysisResultPage from "./analysis-result-page";
import { Button, Card, Col, Popconfirm, Row, Space } from "antd";
import Code from "@/components/script/code";
import { MonacoEditor } from "@/components/react-monaco-editor";
import axios from "axios";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { AppstoreOutlined, CloseOutlined, DeleteColumnOutlined, DeleteOutlined, DownOutlined, PlusOutlined, QuestionCircleOutlined, RedoOutlined } from '@ant-design/icons'

const ComponentScript = forwardRef<any, any>(

    ({ component_id }, ref) => {
        const [data, setData] = useState<any>()
        const [scriptName, setScriptName] = useState("main")
        const editorRef = useRef<any>(null)
        const [content, setContent] = useState<string>("")
        const message = useGlobalMessage()

        const getModuleContent = async () => {
            try {
                const resp = await axios.get(`/get-component-module-content/${component_id}?script_name=${scriptName}`)
                // console.log(resp)
                setContent(resp.data.content)
            } catch (error: any) {
                console.error(`${error.response.data.detail}`)
            }
        }

        const save = async () => {
            const resp = await axios.post(`/component/save-script/${component_id}`, {
                content: content
            })
            // console.log(resp)
            message.success(`Script saved`)

        }

        const generateScript = async () => {
            await axios.post(`/component/convert-ipynb/${component_id}`)
            message.success("Generate Script Successful!")
            getModuleContent()
        }
        useImperativeHandle(ref, () => ({
            save,
            loadData: getModuleContent,
            generateScript
        }))

        useEffect(() => {
            if (component_id) {
                getModuleContent()
            }

        }, [component_id, scriptName])
        return <Card size="small"
            extra={<Space  size={"small"}>
                <Popconfirm title="Whether to generate scripts?" onConfirm={async () => {
                    generateScript()
                }}>
                    <Button size="small" color="blue" variant="solid" icon={<PlusOutlined />}></Button>

                </Popconfirm>

                <Button size="small" color="blue" variant="solid" icon={<RedoOutlined />}
                    onClick={() => { getModuleContent() }}></Button>
                <Button size="small" color="blue" variant="solid" onClick={() => {
                    save()
                }}>Save</Button>

            </Space>}
        >
            {/* {component_id} */}
            <MonacoEditor height={"85vh"} value={content} onChange={setContent} defaultLanguage="python" ></MonacoEditor>

        </Card>

    }

)
export default ComponentScript
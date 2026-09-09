import { Button, Drawer, Flex, message, Modal, Popconfirm, Tabs, Tooltip } from "antd"
import axios from "axios"
import { FC, useEffect, useRef, useState } from "react"
import { message as $message } from 'antd';
import TextArea from "antd/es/input/TextArea";
import Typography from "antd/es/typography/Typography";
import { MonacoEditor } from "../react-monaco-editor"
import { http } from "@/api/client/http";
const Code: FC<any> = ({ script_id }) => {
    const [data, setData] = useState<any>()
    const [messageApi, contextHolder] = message.useMessage();
    const [scriptName, setScriptName] = useState("main")
    const editorRef = useRef<any>(null)

    const getModuleContent = async () => {
        try {
            const resp = await http.get(`/script/${script_id}/content`)
            console.log(resp)
            setData(resp.data)
        } catch (error: any) {
            messageApi.error(`${error.response.data.detail}`)
        }


    }
    useEffect(() => {
        if (script_id) {
            getModuleContent()
        }

    }, [script_id, scriptName])
    return <>
        {data?.path && <Typography >{data?.path}</Typography>}
        <Flex justify="flex-end" gap={"small"}>
            <Popconfirm title="Whether to generate scripts?" onConfirm={async () => {
                await axios.post(`/component/convert-ipynb/${script_id}`)
                messageApi.success("Generate Script Successful!")
                getModuleContent()
            }}>
                <Button size="small" color="cyan" variant="solid">Generate scripts</Button>
            </Popconfirm>
            <Button size="small" color="cyan" variant="solid" onClick={() => {
                getModuleContent()
            }}>Refresh</Button>
            <Tooltip title={
                data?.path
            }>
                <Button size="small" color="cyan" variant="solid" onClick={() => {
                    editorRef.current.setValue(data?.content)
                }}>Save</Button>
            </Tooltip>
        </Flex>
        {contextHolder}
        <MonacoEditor value={data?.content} editorRef={editorRef} defaultLanguage="python"></MonacoEditor>

        {/* <Typography>
                <pre>
                    {data?.content}s
                </pre>
            </Typography> */}
        {/* <Tabs
            tabBarExtraContent={
               
            }
            onChange={(key) => {
                setScriptName(key)
            }}
            items={[{ label: "main", key: "main" }]}></Tabs> */}
        {/* , { label: "input_parse", key: "input_parse" }, { label: "output_parse", key: "output_parse"  */}
        {/* <TextArea value={data?.content} disabled rows={10}>
            </TextArea> */}

    </>
}

export default Code
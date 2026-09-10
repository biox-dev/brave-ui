import AI from "@/components/chat/ai";
import { FC, forwardRef, use, useEffect, useImperativeHandle, useState } from "react";
// import AnalysisResultPage from "@/components/result-list/page";
import { Button, Card, Col, Row, Space, Tag } from "antd";
import axios from "axios";
import { MonacoEditor } from "@/components/react-monaco-editor";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { RedoOutlined } from '@ant-design/icons'
import { http } from "@/api/client/http";
const RelationDefinitionDAG = forwardRef<any, any>(

    ({ workflow_id, callback }, ref) => {

        const message = useGlobalMessage()
        const [content, setContent] = useState<string>("")
        const loadData = async () => {
            const resp = await http.get(`/workflow/${workflow_id}/get-workflow`)
            const data = resp.data
            setContent(data?.dag_definition || "")
          
        }
        const save = async () => {
            console.log("save called structure")
            const resp = await http.post("/workflow/save-workflow-dag",{
                relation_id: workflow_id,
                dag_definition: content
            })
            message.success("Structure saved")
            // loadData()
            callback && callback()

        }
        useEffect(() => {
            loadData()
        }, [])

        return <Card size="small"
            extra={<Space size={"small"}>
                <Button size="small" color="blue" variant="solid" icon={<RedoOutlined />}
                    onClick={() => { loadData() }}></Button>
                <Button size="small" color="blue" variant="solid" onClick={() => {
                    save()
                }}>Save</Button>
            </Space>}

        >
            {/* {relation_id} */}
            <MonacoEditor height={"85vh"} value={content} onChange={setContent} defaultLanguage="json"></MonacoEditor>
        </Card>

    }
)

export default RelationDefinitionDAG
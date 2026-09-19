import { invoke } from "@/core/ui-system/invokeV2"
import { Button, Card, Flex, Form, Input, Popconfirm, Space, Switch, Tag, Tooltip } from "antd"
import axios from "axios"
import { FC, useEffect, useState } from "react"
import { RedoOutlined } from '@ant-design/icons'
import TextArea from "antd/es/input/TextArea"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ur } from "@faker-js/faker"
import { http } from "@/api/client/http"
const PublishToolsV2: FC<any> = ({ type, store, callback }) => {
    // const [force, setForce] = useState(true)
    // const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [form] = Form.useForm()
    const message = useGlobalMessage()

    // const loadData = async () => {
    //     setLoading(true)
    //     const resp = await axios.post(`/find-tools-publish/${workflow_id}`)
    //     setData(resp.data)
    //     form.setFieldsValue({
    //         version: resp.data.version,
    //         update_info: resp.data.update_info,
    //         url: resp.data.url,
    //     })
    //     setLoading(false)

    // }


    useEffect(() => {
        if (store?.store_id != "0") {
            form.setFieldsValue(store)

        }
    }, [store])

    return <Card size="small"
        extra={<Space>

            {store?.store_id!="0" && <Tag>
                {store?.store_id}
            </Tag>}
            <Tag>
                {type}
            </Tag>
            {/* <Button size="small" color="cyan" variant="solid" onClick={async () => {
                const resp = await http.post(`/workflow/${workflow?.id}/generate-workflow-json`)
                message.success("Generated successfully")
            }}> Generate </Button> */}

            <Popconfirm title="Are you sure to publish?" onConfirm={async () => {
                const values = await form.validateFields()
                const payload = {
                    url: values.store_url,
                    message: values.store_message,
                }
                if (type === "script") {
                    await http.post(`/workflow/publish-script`, {
                        ...payload,
                        script_id: store?.id,
                    })
                } else {
                    await http.post(`/workflow/publish-workflow`, {
                        ...payload,
                        workflow_id: store?.id,
                    })
                }
                message.success("Published successfully")
                callback && callback()
            }}>
                <Button size="small" color="cyan" variant="solid">Publish Store</Button>
            </Popconfirm>
           

            {store?.store_id != "0" && <Button size="small" color="cyan" variant="solid" onClick={() => {
                invoke.publishStore.open(store, {
                    footer: null,
                    width: 640,
                    title: "Publish Store"
                })
            }}>Publish Remote</Button>
            }

            {/* <Button size="small" color="cyan" variant="solid" icon={<RedoOutlined />} onClick={loadData}></Button> */}

        </Space>}
    >
        {/* {JSON.stringify(workflow)} */}
        {/* {JSON.stringify(store)} */}
        {/* {JSON.stringify(workflow)} */}
        <Flex justify="center" >
            <Form form={form} layout="vertical" style={{ width: "50%" }} disabled={loading}>

                {/* <Form.Item initialValue={"v0.0.1"} name={"version"} label="Version" rules={[{ required: true, message: 'Please input version!' }]}>
                    <Input ></Input>
                </Form.Item> */}
                <Form.Item
                    label="URL"
                    name="store_url"
                // rules={[{ required: true, message: "Please input URL" }]}
                >
                    <Input placeholder="http://github.com/owner/repo" />
                </Form.Item>
                <Form.Item label="Message" name="store_message">
                    <TextArea placeholder="Update Info" />
                </Form.Item>
                <Form.Item label="Store Path">
                    <Tooltip title={store?.store_path}>
                        <Input value={store?.store_path} disabled placeholder="-" />
                    </Tooltip>
                </Form.Item>
                {type === "workflow" && <Form.Item label="Workflow Path">
                    <Tooltip title={store?.workflow_path}>
                        <Input value={store?.workflow_path} disabled placeholder="-" />
                    </Tooltip>
                </Form.Item>}
                {type === "script" && <Form.Item label="Script Path">
                    <Tooltip title={store?.script_path}>
                        <Input value={store?.script_path} disabled placeholder="-" />
                    </Tooltip>
                </Form.Item>}
                {/* <Form.Item label="Force" name="force" initialValue={true} >
                    <Switch size="small" checkedChildren="Force" unCheckedChildren="Force" />
                </Form.Item> */}
            </Form>
        </Flex>


    </Card>
}

export default PublishToolsV2
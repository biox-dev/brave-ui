import { invoke } from "@/core/ui-system/invokeV2"
import { Button, Card, Flex, Form, Input, Space, Switch, Tag } from "antd"
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
        form.setFieldsValue(store)
    }, [store])

    return <Card size="small"
        extra={<Space>

            {store?.store_id && <Tag>
                {store?.store_id}
            </Tag>}
            <Tag>
                {type}
            </Tag>
            {/* <Button size="small" color="cyan" variant="solid" onClick={async () => {
                const resp = await http.post(`/workflow/${workflow?.id}/generate-workflow-json`)
                message.success("Generated successfully")
            }}> Generate </Button> */}


            <Button size="small" color="cyan" variant="solid" onClick={async () => {
                const values = await form.validateFields()
                const payload = {
                    url: values.url,
                    version: values.version,
                    message: values.update_info,
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
            }}>Publish Store</Button>

            {store?.store_id && <Button size="small" color="cyan" variant="solid" onClick={() => {
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

        {/* {JSON.stringify(workflow)} */}
        <Flex justify="center">
            <Form form={form} layout="vertical" style={{ width: "50%" }} disabled={loading}>
                <Form.Item
                    label="URL"
                    name="url"
                    rules={[{ required: true, message: "Please input URL" }]}
                >
                    <Input placeholder="http://github.com/owner/repo" />
                </Form.Item>
                <Form.Item name={"version"} label="Version" rules={[{ required: true, message: 'Please input version!' }]}>
                    <Input ></Input>
                </Form.Item>
                <Form.Item label="message" name="update_info">
                    <TextArea placeholder="Update Info" />
                </Form.Item>
                {/* <Form.Item label="Force" name="force" initialValue={true} >
                    <Switch size="small" checkedChildren="Force" unCheckedChildren="Force" />
                </Form.Item> */}
            </Form>
        </Flex>


    </Card>
}

export default PublishToolsV2
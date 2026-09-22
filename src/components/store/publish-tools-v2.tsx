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
                // store 表已删除 url 列：发布只提交 message，目标远程地址由「Publish Remote」配置。
                const payload = {
                    message: values.store_message,
                }
                // 后端在「远端已是同一个提交」（没有新内容可推送）时返回 200 + pushed=false，
                // 属幂等成功，这里提示用户而不是报错。
                const resp = type === "script"
                    ? await http.post<{ pushed?: boolean }>(`/workflow/publish-script`, {
                        ...payload,
                        script_id: store?.id,
                    })
                    : await http.post<{ pushed?: boolean }>(`/workflow/publish-workflow`, {
                        ...payload,
                        workflow_id: store?.id,
                    })
                if (resp.data?.pushed === false) {
                    message.info("Already up-to-date, nothing to publish")
                } else {
                    message.success("Published successfully")
                }
                callback && callback()
            }}>
                <Button size="small" color="cyan" variant="solid">Publish Store</Button>
            </Popconfirm>
           

            {store?.store_id != "0" && <Button size="small" color="cyan" variant="solid" onClick={() => {
                invoke.publishStore.open({store_id: store?.store_id}, {
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
            <Form form={form} layout="vertical" style={{ width: "100%", maxWidth: 520 }} disabled={loading}>

                {/* <Form.Item initialValue={"v0.0.1"} name={"version"} label="Version" rules={[{ required: true, message: 'Please input version!' }]}>
                    <Input ></Input>
                </Form.Item> */}
                {/* <Form.Item
                    label="URL"
                    name="store_url"
                // rules={[{ required: true, message: "Please input URL" }]}
                >
                    <Input placeholder="http://github.com/owner/repo" />
                </Form.Item> */}
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
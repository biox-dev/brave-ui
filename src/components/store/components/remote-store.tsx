import { Button, Flex, Form, Select, Skeleton, Space, Switch, Table } from "antd";
import axios from "axios";
import { FC, useEffect, useState } from "react";
import { ReloadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from "react-redux";
import { setUserItem } from "@/store/userSlice";
const RemoteStore: FC<any> = ({ onOk }) => {

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { githubToken, scmOrigin } = useSelector((state: any) => state.user)
    const [form] = Form.useForm();
    const formValues = Form.useWatch((values: any) => values, form);
    const origin = Form.useWatch("origin", form);
    const dispatch = useDispatch();
    const loadData = async () => {
        // /component-store/get-remote-store
        setLoading(true);
        let params = {};
        const values = await form.validateFields();
        const origin = values.origin;
        if (origin === "github") {
            params = {
                token: githubToken,
            }
        } else if (origin === "gitee") {
            // params = {
            //     type: "gitee",
            //     token: githubToken,
            //     repos: storeRepos
            // }
        }
        const resp = await axios.post('/component-store/get-remote-store', {
            ...params,
            ...values
        });
        setData(resp.data);
        setLoading(false);
    }

    useEffect(() => {
        if (formValues) {
            loadData();

        }
    }, [formValues])

    useEffect(() => {
        if (origin && origin !== scmOrigin) {
            dispatch(setUserItem({ scmOrigin: origin }));
        }
    }, [dispatch, origin, scmOrigin])

    const buildUrl = (item: any) => {
        const origin = form.getFieldValue("origin")
        if (origin === "github") {
            return `https://github.com/${item.url}`;
        } else if (origin === "gitee") {
            return `https://gitee.com/${item.url}`;
        }
    }
    return <>
        <Flex justify="end">
            <Space>
                <Form form={form} layout="inline">
                    <Form.Item label="cache" name="is_cache" valuePropName="checked" initialValue={true}>
                        <Switch size="small" ></Switch>
                    </Form.Item>
                    <Form.Item label="origin" name="origin" initialValue={scmOrigin}>
                        <Select size="small" options={[
                            {
                                label: "github",
                                value: "github"
                            }, {
                                label: "gitee",
                                value: "gitee"
                            }
                        ]}></Select>
                    </Form.Item>
                </Form>

                <Button onClick={loadData} size="small" loading={loading} icon={<ReloadOutlined />}></Button>
            </Space>

        </Flex>
        {data?.tools ? <>

            <Table
                size="small"
                dataSource={data?.tools}
                columns={[
                    {
                        title: 'Name',
                        dataIndex: 'name',
                    },
                    {
                        title: 'url',
                        dataIndex: 'url',
                        render: (text, record: any) => {
                            return <a href={buildUrl(record)} target="_blank" rel="noopener noreferrer">{buildUrl(record)}</a>
                        }
                    }, {
                        title: 'Action',
                        key: 'action',
                        fixed: "right",
                        ellipsis: true,
                        width: 100,
                        render: (text, record: any) => {
                            return <Space>

                                <Button type="link" onClick={() => {
                                    onOk(buildUrl(record));
                                }}>Select</Button>
                            </Space>
                        }
                    }

                ]}
            ></Table>

        </> : <Skeleton active></Skeleton>}
    </>
}

export default RemoteStore;
import { FC, forwardRef, use, useEffect, useImperativeHandle, useMemo } from "react"
import { pagePipelineComponents } from "@/api/pipeline";
import { Button, Card, Flex, Input, Pagination, Popconfirm, Space, Table } from "antd";
import { DeleteOutlined, RedoOutlined } from '@ant-design/icons'
import { usePagination } from "@/hooks/usePagination";
import { useComponentStore } from "@/event-bus/stores/components";
import axios from "axios";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";

const Search = Input.Search
const ComponentsPage = forwardRef<any, any>(({ component_type, setComponent }, ref) => {
    const { data, pageNumber, totalPage, loading, reload, pageSize, setPageNumber, search } = usePagination({
        pageApi: pagePipelineComponents,
        params: { component_type: component_type },
        initialPageSize: 10
    })

    const message = useGlobalMessage()
    useImperativeHandle(ref, () => ({
        reload
    }));

    const instance = useMemo(() => {
        return {
            reload
        }
    }, [])
    const { register, unregister } = useComponentStore();
    useEffect(() => {
        register("tables", `${component_type}-table`, instance);
        return () => {
            // debugger
            unregister("tables", `${component_type}-table`, instance);
        }
    }, []);
    const columns: any = [
        {
            title: 'Component Name',
            dataIndex: 'component_name',
            key: 'component_name',
            width: 200,
        }, {
            title: "action",
            dataIndex: "action",
            fixed: "right",
            width: 100,

            key: "action",
            render: (_: any, record: any) => {
                return <Space>
                    <a onClick={async () => {
                        await invoke.createOrUpdateComponent.openAsync(
                            {
                                component_id: record.id,
                                structure: {
                                    component_type: "script",
                                },
                            },
                            {
                                width: "60%",
                                title: `Update Script Component`,
                            }
                        );
                        reload()
                    }}>Update</a>
                    <a onClick={() => {
                        setComponent(record)
                    }}>Select</a>
                    <Popconfirm title="Are you sure to delete this component?" onConfirm={async (e: any) => {
                        await axios.delete(`/delete-component/${record.component_id}`)
                        message.success("Component deleted!")
                        reload()
                        // setPanel("deleted")
                        // // reload()
                        // loadTable()
                    }}>
                        <Button size="small" type="link" icon={<DeleteOutlined style={{ color: "red" }} />} ></Button>

                    </Popconfirm>
                    {/* <a onClick={() => {
                        openModal("createOrUpdatePipelineComponent", {
                            data: record, structure: {
                                component_type: "file",
                            }
                        })
                    }}>Edit</a> */}
                    {/* 分割线 */}
                    {/* <Divider type="vertical" />

                    <a onClick={() => {
                        setComponent(record)
                        onClose()
                    }}>Select</a> */}
                </Space>
            }
        }
    ]

    return <>


        <Table
            title={() => <Flex gap={"small"} wrap justify="space-between" align="center">
                {/* <Button size="small" onClick={() => setComponent(undefined)}>Clear</Button> */}
                <Search
                    size="small"
                    placeholder="Search Components"
                    allowClear
                    enterButton
                    onSearch={(value) => { search(value) }}
                    style={{ width: 200 }}
                />
                <Space>

                    <Button size="small" onClick={async () => {
                        await invoke.createOrUpdateComponent.openAsync(
                            {
                                // component_id: data.script_id,
                                structure: {
                                    component_type: "script",
                                },
                            },
                            {
                                width: "60%",
                                title: `Create Script Component`,
                            }
                        );
                        reload()
                    }}>Create</Button>
                    <Button size="small" loading={loading} icon={<RedoOutlined></RedoOutlined>} onClick={reload}></Button>
                </Space>
            </Flex>}
            rowKey="component_id"
            size="small"
            // bordered
            pagination={false}
            loading={loading}
            scroll={{ x: 'max-content' }}
            columns={columns}
            footer={() => <>
                {totalPage != 0 && <Flex style={{ marginTop: "1rem" }} justify="space-between" align="center">
                    A total of {totalPage} records  &nbsp;
                    <Pagination
                        size="small"
                        current={pageNumber}
                        pageSize={pageSize}
                        total={totalPage}
                        onChange={(p) => setPageNumber(p)}
                        showSizeChanger={false}
                    />
                </Flex>}
            </>}
            dataSource={data} />



    </>
})

export default ComponentsPage
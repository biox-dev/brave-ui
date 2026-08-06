import { usePageQuery } from "@/hooks/usePaginationV2"
import { Button, Card, Col, Empty, Flex, Input, Pagination, Popconfirm, Row, Skeleton, Space, Tag, Tooltip } from "antd"
import Meta from "antd/es/card/Meta"
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react"
import { useSelector } from "react-redux"
import { colors } from '@/utils/utils'
import { DownloadOutlined, RedoOutlined } from '@ant-design/icons'
import { Spin } from "antd/lib"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useComponentStore } from "@/store-zustand/components"
import { http } from "@/api/client/http"

type StoreType = "workflow" | "script"

interface StorePageItem {
    id: string
    store_id: string
    store_type?: StoreType
    name?: string
    origin?: string
    url?: string
    status?: string
    path?: string
    path_name?: string
    category?: string
    tags?: any
    img?: string
    publish_urls?: any
    log?: string
    version?: string
    update_info?: string
    created_at?: string
    updated_at?: string
    description?: string
    installed?:boolean
}

interface StorePageQuery {
    store_type: StoreType
    keywords?: string
    sort_by?: string
    sort_order?: "ASC" | "DESC"
}

const normalizeText = (value?: string) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}

const StorePages = forwardRef<any, any>(({ onOk, onCancel, storeType = "workflow" }, ref) => {
    const normalizedStoreType: StoreType = storeType === "script" ? "script" : "workflow"

    const { data, total, page, pageSize, isLoading, isFetching, refetch, setPage, setQuery } = usePageQuery<StorePageItem, StorePageQuery>({
        queryKey: ["store-page", normalizedStoreType],
        query: {
            store_type: normalizedStoreType,
        },
        initialPageSize: 12,
        queryFn: async (payload) => {
            const { page, page_size, ...nextQuery } = payload
            const resp = await http.post<{ data: StorePageItem[]; total: number; page: number; page_size: number }>("/store/list-by-page", {
                page,
                page_size,
                query: nextQuery,
            })
            return resp.data
        },
        keepPreviousData: true,
        staleTime: 30_000,
        cacheTime: 5 * 60_000,
    })

    const { baseURL } = useSelector((state: any) => state.user)
    const { Search } = Input
    const message = useGlobalMessage()

    useEffect(() => {
        setQuery({ store_type: normalizedStoreType })
    }, [normalizedStoreType, setQuery])

    useImperativeHandle(ref, () => ({
        reload: () => {
            refetch()
        }
    }))

    const { register, unregister } = useComponentStore()

    const instance = useMemo(() => {
        return {
            clone: () => {
                refetch()
            }, pull: () => {
                refetch()
            }, stop: () => {
                refetch()
            }, already_exists: (args: any) => {
                if (args?.reason) {
                    message.error(args.reason)
                } else {
                    message.error("Component already exists in your tools, please go to tools page to check or uninstall it first.")
                }
                refetch()
            }
        }
    }, [message, refetch])

    useEffect(() => {
        register("store", "*", instance)
        return () => {
            unregister("store", "*", instance)
        }
    }, [instance, register, unregister])

    return <>
        <Card
            title={<Space>
                <Search
                    size="small"
                    placeholder="Search stores"
                    allowClear
                    enterButton
                    onSearch={(value) => {
                        setQuery({
                            store_type: normalizedStoreType,
                            keywords: normalizeText(value),
                        })
                    }}
                    style={{ width: 400 }}
                />
                <Tag color="blue">{normalizedStoreType}</Tag>
            </Space>}
            size="small" extra={<Space>
                <Button size="small" color="cyan" variant="solid" icon={<RedoOutlined />} onClick={() => refetch()}></Button>

            </Space>}>
            {data ? <>
                {data.length === 0 ? <Empty description="No data" /> : <Spin spinning={isLoading || isFetching}>
                    <Row gutter={16} >
                        {data.map((item: StorePageItem, index: number) => (
                            <Col key={index} lg={6} sm={4} xs={24} style={{ marginBottom: "1rem", cursor: "pointer" }}>
                                <Card hoverable
                                    size="small"
                                    className="custom-card"
                                    variant="borderless"
                                    style={{
                                        height: "100%",
                                        border: "1px solid #f0f0f0",
                                        borderRadius: "12px",
                                        overflow: "hidden",
                                        transition: "all 0.3s ease",
                                    }}
                                    title={<Space>
                                        {item?.origin && <Tag color="blue">{item?.origin}</Tag>}

                                        {item?.version && <Tag color="blue">{item?.version}</Tag>}

                                        {item?.status != "done" && (
                                            <Tooltip title={item?.log}>
                                                <Button
                                                    icon={<Spin size="small" />}
                                                    color="red"
                                                    variant="solid"
                                                    size="small"
                                                    onClick={async () => {
                                                        await axios.post(`/git-stop/${item?.store_id}`)
                                                        message.success("Stop success!")
                                                        refetch()
                                                    }}
                                                >
                                                    Stop ({item?.status})
                                                </Button>
                                            </Tooltip>
                                        )}
                                        {item?.status === "done" && (
                                            <Popconfirm
                                                title={`Git Pull ${item?.url} ?`}
                                                onConfirm={async () => {
                                                    await axios.post(`/git-pull/${item?.store_id}`)
                                                    message.success("Git pull success!")
                                                    refetch()
                                                }}
                                            >
                                                <Button color="cyan" variant="solid" size="small">
                                                    Git Pull
                                                </Button>
                                            </Popconfirm>
                                        )}
                                        <Popconfirm
                                            title={`Delete Store ${item?.name} ?`}
                                            onConfirm={async () => {
                                                await axios.post(`/delete-store/${item?.store_id}`)
                                                message.success("Delete success!")
                                                refetch()
                                            }}
                                        >
                                            <Button color="red" variant="solid" size="small">
                                                Delete
                                            </Button>
                                        </Popconfirm>

                                    </Space>}
                                    bodyStyle={{
                                        padding: "12px 16px",
                                    }}
                                    cover={<div style={{ height: "15rem" }}>
                                        {item?.status == "running" ? <>
                                            <Skeleton active></Skeleton>
                                        </> :
                                            <img style={{ height: "100%", width: "100%", objectFit: "cover" }} alt={item?.name || item?.store_id} src={`${baseURL}${item?.img || ""}`} />
                                        }
                                    </div>}
                                >
                                    <Meta title={<Flex gap={"small"} wrap>
                                        <Tooltip title={<>
                                            Store ID: {item.store_id}
                                            <br />
                                            path: {item.path}
                                        </>}>
                                            <span>{item.name}</span>
                                        </Tooltip>
                                        {item?.status != "running" &&
                                            <>
                                                {onOk && <Popconfirm
                                                    okButtonProps={{ color: "blue", variant: "solid" }}
                                                    okText="Install"
                                                    title={`Install ${item.name} ?`}
                                                    onConfirm={async () => {
                                                        const endpoint = normalizedStoreType === "script"
                                                            ? `/workflow/install-script/${item.id}`
                                                            : `/workflow/install-workflow/${item.id}`
                                                        await http.post(
                                                            endpoint,
                                                            {
                                                                // force: true,
                                                                // store_id: item.store_id,
                                                            },
                                                            {
                                                                timeout: 60000,
                                                            }
                                                        )
                                                        message.success(`Install success!`)
                                                        onOk && onOk()
                                                    }}
                                                >
                                                    <Button size="small" color={item?.installed ?"red":"blue"} variant="solid" icon={<DownloadOutlined />} >{item?.installed ?"ReInstall":"Install"}</Button>
                                                </Popconfirm>}

                                                {onOk && normalizedStoreType === "script" && <Popconfirm
                                                    okButtonProps={{ color: "cyan", variant: "solid" }}
                                                    okText="Install as New Script"
                                                    title={`Install ${item.name} as a new script?`}
                                                    onConfirm={async () => {
                                                        await http.post(
                                                            `/workflow/install-script/${item.id}?create=true`,
                                                            {},
                                                            {
                                                                timeout: 60000,
                                                            }
                                                        )
                                                        message.success(`Installed as new script successfully!`)
                                                        onOk && onOk()
                                                    }}
                                                >
                                                    <Button size="small" color="cyan" variant="outlined" icon={<DownloadOutlined />}>Install as New Script</Button>
                                                </Popconfirm>}

                                                {/* {onCancel && <Button size="small" color="blue" variant="solid" onClick={() => {
                                                    onCancel && onCancel()
                                                }}>Close</Button>} */}
                                            </>
                                        }
                                    </Flex>} description={item?.description} style={{ marginBottom: "1rem" }} />
                                    {item?.status != "running" &&
                                        <>
                                            {item?.category && <Tag style={{
                                                wordBreak: "break-word",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                maxWidth: 100,
                                                display: "inline-block",
                                                cursor: "default"
                                            }} color="blue">
                                                {item?.category}
                                            </Tag>}

                                            {Array.isArray(item.tags) && item.tags.map((tag: any, index: any) => (
                                                <Tooltip key={index} title={tag}>
                                                    <Tag style={{
                                                        wordBreak: "break-word",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        maxWidth: 100,
                                                        display: "inline-block",
                                                        cursor: "default"
                                                    }} color={colors[index]}>{tag}</Tag>
                                                </Tooltip>
                                            ))}
                                        </>
                                    }
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </Spin>}

            </> : <Skeleton active></Skeleton>}
            {total != 0 && <Flex style={{ marginTop: "1rem" }} align="center">
                A total of {total} records &nbsp;
                <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    onChange={(p) => setPage(p)}
                    showSizeChanger={false}
                />
            </Flex>}
        </Card>
    </>

})
export default StorePages
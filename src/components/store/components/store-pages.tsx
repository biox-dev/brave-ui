import { usePageQuery } from "@/hooks/usePaginationV2"
import { Button, Card, Empty, Flex, Input, Pagination, Popconfirm, Skeleton, Space, Table, Tag, Tooltip } from "antd"
import type { ColumnsType } from "antd/es/table"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import { useSelector } from "react-redux"
import { colors } from '@/utils/utils'
import {
    CloudUploadOutlined,
    DeleteOutlined,
    DownloadOutlined,
    LoadingOutlined,
    PlusOutlined,
    RedoOutlined,
    ReloadOutlined,
} from '@ant-design/icons'
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useComponentStore } from "@/event-bus/stores/components"
import { http } from "@/api/client/http"
import { ComponentImage } from "@/components/common/component-image"
import { invoke } from "@/core/ui-system/invokeV2"
import { useI18n } from "@/hooks/useI18n"
import { formatRelativeTime } from "@/utils/time"

type StoreType = "workflow" | "script"

interface StorePageItem {
    id: string
    store_id: string
    store_type?: StoreType
    name?: string
    origin?: string
    status?: string
    path?: string
    path_name?: string
    store_path?: string
    category?: string
    tags?: any
    img?: string
    remotes?: { name: string; urls: string[] }[]
    publish_urls?: any
    log?: string
    version?: string
    update_info?: string
    created_at?: string
    updated_at?: string
    description?: string
    installed?: boolean
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
    const { projectId } = useSelector((state: any) => state.user)

    const { data, total, page, pageSize, isLoading, isFetching, refetch, setPage, setQuery } = usePageQuery<StorePageItem, StorePageQuery>({
        queryKey: ["store-page", normalizedStoreType],
        query: {
            store_type: normalizedStoreType,
        },
        initialPageSize: 20,
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
        scopeKey: projectId,
        staleTime: 30_000,
        cacheTime: 5 * 60_000,
    })

    const { Search } = Input
    const message = useGlobalMessage()
    const { locale } = useI18n()

    useEffect(() => {
        setQuery({ store_type: normalizedStoreType })
    }, [normalizedStoreType, setQuery])

    // The backend resolves the active project from the session (GetActiveProjectByUserID),
    // so projectId is not sent with the request. When the active project changes we reset
    // to the first page and refresh the list so per-project data (e.g. `installed`) is current.
    // useEffect(() => {

    //     if (page === 1) {
    //         refetch()
    //     } else {
    //         // Changing the page changes the query key, which triggers the refetch.
    //         setPage(1)
    //     }
    // }, [projectId, page, refetch, setPage])

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

    // 发布到远程：打开 publish-store-remote 抽屉，把目标地址写成 store 裸仓库的 git remote。
    const openPublishRemote = (item: StorePageItem) => {
        invoke.publishStore.open(
            { store_id: item?.id },
            {
                footer: null,
                width: 640,
                title: `Publish Remote · ${item?.name || item?.id}`,
            },
        )
    }

    const columns = useMemo<ColumnsType<StorePageItem>>(() => [
        {
            title: "Cover",
            dataIndex: "img",
            key: "cover",
            width: 88,
            render: (_: unknown, item) => (
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid #f0f0f0",
                    background: "#fafafa",
                }}>
                    {item?.status === "running" ? (
                        <Skeleton.Image active style={{ width: 64, height: 64 }} />
                    ) : (
                        // 封面地址由 int64 主键推导（后端定位 {path}/{store_type}/{img}），
                        // 文件不存在时后端返回占位图
                        <ComponentImage
                            kind="store"
                            id={item?.id}
                            img={item?.img}
                            alt={item?.name || item?.store_id}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                    )}
                </div>
            ),
        },
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            render: (_: unknown, item) => {
                const tagList: any[] = Array.isArray(item.tags) ? item.tags : []
                const visibleTags = tagList.slice(0, 3)
                const restTags = tagList.slice(3)
                return (
                    <Flex vertical gap={4} style={{ minWidth: 0 }}>
                        <Tooltip title={<>
                            Store ID: {item.id}<br />
                            Path: {item.store_path || "-"}
                        </>}>
                            <span style={{
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {item.name || item.store_id || "-"}
                            </span>
                        </Tooltip>
                        {item.description && (
                            <span
                                title={item.description}
                                style={{
                                    fontSize: 12,
                                    color: "rgba(0, 0, 0, 0.45)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {item.description}
                            </span>
                        )}
                        {(item.origin || item.category || tagList.length > 0) && (
                            <Flex gap={4} wrap>
                                {item.origin && <Tag color="blue" bordered={false} style={{ marginInlineEnd: 0 }}>{item.origin}</Tag>}
                                {item.category && <Tag color="geekblue" bordered={false} style={{ marginInlineEnd: 0 }}>{item.category}</Tag>}
                                {visibleTags.map((tag: any, index: number) => (
                                    <Tag key={`${tag}-${index}`} color={colors[index % colors.length]} bordered={false} style={{ marginInlineEnd: 0 }}>
                                        {tag}
                                    </Tag>
                                ))}
                                {restTags.length > 0 && (
                                    <Tooltip title={restTags.join(", ")}>
                                        <Tag bordered={false} style={{ marginInlineEnd: 0 }}>+{restTags.length}</Tag>
                                    </Tooltip>
                                )}
                            </Flex>
                        )}
                    </Flex>
                )
            },
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 110,
            render: (status?: string) => status ? (
                <Tag
                    color={status === "running" ? "processing" : "success"}
                    icon={status === "running" ? <LoadingOutlined /> : undefined}
                    bordered={false}
                    style={{ marginInlineEnd: 0 }}
                >
                    {status}
                </Tag>
            ) : <span style={{ color: "rgba(0, 0, 0, 0.25)" }}>-</span>,
        },
        {
            title: "Updated",
            dataIndex: "updated_at",
            key: "updated_at",
            width: 140,
            render: (value?: string) => (
                <span style={{ fontSize: 12, color: "rgba(0, 0, 0, 0.45)" }}>
                    {value ? formatRelativeTime(value, locale) : "-"}
                </span>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 168,
            align: "right",
            render: (_: unknown, item) => (
                <Space size={0}>
                    {onOk && item?.status !== "running" && (
                        <Popconfirm
                            okButtonProps={{ color: "blue", variant: "solid" }}
                            okText="Install"
                            title={`Install ${item.name} ?`}
                            onConfirm={async () => {
                                const endpoint = normalizedStoreType === "script"
                                    ? `/workflow/install-script/${item.id}`
                                    : `/workflow/install-workflow/${item.id}`
                                await http.post(endpoint, {}, { timeout: 60000 })
                                message.success(`Install success!`)
                                onOk && onOk()
                                refetch()
                            }}
                        >
                            <Tooltip title={item?.installed ? "ReInstall" : "Install"}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    style={{ color: item?.installed ? "#fa8c16" : "#1677ff" }}
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                    {onOk && normalizedStoreType === "script" && item?.status !== "running" && (
                        <Popconfirm
                            okButtonProps={{ color: "cyan", variant: "solid" }}
                            okText="Install as New Script"
                            title={`Install ${item.name} as a new script?`}
                            onConfirm={async () => {
                                await http.post(`/workflow/install-script/${item.id}?create=true`, {}, { timeout: 60000 })
                                message.success(`Installed as new script successfully!`)
                                onOk && onOk()
                            }}
                        >
                            <Tooltip title="Install as New Script">
                                <Button type="text" size="small" icon={<PlusOutlined />} style={{ color: "#13c2c2" }} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                    {/* store 表已删除 url：能从上游拉取的只有远程下载的 store，
                        本地发布（origin=local）没有上游，不展示 ReDownload。 */}
                    {item?.origin !== "local" && (
                        <Popconfirm
                            title={`ReDownload ${item?.name || item?.id} ?`}
                            onConfirm={async () => {
                                await http.post(`/store/redownload`, { id: item?.id })
                                message.success("ReDownload success!")
                                refetch()
                            }}
                        >
                            <Tooltip title="ReDownload">
                                <Button type="text" size="small" icon={<ReloadOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                    <Tooltip title="Publish to remote (github / gitee)">
                        <Button
                            type="text"
                            size="small"
                            icon={<CloudUploadOutlined />}
                            onClick={() => openPublishRemote(item)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete Store ${item?.name || item?.id} ?`}
                        onConfirm={async () => {
                            await http.post(`/store/delete`, { id: item?.id })
                            message.success("Delete success!")
                            refetch()
                        }}
                    >
                        <Tooltip title="Delete">
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [locale, message, normalizedStoreType, onOk, refetch])

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
                {/* <Tag color="blue">{projectId}</Tag> */}
            </Space>}
            size="small" extra={<Space>
                <Button size="small" color="cyan" variant="solid" icon={<RedoOutlined />} onClick={() => refetch()}></Button>

            </Space>}>

            {data ? (
                <Table<StorePageItem>
                    rowKey={(item) => String(item.id)}
                    size="small"
                    tableLayout="fixed"
                    scroll={{ x: 920 }}
                    columns={columns}
                    dataSource={data}
                    loading={isLoading || isFetching}
                    pagination={false}
                    locale={{
                        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />,
                    }}
                />
            ) : <Skeleton active />}
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
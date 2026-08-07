import { DownloadOutlined, RedoOutlined } from "@ant-design/icons";
import { Button, Card, Col, Empty, Flex, Popconfirm, Row, Skeleton, Space, Spin, Tag, Tooltip, Typography } from "antd";
import Meta from "antd/es/card/Meta";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { colors } from "@/utils/utils";
import axios from "axios";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useSelector } from "react-redux";
import { useComponentStore } from "@/store-zustand/components";
import { useNavigate } from "react-router";
import { http } from "@/api/client/http";

interface StoreContentProps {
    storeId?: string;
    // refreshToken: number;
    onStoreDeleted?: () => void;
    onOk?: () => void;
    onCancel?: () => void;

}

const StoreContent: FC<StoreContentProps> = ({
    storeId,
    // refreshToken,
    onStoreDeleted,
    onOk,
    onCancel,
}) => {
    const message = useGlobalMessage();
    const { baseURL } = useSelector((state: any) => state.user);
    const [componentLoading, setComponentLoading] = useState(false);
    const [store, setStore] = useState<any>();
    const [components, setComponents] = useState<any[]>([]);
    const navigate = useNavigate()


    const loadData = useCallback(
        async (storeId?: string) => {
            if (!storeId) {
                setStore(undefined);
                setComponents([]);
                return;
            }
            setComponentLoading(true);
            try {
                const resp = await axios.post(`/component-store/details-by-store-id/${storeId}?type=tools`);
                setComponents(resp.data.data || []);
                setStore(resp.data);
            } finally {
                setComponentLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        loadData(storeId);
    }, [loadData, storeId]);
    const { register, unregister } = useComponentStore();

    const instance = useMemo(() => {
        return {
            clone: () => {
                loadData(storeId)
                // setContentRefreshToken((value) => value + 1)
                // setSidebarRefreshToken((value) => value + 1)
            }, pull: () => {
                loadData(storeId)
                // setContentRefreshToken((value) => value + 1)
            }, stop: () => {
                // setSidebarRefreshToken((value) => value + 1)
            }
        };
    }, [storeId]);


    useEffect(() => {
        if (storeId) {
            register("store", storeId, instance);
            return () => {
                unregister("store", storeId, instance);
            };
        }
    }, [storeId, instance, register, unregister]);


    const filteredComponents = useMemo(() => {
        return components;
    }, [components]);

    const getImgPath = (img: string) => {
        if (!img) {
            return "";
        }
        if (img.startsWith("http")) {
            return img;
        }
        return `${baseURL}${img}`;
    };

    return (

        <Card
            title={
                <Space>
                    {store?.store?.name && (
                        <Tooltip title={<>
                            {store?.store?.url}<br></br>
                            {store?.store?.path}
                        </>}>

                            <a href={store?.store?.url} target="_blank" rel="noopener noreferrer">
                                {store?.store?.name}
                            </a>
                        </Tooltip>
                    )}
                    {store?.store?.version && <Tooltip title={<>
                        {store?.store?.update_info}
                    </>}>

                        <Tag>{store?.store?.version}</Tag>
                    </Tooltip>}


                </Space>
            }
            size="small"
            extra={
                <Space>
                    {storeId && store?.store?.status != "done"  && (
                        <Button
                            color="red"
                            variant="solid"
                            size="small"
                            onClick={async () => {
                                await axios.post(`/git-stop/${store?.store?.store_id}`);
                                message.success("Stop success!");
                            }}
                        >
                            Stop
                        </Button>
                    )}
                    {storeId && store?.store?.status === "done" && (
                        <Popconfirm
                            title={`ReDownload ${store?.store?.url} ?`}
                            onConfirm={async () => {
								await http.post(`/store/redownload`, {
									id: store?.store?.id || storeId,
								});
								message.success("ReDownload success!");
                                loadData(storeId);
                            }}
                        >
                            <Button color="cyan" variant="solid" size="small">
                                ReDownload
                            </Button>
                        </Popconfirm>
                    )}
                    {storeId && (
                        <Popconfirm
                            title={`Delete Store ${store?.name || storeId} ?`}
                            onConfirm={async () => {
								await http.post(`/store/delete`, {
									id: store?.store?.id || storeId,
								});
                                message.success("Delete success!");
                                setStore(undefined);
                                setComponents([]);
                                if (onStoreDeleted) {
                                    onStoreDeleted();
                                }
                            }}
                        >
                            <Button color="red" variant="solid" size="small">
                                Delete
                            </Button>
                        </Popconfirm>
                    )}

                    <Button
                        size="small"
                        icon={<RedoOutlined />}
                        loading={componentLoading}
                        onClick={() => loadData(storeId)}
                    />
                </Space>
            }
        >
            {/* <Button onClick={() => { console.log(useComponentStore.getState().print()) }}>componentStore</Button> */}

            <Spin spinning={componentLoading}>
                <>



                    {Array.isArray(filteredComponents) && filteredComponents.length !== 0 ? (
                        <Row gutter={16} style={{ position: "relative" }}>

                            {store?.store?.status != "done" ? <Skeleton active></Skeleton> : <>

                                {filteredComponents.map((item: any, index: any) => (
                                    <Col key={index} lg={6} sm={4} xs={24} style={{ marginBottom: "1rem", cursor: "pointer" }}>

                                        <Card
                                            size="small"
                                            hoverable
                                            className="custom-card"
                                            title={<Space>
                                                <Tooltip title={item?.relation_id}>{item.name}</Tooltip>
                                                <Tag color={item.installed ? "#108ee9" : "#f5222d"}>
                                                    {item.installed ? "Installed" : "Not Installed"}
                                                </Tag>
                                            </Space>}
                                            style={{
                                                height: "100%",
                                                border: "1px solid #f0f0f0",
                                                borderRadius: "12px",
                                                overflow: "hidden",
                                                transition: "all 0.3s ease",
                                            }}
                                            cover={
                                                <div style={{ height: "15rem" }}>
                                                    <img
                                                        style={{ height: "100%", width: "100%", objectFit: "cover" }}
                                                        alt={item.label}
                                                        src={getImgPath(item.img)}
                                                    />
                                                </div>
                                            }
                                        >
                                            <Meta
                                                title={
                                                    <Flex gap={"small"} align={"center"}>

                                                        {onOk && <Popconfirm
                                                            okButtonProps={{ color: `${item.installed ? "red" : "blue"}`, variant: "solid" }}
                                                            okText={item.installed ? "Reinstall" : "Install"}
                                                            title={item.installed ? `Reinstall ${item.name} ?` : `Install ${item.name} ?`}
                                                            onConfirm={async () => {
                                                                await axios.post(
                                                                    `/install-relation`,
                                                                    {
                                                                        path: item.file_path,
                                                                        force: true,
                                                                        store_id: storeId,
                                                                    },
                                                                    {
                                                                        timeout: 60000,
                                                                    }
                                                                );
                                                                message.success(item.installed ? `Reinstall success!` : `Install success!`);
                                                                onOk && onOk();
                                                            }}
                                                        >
                                                            {/* <DownloadOutlined style={{ cursor: "pointer" }} /> */}
                                                            <Button size="small" color="blue" variant="solid" icon={<DownloadOutlined />} >{item.installed ? "Reinstall" : "Install"}</Button>
                                                        </Popconfirm>}

                                                        {item.installed && onCancel && <>
                                                            <Button size="small" color="blue" variant="solid" onClick={() => {
                                                                navigate(`/c/tools/${item.relation_id}`)
                                                                onCancel && onCancel()
                                                            }}>Go Tools</Button>
                                                        </>}



                                                    </Flex>
                                                }
                                                description={item?.description}
                                                style={{ marginBottom: "1rem" }}
                                            />

                                            {item.tags &&
                                                Array.isArray(item.tags) &&
                                                item.tags.map((tag: any, tagIndex: any) => (
                                                    <Tooltip key={tagIndex} title={tag}>
                                                        <Tag
                                                            style={{
                                                                wordBreak: "break-word",
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                maxWidth: 100,
                                                                display: "inline-block",
                                                                cursor: "default",
                                                            }}
                                                            color={colors[tagIndex]}
                                                        >
                                                            {tag}
                                                        </Tag>
                                                    </Tooltip>
                                                ))}
                                        </Card>
                                    </Col>
                                ))}

                            </>}

                        </Row>
                    ) : (
                        <Empty />
                    )}



                </>
            </Spin>
        </Card>

    );
};

export default StoreContent;
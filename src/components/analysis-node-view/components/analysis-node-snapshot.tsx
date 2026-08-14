import { Button, Card, Col, Empty, Popconfirm, Progress, Row, Space, Spin, Switch, Tooltip, Typography } from "antd";
import axios from "axios";
import { FC, useEffect, useMemo, useState } from "react";
import { ExportOutlined, LoadingOutlined, RedoOutlined } from "@ant-design/icons";
import { useComponentStore } from "@/event-bus/stores/components";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useSelector } from "react-redux";
import { stopAnalysisApi } from "@/api/analysisv1";
const STATUS_ORDER = [
    "pending",
    "ready",
    "submitted",
    "running",
    "cached",
    "done",
    "failed"
    // "skipped"

];


const AnalysisNodeSnapshot: FC<any> = ({ analysis_id }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const message = useGlobalMessage()
    const [isCache, setIsCache] = useState(false);
    const { containerURL } = useSelector((state: any) => state.user);

    const loadData = async () => {
        // /analysis-runtime/snapshot
        setLoading(true);
        try {
            const resp = await axios.post("/analysis-runtime/snapshot", {
                analysis_id
            })
            setData(resp.data);
            setIsCache(resp.data.is_cache)
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        if (analysis_id) {
            loadData();

        }
    }, [analysis_id])

    const { register, unregister } = useComponentStore();

    const instance = useMemo(() => {
        // const analysis_node_id = selectedSample?.analysis_node_id
        return {
            analysisDone: (args: any) => {
                console.log("AnalysisNodeSnapshot analysisDone", args, data)
                loadData()

            },
            analysisStarted: (args: any) => {
                console.log("AnalysisNodeSnapshot analysisStarted", args, data)
                loadData()
            }, dagStarted: (args: any) => {
                console.log("AnalysisNodeSnapshot dagStarted", args, data)
                loadData()
            }, dagDone: (args: any) => {
                console.log("AnalysisNodeSnapshot dagDone", args, data)
                loadData()
            }
        }
    }, [analysis_id])

    useEffect(() => {

        register("analysis", analysis_id, instance);
        return () => {
            unregister("analysis", analysis_id, instance);
        }
    }, [analysis_id]);

    if (!analysis_id) {
        return <Empty description="No analysis ID provided" />
    }

    // if (loading) {
    //     return <Spin />;
    // }

    // if (!data) {
    //     return <Empty description="No snapshot data" />;
    // }


    const statusCount = data?.status_count || {};
    const completionPercent = Number(data?.completion_percent || 0);
    // 按照预定义顺序展示状态，未定义状态排在后面
    const statusItems = Object.entries(statusCount).sort(([a], [b]) => {
        const aIndex = STATUS_ORDER.indexOf(a);
        const bIndex = STATUS_ORDER.indexOf(b);
        const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        return safeA - safeB;
    });

    return <>
        <Card title="Analysis Snapshot" size="small"
            extra={<Space>
                {data?.server_status == "running" ?

                    <>

                        <Button size="small" color="red" variant="solid" onClick={async () => {
                            // /run-dag-server/{analysis_id}
                            // await axios.post(`/run-dag-server/${analysis_id}`)
                            await stopAnalysisApi(analysis_id, "server")

                        }}>Stop Dag Server</Button>
                        <Tooltip title={<>
                            {`${containerURL}/container/server-${analysis_id}/`}
                        </>}>
                            <ExportOutlined style={{ cursor: "pointer" }} onClick={() => {

                                window.open(`${containerURL}/container/server-${analysis_id}/`, "_blank")
                            }} />
                        </Tooltip>
                    </>

                    :
                    <Button size="small" color="cyan" variant="solid" onClick={async () => {
                        // /run-dag-server/{analysis_id}
                        await axios.post(`/run-dag-server/${analysis_id}`)
                    }}>Dag Server</Button>


                }





                {data?.status != "running" ?
                    <Popconfirm title="Are you sure to run the entire DAG again?"
                        onConfirm={async () => {
                            // /run-dag/{analysis_id}
                            await axios.post(`/run-dag/${analysis_id}?is_cache=${isCache}`)
                        }}
                    >
                        <Button size="small" color="cyan" variant="solid">Run Dag</Button>

                    </Popconfirm> :
                    <>
                        <Popconfirm title="Are you sure to stop the analysis?" onConfirm={async () => {
                            await axios.post(`/analysis-runtime/running-dags/${analysis_id}/stop`)
                            message.success("Analysis stopped!")
                        }}>
                            <Button size="small" color="red" variant="solid" >
                                Stop
                            </Button>
                        </Popconfirm>


                    </>

                }
                <Switch size="small" checkedChildren="cache" unCheckedChildren="no-cache" disabled={data?.status == "running"} checked={isCache} onChange={setIsCache} />

                <Button onClick={loadData} icon={<RedoOutlined />} size="small" loading={loading}></Button>
            </Space>}
        >
            <Spin spinning={loading} tip="Loading snapshot data...">
                <Row gutter={[12, 12]}>
                    <Col span={24}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 6
                            }}
                        >
                            <Typography.Text type="secondary">
                                {!data?.running_info ? "Analysis Completed" : <Spin indicator={<LoadingOutlined spin />} size="small" />}

                            </Typography.Text>
                            <Typography.Text strong>{completionPercent}%</Typography.Text>
                        </div>
                        <Progress
                            percent={Math.max(0, Math.min(100, completionPercent))}
                            status={data?.running_info ? "active" :
                                data?.status === "done" ? "success" : "normal"}
                            size="small"
                        />
                    </Col>

                    {statusItems.map(([key, value]) => (
                        <Col xs={12} sm={8} md={4} lg={3} key={key}>
                            <Card size="small" bordered styles={{ body: { padding: "8px 12px" } }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between"
                                    }}
                                >
                                    <Typography.Text type="secondary">{key}</Typography.Text>
                                    <Typography.Text strong>{Number(value || 0)}</Typography.Text>
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Spin>

        </Card>
    </>
}

export default AnalysisNodeSnapshot;
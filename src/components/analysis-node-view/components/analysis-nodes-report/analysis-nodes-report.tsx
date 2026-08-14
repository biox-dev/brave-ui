import { Button, Card, Col, Empty, Flex, Menu, Row, Skeleton, Space, Tooltip, Typography } from "antd";
import { FC, useEffect, useMemo, useState } from "react";
import { RedoOutlined } from '@ant-design/icons'
import { useStoreRender } from "@/context/render/RenderProvider";
import AnalysisNodeDetails from "./analysis-node-details";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import { useComponentStore } from "@/event-bus/stores/components";
import { getVisualizationNodeTreeV1Api } from "@/api/analysisv1";

type NodeResultAsset = {
    images?: any[];
    tables?: any[];
    htmls?: any[];
};

type AnalysisNodeSample = {
    id: string;
    analysis_node_id: string;
    analysis_id: string;
    node_id: string;
    script_id: string;
    status: string;
    sample_id?: string;
    output_dir?: string;
    script_name?: string;

    result?: NodeResultAsset;
    node?: any;
    node_name?: string;
    server_status: string;
};

type AnalysisNodeGroup = {
    script_id: string;
    script_name: string;
    children?: AnalysisNodeSample[];
};

type ReportTreeNode = {
    key: string;
    title: string;
    nodeType: "node" | "sample";
    scriptId?: string;
    sampleId?: string;
    status?: string;
    sampleCount?: number;
    images?: number;
    tables?: number;
    htmls?: number;
    children?: ReportTreeNode[];
};

type ReportMenuItem = {
    key: string;
    label: React.ReactNode;
    children?: ReportMenuItem[];
};

const statusColorMap: Record<string, string> = {
    done: "success",
    success: "success",
    failed: "error",
    running: "processing",
    pending: "default",
    skipped: "warning",
};

const getSampleLabel = (sample: AnalysisNodeSample, index: number) => {
    const sampleId = sample.sample_id?.trim();
    if (sampleId) {
        return sampleId;
    }
    return `global-${index + 1}`;
};

const makeNodeKey = (scriptId: string) => `node:${scriptId}`;
const makeSampleKey = (sampleId: string) => `sample:${sampleId}`;

const countAssets = (samples: AnalysisNodeSample[]) => {
    return samples.reduce(
        (acc, sample) => {
            acc.images += sample.result?.images?.length || 0;
            acc.tables += sample.result?.tables?.length || 0;
            acc.htmls += sample.result?.htmls?.length || 0;
            return acc;
        },
        { images: 0, tables: 0, htmls: 0 }
    );
};

const buildReportTreeData = (groups: AnalysisNodeGroup[]): ReportTreeNode[] => {
    return groups.map((item) => {
        const samples = item.children || [];
        const assets = countAssets(samples);
        return {
            key: makeNodeKey(item.script_id),
            title: item.script_name || item.script_id,
            nodeType: "node",
            scriptId: item.script_id,
            sampleCount: samples.length,
            images: assets.images,
            tables: assets.tables,
            htmls: assets.htmls,
            children: samples.map((sample) => ({
                key: makeSampleKey(String(sample.id)),
                title: sample.node_name || sample.analysis_node_id,
                nodeType: "sample",
                scriptId: item.script_id,
                sampleId: String(sample.id),
                status: sample.status,
                images: sample.result?.images?.length || 0,
                tables: sample.result?.tables?.length || 0,
                htmls: sample.result?.htmls?.length || 0,
            })),
        };
    });
};

const buildReportMenuItems = (treeData: ReportTreeNode[]): ReportMenuItem[] => {
    return treeData.map((node) => ({
        key: node.key,
        label: (
            <Flex justify="space-between" align="center" gap={8} style={{ width: "100%", minWidth: 0 }}>
                <Tooltip title={node.title}>
                    <Typography.Text
                        style={{
                            flex: 1,
                            minWidth: 0,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {node.title}
                    </Typography.Text>
                </Tooltip>
            </Flex>
        ),
        children: (node.children || []).map((child) => ({
            key: child.key,
            label: (
                <Flex justify="space-between" align="center" gap={8} style={{ width: "100%", minWidth: 0 }}>
                    <Tooltip title={child.title}>
                        <Typography.Text
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {child.title}
                        </Typography.Text>
                    </Tooltip>
                </Flex>
            ),
        })),
    }));
};

export interface AnalysisNodesReportProps {
    analysis_id: string;
}

const AnalysisNodesReport: FC<AnalysisNodesReportProps> = ({ analysis_id }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AnalysisNodeGroup[]>([]);
    const [reportTreeData, setReportTreeData] = useState<ReportTreeNode[]>([]);
    const [reportMenuItems, setReportMenuItems] = useState<ReportMenuItem[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string>();
    const [selectedSampleId, setSelectedSampleId] = useState<string>();
    const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);
    const { setAnalysisNodeId } = useStoreRender()
    const { setRelation } = useStoreRender()

    // const normalizeSampleDetail = (rawData: any): Partial<AnalysisNodeSample> => {
    //     const payload = rawData?.result ?? rawData;
    //     if (!payload || typeof payload !== "object") {
    //         return {};
    //     }

    //     if (payload.result) {
    //         return payload as Partial<AnalysisNodeSample>;
    //     }

    //     if (Array.isArray(payload.images) || Array.isArray(payload.tables) || Array.isArray(payload.htmls)) {
    //         return {
    //             result: {
    //                 images: payload.images,
    //                 tables: payload.tables,
    //                 htmls: payload.htmls,
    //             },
    //         };
    //     }

    //     return payload as Partial<AnalysisNodeSample>;
    // };

    const loadData = async () => {
        if (!analysis_id) {
            setData([]);
            setReportTreeData([]);
            setReportMenuItems([]);
            return;
        }
        setLoading(true)
        try {
            const res = await getVisualizationNodeTreeV1Api(analysis_id)

            const nextData = Array.isArray(res.data?.result) ? res.data.result : [];
            setData(nextData)
            const nextReportTreeData = buildReportTreeData(nextData);
            setReportTreeData(nextReportTreeData);
            setReportMenuItems(buildReportMenuItems(nextReportTreeData));
            setRelation({
                relation_id: res.data?.relation_id,
            })
            // setSampleDetailMap({})
            // setTitle(res.data.analysis_name + " - Report")
        } finally {
            setLoading(false)
        }
    }


    const { register, unregister } = useComponentStore();

    const instance = useMemo(() => {
        // const analysis_node_id = selectedSample?.analysis_node_id
        return {
            analysisSubmitted: (args: any) => {
                console.log("AnalysisNodeSnapshot analysisStarted", args, data)
                loadData()
            },
            // dagStarted: (args: any) => {
            //     console.log("AnalysisNodeSnapshot dagStarted", args, data)
            //     loadData()
            // },
            reload: () => {
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

    useEffect(() => {
        if (analysis_id) {
            loadData()
            return;
        }

        setData([]);
        setReportTreeData([]);
        setReportMenuItems([]);
        setSelectedNodeId(undefined);
        setSelectedSampleId(undefined);
        setOpenMenuKeys([]);

    }, [analysis_id])

    const selectedNode = useMemo(() => {
        if (!data.length) {
            return null;
        }
        return data.find((item) => item.script_id === selectedNodeId) || data[0];
    }, [data, selectedNodeId]);

    const selectedNodeSamples = selectedNode?.children || [];

    const selectedSample = useMemo(() => {
        if (!selectedNodeSamples.length) {
            return null;
        }
        return selectedNodeSamples.find((item) => String(item.id) === selectedSampleId) || selectedNodeSamples[0];
    }, [selectedNodeSamples, selectedSampleId]);

    useEffect(() => {
        if (!selectedNode && data.length) {
            setSelectedNodeId(data[0].script_id);
            return;
        }
        if (selectedNode && selectedNode.script_id !== selectedNodeId) {
            setSelectedNodeId(selectedNode.script_id);
        }
    }, [data, selectedNode, selectedNodeId]);

    useEffect(() => {
        if (!selectedSample && selectedNodeSamples.length) {
            setSelectedSampleId(String(selectedNodeSamples[0].id));
            return;
        }
        if (selectedSample && String(selectedSample.id) !== selectedSampleId) {
            setSelectedSampleId(String(selectedSample.id));
        }
    }, [selectedNodeSamples, selectedSample, selectedSampleId]);

    useEffect(() => {
        if (!selectedNodeId) {
            setOpenMenuKeys(reportTreeData.map((item) => item.key));
            return;
        }
        setOpenMenuKeys([makeNodeKey(selectedNodeId)]);
        return () => {
            // setAnalysisNodeId(null)
        }
    }, [selectedNodeId, reportTreeData]);

    const selectedTreeKey = selectedSample?.id
        ? makeSampleKey(String(selectedSample.id))
        : selectedNode?.script_id
            ? makeNodeKey(selectedNode.script_id)
            : undefined;

    if (loading && !data.length) {
        return <Skeleton active></Skeleton>
    }

    if (!analysis_id) {
        return <Skeleton active></Skeleton>
    }
    return <>
        {/* <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
                DAG Analysis Report {selectedSampleId}
            </Typography.Title>
        </Flex> */}
        {/* <Button onClick={()=>{setLoading(true)}}>test</Button> */}

        {!data.length ? <Empty description="No node report data" /> :
            <Row gutter={[12, 12]} align="top">


                <Col xs={24} lg={8} xl={7}>
                    <Card
                        size="small"
                        title={`Analysis (${analysis_id})`}
                        styles={{ body: { padding: "8px" } }}
                        extra={<Space>
                            <Button loading={loading} onClick={loadData} icon={<RedoOutlined />} size="small"></Button>

                        </Space>}
                    >
                        <Menu
                            mode="inline"
                            items={reportMenuItems}
                            selectedKeys={selectedTreeKey ? [selectedTreeKey] : []}
                            openKeys={openMenuKeys}
                            onOpenChange={(keys) => setOpenMenuKeys(keys.map((key) => String(key)))}
                            onClick={({ key }) => {
                                const keyString = String(key);
                                console.log(keyString)
                                if (keyString.startsWith("node:")) {
                                    setSelectedNodeId(keyString.replace("node:", ""));
                                    setSelectedSampleId(undefined);
                                    return;
                                }
                                if (keyString.startsWith("sample:")) {
                                    const sampleId = keyString.replace("sample:", "");
                                    const ownerNode = reportTreeData.find((node) =>
                                        (node.children || []).some((child) => child.sampleId === sampleId)
                                    );
                                    if (ownerNode?.scriptId) {
                                        setSelectedNodeId(ownerNode.scriptId);
                                    }
                                    setSelectedSampleId(sampleId);
                                }
                            }}
                            style={{
                                maxHeight: "65vh",
                                overflowY: "auto",
                                paddingRight: 4,
                            }}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={16} xl={17}>
                    <AnalysisNodeDetails analysis_node_id={selectedSample?.id ? String(selectedSample.id) : undefined} />
                </Col>
            </Row>}

    </>
}

export default AnalysisNodesReport
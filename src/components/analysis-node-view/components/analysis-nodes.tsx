import { usePagination } from "@/hooks/usePagination";
import { Button, Card, Col, Empty, Flex, Pagination, Popconfirm, Row, Statistic, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useMemo } from "react";
import { ExportOutlined, RedoOutlined } from '@ant-design/icons'
import axios from "axios";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useSelector } from "react-redux";
import { CreateOrUpdatePipelineComponent } from "@/components/create-pipeline";
import { useModals } from "@/hooks/useModal";
import ModuleEdit from "@/components/module-edit";
import { findAnalysisById, runAnalysisApi, runAnalysisNodeApi, stopAnalysisApi, stopAnalysisNodeApi } from "@/api/analysisv1";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import { useUI } from "@/core/ui-system/useUI";
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/event-bus/stores/components";

type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue };

interface AnalysisNode {
    id: number;
    node_id: string;
    sample_id: string | null;
    script_id: string;
    analysis_node_id: string,
    status: string;
    upstream_ids?: string[];
    downstream_ids?: string[];
    params?: JsonValue;
    resolved_inputs?: JsonValue;
    node_name?: string;
    resolved_outputs?: JsonValue;
    container_image?: string;
    workspace_dir?: string;
    created_at?: string | null;
    updated_at?: string | null;
}

const statusColorMap: Record<string, string> = {
    pending: "default",
    running: "processing",
    success: "success",
    failed: "error",
    skipped: "warning",
};

const stringifyJson = (value: JsonValue): string => {
    if (value === null || value === undefined) {
        return "-";
    }
    if (typeof value === "string") {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
};

const summarizeJson = (value: JsonValue): string => {
    if (value === null || value === undefined) {
        return "-";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (Array.isArray(value)) {
        return value.length === 0 ? "[]" : `Array(${value.length})`;
    }
    const keys = Object.keys(value);
    return keys.length === 0 ? "{}" : keys.join(", ");
};

const calcNodeLevels = (nodes: AnalysisNode[]): AnalysisNode[][] => {
    if (!nodes.length) return [];

    const nodeMap = new Map<string, AnalysisNode>();
    nodes.forEach((node) => nodeMap.set(node.node_id, node));

    const indegree = new Map<string, number>();
    const levelMap = new Map<string, number>();

    nodes.forEach((node) => {
        const effectiveUps = (node.upstream_ids || []).filter((upId) => nodeMap.has(upId));
        indegree.set(node.node_id, effectiveUps.length);
        if (effectiveUps.length === 0) {
            levelMap.set(node.node_id, 0);
        }
    });

    const queue: string[] = nodes
        .filter((node) => (indegree.get(node.node_id) || 0) === 0)
        .map((node) => node.node_id);

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;

        const currentNode = nodeMap.get(currentId);
        const currentLevel = levelMap.get(currentId) ?? 0;
        if (!currentNode) continue;

        (currentNode.downstream_ids || []).forEach((downId) => {
            if (!nodeMap.has(downId)) return;
            const nextDegree = (indegree.get(downId) || 0) - 1;
            indegree.set(downId, nextDegree);
            levelMap.set(downId, Math.max(levelMap.get(downId) ?? 0, currentLevel + 1));
            if (nextDegree === 0) {
                queue.push(downId);
            }
        });
    }

    // If there is a cycle or incomplete edge data, push unresolved nodes to the last column.
    let maxLevel = Math.max(...Array.from(levelMap.values()), 0);
    nodes.forEach((node) => {
        if (!levelMap.has(node.node_id)) {
            maxLevel += 1;
            levelMap.set(node.node_id, maxLevel);
        }
    });

    const levels: AnalysisNode[][] = [];
    nodes.forEach((node) => {
        const level = levelMap.get(node.node_id) ?? 0;
        if (!levels[level]) {
            levels[level] = [];
        }
        levels[level].push(node);
    });

    return levels.filter(Boolean);
};

const AnalysisNodes: FC<any> = ({ analysis_id }) => {

    const { data, pageNumber, totalPage, loading, reload, pageSize, setPageNumber } = usePagination({
        url: `/analysis-runtime/nodes/page`,
        params: {
            analysis_id: analysis_id
        },
        initialPageSize: 10
    })

    const { containerURL, project, baseURL } = useSelector((state: any) => state.user);

    const message = useGlobalMessage()
    const nodeLevels = useMemo(() => calcNodeLevels(data as AnalysisNode[]), [data]);
    const { modals, openModals, closeModals } = useModals(["editParams", "moduleEdit", "createOrUpdatePipelineComponent"]);
    const { open } = useUI();

    const { register, unregister } = useComponentStore();

    const instance = useMemo(() => {
        // const analysis_node_id = selectedSample?.analysis_node_id

        return {
            analysisDone: (args: any) => {
                console.log("AnalysisNodes analysisDone", args, data)
                if (args.id) {
                    // 判断data 是否都是当前analysis_node_id，如果是则reload，否则不处理
                    // const allMatch = (data as AnalysisNode[]).every(node => node.analysis_node_id === analysis_node_id);
                    const findRecord = (data as AnalysisNode[]).find(x => x.analysis_node_id === args.id);
                    if (findRecord) {
                        reload()
                    }
                }

            },
            analysisStarted: (args: any) => {
                console.log("AnalysisNodes analysisStarted", args, data)

                if (args.id) {
                    // 判断data 是否都是当前analysis_node_id，如果是则reload，否则不处理
                    // const allMatch = (data as AnalysisNode[]).every(node => node.analysis_node_id === analysis_node_id);
                    const findRecord = (data as AnalysisNode[]).find(x => x.analysis_node_id === args.id);
                    if (findRecord) {
                        reload()
                    }
                }
            }
        }
    }, [data])

    useEffect(() => {

        register("analysis", analysis_id, instance);
        return () => {
            unregister("analysis", analysis_id, instance);
        }
    }, [data]);


    const columns: ColumnsType<AnalysisNode> = [
        {
            title: 'status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (value: string) => <Tag color={statusColorMap[value] || "default"}>{value || "unknown"}</Tag>,
        }, {
            title: 'node_id',
            dataIndex: 'node_id',
            key: 'node_id',
            width: 260,
            ellipsis: true,
            render: (_, record) => (
                <Flex vertical gap={4}>
                    <Typography.Text strong>{record.node_name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        node_id: {record.node_id}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        script_id: {record.script_id}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        sample_id: {record.sample_id || "global"}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        analysis_node_id: {record.analysis_node_id}
                    </Typography.Text>
                     <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        container_image: {record.container_image}
                    </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        workspace_dir: {record.workspace_dir}
                    </Typography.Text>
                    
                </Flex>
            )
        },
        //  {
        //     title: 'input_validation_errors',
        //     dataIndex: 'input_validation_errors',
        //     key: 'input_validation_errors',
        //     width: 220,
        //     ellipsis: true,
        //     render: (value: JsonValue) => (
        //         <Tooltip
        //             title={<pre style={{ margin: 0, whiteSpace: "pre-wrap", maxWidth: 520 }}>{stringifyJson(value)}</pre>}
        //             placement="topLeft"
        //         >
        //             <Typography.Text ellipsis style={{ maxWidth: 200 }}>
        //                 {JSON.stringify(value)}
        //             </Typography.Text>
        //         </Tooltip>
        //     )
        // }, {
        //     title: 'output_validation_errors',
        //     dataIndex: 'output_validation_errors',
        //     key: 'output_validation_errors',
        //     width: 220,
        //     ellipsis: true,
        //     render: (value: JsonValue) => (
        //         <Tooltip
        //             title={<pre style={{ margin: 0, whiteSpace: "pre-wrap", maxWidth: 520 }}>{stringifyJson(value)}</pre>}
        //             placement="topLeft"
        //         >
        //             <Typography.Text ellipsis style={{ maxWidth: 200 }}>
        //                 {JSON.stringify(value)}
        //             </Typography.Text>
        //         </Tooltip>
        //     )
        // },

        // {
        //     title: 'container_image',
        //     dataIndex: 'container_image',
        //     key: 'container_image',
        //     ellipsis: true,
        // }, 
        // {
        //     title: 'workspace_dir',
        //     dataIndex: 'workspace_dir',
        //     key: 'workspace_dir',
        //     ellipsis: true,
        // },
        {
            title: 'upstream',
            dataIndex: 'upstream_ids',
            key: 'upstream_ids',
            width: 200,
            render: (list: string[] | undefined) => (
                <Flex gap={4} wrap>
                    {(list || []).length === 0 ? "-" : (list || []).map((id) => <Tag key={id}>{id}</Tag>)}
                </Flex>
            )
        },
        {
            title: 'downstream',
            dataIndex: 'downstream_ids',
            key: 'downstream_ids',
            width: 200,
            render: (list: string[] | undefined) => (
                <Flex gap={4} wrap>
                    {(list || []).length === 0 ? "-" : (list || []).map((id) => <Tag key={id}>{id}</Tag>)}
                </Flex>
            )
        },
        // {
        //     title: 'params',
        //     dataIndex: 'params',
        //     key: 'params',
        //     width: 340,
        //     ellipsis: true,
        //     render: (params: JsonValue) => (
        //         <Tooltip
        //             title={<pre style={{ margin: 0, whiteSpace: "pre-wrap", maxWidth: 520 }}>{stringifyJson(params)}</pre>}
        //             placement="topLeft"
        //         >
        //             <Typography.Text ellipsis style={{ maxWidth: 320 }}>
        //                 {summarizeJson(params)}
        //             </Typography.Text>
        //         </Tooltip>
        //     )
        // }, 
        // {
        //     title: 'error_message',
        //     dataIndex: 'error_message',
        //     key: 'error_message',
        //     width: 220,
        //     ellipsis: true,
        //     render: (value: JsonValue) => (
        //         <Tooltip
        //             title={<pre style={{ margin: 0, whiteSpace: "pre-wrap", maxWidth: 520 }}>{stringifyJson(value)}</pre>}
        //             placement="topLeft"
        //         >
        //             <Typography.Text ellipsis style={{ maxWidth: 200 }}>
        //                 {JSON.stringify(value)}
        //             </Typography.Text>
        //         </Tooltip>
        //     )
        // },


        {
            title: 'created_at',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 190,
            ellipsis: true,
        },
        {
            title: 'updated_at',
            dataIndex: 'updated_at',
            key: 'updated_at',
            width: 190,
            ellipsis: true,
            render: (value: string | null) => value || '-',
        }, {
            title: 'actions',
            key: 'actions',
            width: 120,
            fixed: "right",
            ellipsis: true,
            render: (_, record: any) => (
                <Flex gap={8}>
                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                        invoke.analysisNodeDetails.drawer(
                            { analysis_node_id: record?.analysis_node_id },
                            {
                                width: 960,
                                title: `Details - ${record.node_id}`,
                            }
                        )
                    }}>Report</Button>

                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                        invoke.nodeParams.drawer(
                            { analysis_node_id: record?.analysis_node_id },
                            {
                                width: 960,
                                title: `Params - ${record.node_id}`,
                            }
                        )
                    }}>Params</Button>

                    <Tooltip title={`Edit Script ${record?.script_id}`}>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            // openModals("createOrUpdatePipelineComponent", {
                            // data: {
                            //     component_id: record?.script_id,
                            // }, structure: {
                            //     component_type: "script",
                            // }
                            // })
                            invoke.createOrUpdateComponent.drawer(
                                {
                                    component_id: record?.script_id,
                                    structure: {
                                        component_type: "script",
                                    }
                                },
                                {
                                    width: 960,
                                    title: `Edit - ${record.node_id}`,

                                }
                            )
                        }}>Edit</Button>
                    </Tooltip>
                    <Tooltip title={`Script Code ${record?.script_id}`}>
                        <Button size="small" color="cyan" variant="solid" onClick={() => {
                            // openModals("moduleEdit", {
                            //     component_id: record?.script_id,
                            // })
                            invoke.scriptCodeEdit.drawer({
                                component_id: record?.script_id
                            }, {
                                width: 960,
                                title: `Code - ${record.node_id}`,
                            })
                        }}>Code</Button>
                    </Tooltip>
                    {record?.status != "pending" && <>
                        {record?.image_status == "exist" ?
                            <>
                                {record?.status == "running" ?
                                    <>
                                        <Popconfirm title={"Whether or not to stop?"} onConfirm={async () => {
                                            await stopAnalysisNodeApi(record.analysis_node_id, "node")
                                            message.success("Stop Success")

                                        }}>
                                            <Button size="small" color="red" variant="solid">
                                                Stop
                                            </Button>
                                        </Popconfirm>

                                    </> : <>
                                        <Popconfirm title={"Whether or not to run?"} onConfirm={async () => {
                                            await runAnalysisNodeApi(record.analysis_node_id, "node")
                                            message.success("run successfully")


                                        }}>
                                            <Button size="small" color="cyan" variant="solid">
                                                {record.status == "ready" ? "Run" : "Re-Run"}
                                            </Button>
                                        </Popconfirm>

                                    </>
                                }
                                {record?.server_status == "running" ?
                                    <>

                                        <Popconfirm title={"Whether or not to stop?"} onConfirm={async () => {
                                            // stopAnalysis(record, "server")
                                            await stopAnalysisNodeApi(record.analysis_node_id, "nserver")
                                        }}>
                                            <Button size="small" color="red" variant="solid">
                                                Stop Server
                                            </Button>
                                        </Popconfirm>
                                        <Tooltip title={<>
                                            {`${containerURL}/container/nserver-${record.analysis_node_id}/`}
                                        </>}>
                                            <ExportOutlined style={{ cursor: "pointer" }} onClick={() => {

                                                window.open(`${containerURL}/container/nserver-${record.analysis_node_id}/`, "_blank")
                                            }} />
                                        </Tooltip>


                                    </> : <>
                                        <Popconfirm title="Whether to start the nserver?" onConfirm={async () => {
                                            await runAnalysisNodeApi(record.analysis_node_id, "nserver")
                                        }}>
                                            <Button size="small" color="cyan" variant="solid">Run Server</Button>
                                        </Popconfirm>

                                    </>
                                }
                            </>

                            :
                            <>
                                <Popconfirm title="Pull?" onConfirm={async () => {
                                    await axios.post(`/container/pull-image/${record.container_id}`)
                                    // loadData(record.analysis_id)
                                    reload()

                                }}>
                                    <Button size="small" color="cyan" variant="solid"  >
                                        {record.image_status == "pulling" ? "pulling" : "Pull"}
                                    </Button>
                                </Popconfirm>
                            </>}

                    </>}

                </Flex>
            )
        }
    ]
    const summary = {
        nodeCount: data.length,
        sampleCount: new Set(data.map((node) => node.sample_id || "global")).size,
        doneCount: data.filter((node) => node.status === "success").length,
        failedCount: data.filter((node) => node.status === "failed").length,

    }
    return <>

        {/* <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} sm={8} lg={6}>
                <Card size="small"><Statistic title="Nodes" value={summary.nodeCount} /></Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
                <Card size="small"><Statistic title="Samples" value={summary.sampleCount} /></Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
                <Card size="small"><Statistic title="Done" value={summary.doneCount} /></Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
                <Card size="small"><Statistic title="Failed" value={summary.failedCount} /></Card>
            </Col>

        </Row> */}

        <Button onClick={async () => {
            await axios.post(`/analysis-runtime/invalidate-cache/${analysis_id}`)
            reload()
        }}>invalidate-cache</Button>
        <Button onClick={async () => {
            await axios.post(`/analysis-runtime/snapshot`, { analysis_id })
        }}>snapshot</Button>
        <Button onClick={async () => {
            await axios.post(`/analysis-runtime/schedule-next`, { analysis_id })
            // reload()
        }}>schedule-next</Button>

        <Button onClick={async () => {
            await axios.post(`/analysis-runtime/auto-run`, { analysis_id })
            // reload()
        }}>auto-run</Button>

        {/* <Card size="small" title="Analysis DAG" style={{ marginBottom: 12 }}>
            {nodeLevels.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No nodes" />
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <Flex align="start" gap={12} style={{ minWidth: "max-content" }}>
                        {nodeLevels.map((levelNodes, levelIndex) => (
                            <Card
                                key={`level-${levelIndex}`}
                                size="small"
                                title={`Layer ${levelIndex + 1}`}
                                style={{ width: 280, background: "#fafafa" }}
                            >
                                <Flex vertical gap={8}>
                                    {levelNodes.map((node) => (
                                        <Card key={node.id || node.node_id} size="small" bodyStyle={{ padding: 10 }}>
                                            <Flex vertical gap={6}>
                                                <Flex justify="space-between" align="center" gap={8}>
                                                    <Typography.Text strong ellipsis style={{ maxWidth: 170 }}>
                                                        {node.node_id}
                                                    </Typography.Text>
                                                    <Tag color={statusColorMap[node.status] || "default"}>{node.status || "unknown"}</Tag>
                                                </Flex>
                                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                    sample: {node.sample_id || "global"}
                                                </Typography.Text>
                                                <Flex gap={4} wrap>
                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>up:</Typography.Text>
                                                    {(node.upstream_ids || []).length === 0 ? (
                                                        <Tag>none</Tag>
                                                    ) : (
                                                        (node.upstream_ids || []).map((upId) => <Tag key={upId}>{upId}</Tag>)
                                                    )}
                                                </Flex>
                                                <Flex gap={4} wrap>
                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>down:</Typography.Text>
                                                    {(node.downstream_ids || []).length === 0 ? (
                                                        <Tag>none</Tag>
                                                    ) : (
                                                        (node.downstream_ids || []).map((downId) => <Tag key={downId}>{downId}</Tag>)
                                                    )}
                                                </Flex>
                                            </Flex>
                                        </Card>
                                    ))}
                                </Flex>
                            </Card>
                        ))}
                    </Flex>
                </div>
            )}
        </Card> */}

        <Table
            title={() =>
                // 右对齐刷新按钮和搜索框
                <Flex gap={"small"} wrap justify="end" align="center">
                    {/* <Button size="small" onClick={() => setComponent(undefined)}>Clear</Button> */}
                    {/* <Search
                    size="small"
                    placeholder="Search Components"
                    allowClear
                    enterButton
                    onSearch={(value) => { search(value) }}
                    style={{ width: 200 }}
                /> */}
                    {/* 修改为button */}
                    <Button loading={loading} size="small" icon={<RedoOutlined />} onClick={reload}></Button>
                </Flex>}
            rowKey={(record: AnalysisNode) => `${record.id || ""}-${record.node_id}-${record.sample_id || 'global'}`}
            size="small"
            // bordered
            pagination={false}
            loading={loading}
            scroll={{ x: 'max-content' }}
            columns={columns}
            expandable={{
                expandedRowRender: (record: any) => (
                    <Typography>
                        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {JSON.stringify({
                                error_message: record?.error_message,
                                input_validation_errors: record?.input_validation_errors,
                                output_validation_errors: record?.output_validation_errors,
                                resolved_inputs: record?.resolved_inputs,
                                resolved_outputs: record?.resolved_outputs,
                                output_patterns: record?.output_patterns,
                                params: record?.params,
                            }, null, 2)}
                        </pre>
                    </Typography>
                )
            }}
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

        <ViewResolver
            visible={modals.moduleEdit.visible}
            onClose={() => closeModals("moduleEdit")}
            callback={() => reload()}
            params={modals.moduleEdit.params}
            view="module-edit"
        ></ViewResolver>
        <ViewResolver
            callback={() => reload()}
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modals.createOrUpdatePipelineComponent.visible}
            onClose={() => closeModals("createOrUpdatePipelineComponent")}
            view="create-or-update-component-drawer"
            params={modals.createOrUpdatePipelineComponent.params}></ViewResolver>

    </>
}
export default AnalysisNodes;
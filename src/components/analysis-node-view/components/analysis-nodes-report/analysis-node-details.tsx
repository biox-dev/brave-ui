import { Button, Card, Flex, Modal, Popconfirm, Skeleton, Space, Tag, Tooltip, Typography } from "antd";
import axios from "axios";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { CloseOutlined, EditOutlined, ExportOutlined, FileTextOutlined, RedoOutlined } from "@ant-design/icons";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";
import AISummaryPanel from "@/components/ai-summary/ai-summary-panel";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import { invoke } from "@/core/ui-system/invokeV2";
import { runAnalysisNodeApi, stopAnalysisNodeApi } from "@/api/analysisv1";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { http } from "@/api/client/http";
import { useSelector } from "react-redux";
import { useStoreRender } from "@/context/render/RenderProvider";
import { useSideViewContext } from "@/context/side/SideViewContext";
import { useComponentStore } from "@/event-bus/stores/components";
import { FilesRender } from "../result-render/components/files-render";
import { AnalysisNodeFilesRender } from "../result-render/components/analysis-node-files-render";
import { NodeParamsRender } from "../result-render/components/node-params-render";
import { LLMEnvType, setLLMEnv } from "@/utils/llm-env";

type NodeResultAsset = {
    images?: any[];
    tables?: any[];
    htmls?: any[];
};

type AnalysisNodeSample = {
    analysis_node_id: string;
    status: string;
    server_status: string;
    result?: NodeResultAsset;
    node?: any;
};

const statusColorMap: Record<string, string> = {
    done: "success",
    success: "success",
    failed: "error",
    running: "processing",
    pending: "default",
    skipped: "warning",
};

export interface AnalysisNodeDetailsProps {
    analysis_node_id?: string;
}

const AnalysisNodeDetails: FC<AnalysisNodeDetailsProps> = ({ analysis_node_id }) => {
    const [detailLoading, setDetailLoading] = useState(false);
    const [sampleDetailMap, setSampleDetailMap] = useState<Record<string, Partial<AnalysisNodeSample>>>({});
    const { analysisNodeId, setAnalysisNodeId } = useStoreRender();
    const { setSideView } = useSideViewContext();
    const { register, unregister } = useComponentStore();
    const message = useGlobalMessage();
    const [selectedSampleDetail, setSelectedSampleDetail] = useState<any>({});
    // 运行中的节点可以打开容器终端（xterm.js -> WebSocket -> kubectl/docker exec）。
    const [terminalOpen, setTerminalOpen] = useState(false);
    const { containerURL } = useSelector((state: any) => state.user);

    // const loadSampleDetail = useCallback(async (targetAnalysisNodeId?: string, force = false) => {
    //     if (!targetAnalysisNodeId || (sampleDetailMap[targetAnalysisNodeId] && !force)) {
    //         return;
    //     }

    // setDetailLoading(true);
    // try {
    //     const res = await axios.get(`/analysis/visualization-node-file/${targetAnalysisNodeId}`);
    //     setSampleDetailMap((prev) => ({
    //         ...prev,
    //         [targetAnalysisNodeId]: res.data,
    //     }));
    // } finally {
    //     setDetailLoading(false);
    // }
    // }, [sampleDetailMap]);

    // const selectedSampleDetail = analysis_node_id ? sampleDetailMap[analysis_node_id] : undefined;

    const loadSampleDetail = async (targetAnalysisNodeId?: string) => {

        setDetailLoading(true);
        try {
            // const res = await axios.get(`/analysis/visualization-node-file/${targetAnalysisNodeId}`);

            const res = await http.get(`/analysis/visualization-node-file/${targetAnalysisNodeId}`);
            setSelectedSampleDetail(res.data);

        } finally {
            setDetailLoading(false);
        }
    }

    const instance = useMemo(() => {
        return {
            analysisDone: () => {
                loadSampleDetail(analysis_node_id);
            },
            // dagDone: () => {
            //     loadSampleDetail(analysis_node_id);

            // },
            analysisStarted: () => {
                loadSampleDetail(analysis_node_id);
            }
            // , analysisPulled: () => {
            //     loadSampleDetail(analysis_node_id);
            // }
        };
    }, [analysis_node_id]);

    useEffect(() => {
        loadSampleDetail(analysis_node_id);
    }, [analysis_node_id]);

    useEffect(() => {
        if (analysis_node_id) {
            register("analysis", analysis_node_id, instance);
            return () => {
                unregister("analysis", analysis_node_id, instance);
            };
        }
    }, [analysis_node_id, instance, register, unregister]);

    // const containerInstance = useMemo(() => {
    //     return {
    //         analysisPulled: () => {

    //         }
    //     };
    // }, [analysis_node_id]);
    useEffect(() => {
        // console.log("selectedSampleDetail?.node?.container_id", selectedSampleDetail?.node?.container_id)
        if (selectedSampleDetail?.node?.container_id) {
            register("container", selectedSampleDetail?.node?.container_id, {
                containerPulled: () => {
                    loadSampleDetail(analysis_node_id);
                }
            });
            return () => {
                unregister("container", selectedSampleDetail?.node?.container_id);
            };
        }
    }, [selectedSampleDetail?.node?.container_id, register, unregister]);

    return (
        <Card
            size="small"
            title={selectedSampleDetail?.node?.script_name || "Result Report"}
            extra={
                <Space>
                    <Tooltip title="Bind this analysis node as the current Agent context">
                        <Button
                            size="small"
                            color="geekblue"
                            variant="solid"
                            disabled={!analysisNodeId}
                            onClick={async () => {
                                await setLLMEnv(analysisNodeId, LLMEnvType.AnalysisNode);
                                message.success("Agent context bound to analysis node");
                            }}
                        >
                            Agent
                        </Button>
                    </Tooltip>
                    {selectedSampleDetail && (
                        <Space>

                            <Button
                                size="small"
                                color="cyan"
                                variant="solid"
                                onClick={() => {
                                    invoke.nodeParams.open(
                                        { analysis_node_id: selectedSampleDetail.node?.id },
                                        {
                                            width: "60%",
                                            title: `Params - ${selectedSampleDetail.node?.id}`,
                                        }
                                    );
                                }}
                            >
                                Params
                            </Button>
                            <Button
                                size="small"
                                color="cyan"
                                variant="solid"
                                onClick={() => {
                                    invoke.nodeLogs.open({ analysis_node_id: selectedSampleDetail.node?.id },
                                        {
                                            title: `Logs - ${selectedSampleDetail.node?.node_name}`,
                                            width: 800,
                                            footer: null,
                                        })
                                }}
                            >
                                Logs
                            </Button>
                            <Tooltip title={`run.sh - ${selectedSampleDetail.node?.command_path || ""}`}>
                                <Button
                                    size="small"
                                    color="cyan"
                                    variant="solid"
                                    icon={<FileTextOutlined />}
                                    onClick={() => {
                                        invoke.nodeCommand.open(
                                            {
                                                analysis_node_id: String(
                                                    selectedSampleDetail.node?.id ?? analysis_node_id ?? ""
                                                ),
                                                node_name: selectedSampleDetail.node?.node_name,
                                            },
                                            {
                                                width: "60%",
                                                title: `Command - ${selectedSampleDetail.node?.node_id}`,
                                                footer: null,
                                            }
                                        );
                                    }}
                                >
                                    Command
                                </Button>
                            </Tooltip>
                            {/* 命令节点（Agent 创建、无 script）没有脚本可编辑，隐藏编辑入口。 */}
                            {!selectedSampleDetail.node?.is_command_node && (
                                <>
                                    <Tooltip title={`Edit Script ${selectedSampleDetail.node?.script_id}`}>
                                        <Button
                                            size="small"
                                            color="cyan"
                                            variant="solid"
                                            onClick={async () => {
                                                await invoke.createOrUpdateScript.openAsync(
                                                    {
                                                        script_id: selectedSampleDetail.node?.script_id,
                                                    },
                                                    {
                                                        width: "60%",
                                                        title: `Edit - ${selectedSampleDetail.node?.node_id}`,
                                                    }
                                                );
                                                if (analysis_node_id) {
                                                    loadSampleDetail(analysis_node_id);
                                                }
                                            }}
                                        >
                                            Edit Script
                                        </Button>
                                    </Tooltip>

                                    <Tooltip title={`Script Code ${selectedSampleDetail.node?.script_id}`}>
                                        <Button
                                            size="small"
                                            color="cyan"
                                            variant="solid"
                                            onClick={() => {
                                                console.log("selectedSampleDetail: ", selectedSampleDetail)
                                                invoke.scriptCode.openAsync(
                                                    {
                                                        script_id: selectedSampleDetail.node?.script_id,
                                                    },
                                                    {
                                                        width: "60%",
                                                        title: `Code - ${selectedSampleDetail.node?.node_id}`,
                                                    }
                                                );
                                            }}
                                        >
                                            Code
                                        </Button>
                                    </Tooltip>
                                </>
                            )}

                            {selectedSampleDetail.node?.status != "pending" && (
                                <>
                                    {selectedSampleDetail.node?.image_status == "exist" ? (
                                        <>
                                            {selectedSampleDetail.node?.status == "running" ? (
                                                <Popconfirm
                                                    title={"Whether or not to stop?"}
                                                    onConfirm={async () => {
                                                        // await stopAnalysisNodeApi(selectedSampleDetail.node?.analysis_node_id, "node");
                                                        await http.post(`/analysis/node/stop/${analysisNodeId}`)
                                                        message.success("Stop Success");
                                                    }}
                                                >
                                                    <Button size="small" color="red" variant="solid">
                                                        Stop
                                                    </Button>
                                                </Popconfirm>
                                            ) : (
                                                <Popconfirm
                                                    title={"Whether or not to run?"}
                                                    onConfirm={async () => {
                                                        await http.post(`/analysis/${analysisNodeId}/run-node`)
                                                        message.success("run successfully");
                                                    }}
                                                >
                                                    <Button size="small" color="cyan" variant="solid">
                                                        {selectedSampleDetail.node?.status == "ready" ? "Run" : "Re-Run"}
                                                    </Button>
                                                </Popconfirm>
                                            )}

                                            {/* {selectedSampleDetail.node?.server_status == "running" ? (
                                                <>
                                                    <Popconfirm
                                                        title={"Whether or not to stop?"}
                                                        onConfirm={async () => {
                                                            await stopAnalysisNodeApi(selectedSampleDetail.node?.analysis_node_id, "nserver");
                                                        }}
                                                    >
                                                        <Button size="small" color="red" variant="solid">
                                                            Stop Server
                                                        </Button>
                                                    </Popconfirm>
                                                    <Tooltip
                                                        title={
                                                            <>
                                                                {`${containerURL}/container/nserver-${selectedSampleDetail.node?.analysis_node_id}/`}
                                                            </>
                                                        }
                                                    >
                                                        <ExportOutlined
                                                            style={{ cursor: "pointer" }}
                                                            onClick={() => {
                                                                window.open(
                                                                    `${containerURL}/container/nserver-${selectedSampleDetail.node?.analysis_node_id}/`,
                                                                    "_blank"
                                                                );
                                                            }}
                                                        />
                                                    </Tooltip>
                                                </>
                                            ) : (
                                                <Popconfirm
                                                    title="Whether to start the nserver?"
                                                    onConfirm={async () => {
                                                        await runAnalysisNodeApi(selectedSampleDetail.node?.analysis_node_id, "nserver");
                                                    }}
                                                >
                                                    <Button size="small" color="cyan" variant="solid">
                                                        Run Server
                                                    </Button>
                                                </Popconfirm>
                                            )} */}
                                        </>
                                    ) : (
                                        <Popconfirm
                                            title="Pull?"
                                            onConfirm={async () => {
                                                await axios.post(`/container/pull-image/${selectedSampleDetail.node?.container_id}`);
                                                if (analysis_node_id) {
                                                    loadSampleDetail(analysis_node_id);
                                                }
                                            }}
                                        >
                                            <Button size="small" color="blue" variant="solid">
                                                {selectedSampleDetail.node?.image_status == "pulling" ? "pulling" : "Pull"}
                                            </Button>
                                        </Popconfirm>
                                    )}

                                    {selectedSampleDetail.node?.status == "running" && (
                                        <Button
                                            size="small"
                                            color="cyan"
                                            variant="solid"
                                            onClick={() => setTerminalOpen(true)}
                                        >
                                            Terminal
                                        </Button>
                                    )}

                                    <Button
                                        size="small"
                                        color="cyan"
                                        variant="solid"
                                        onClick={() => {
                                            invoke.appSessionPage.open(
                                                {
                                                    analysis_node_id: String(selectedSampleDetail.node?.id ?? ""),
                                                    analysis_node_name: selectedSampleDetail.node?.node_name,
                                                },
                                                {
                                                    width: 960,
                                                    title: `App Session - ${selectedSampleDetail.node?.node_id}`,
                                                }
                                            );
                                        }}
                                    >
                                        App Session
                                    </Button>
                                </>
                            )}
                        </Space>
                    )}

                    {analysisNodeId == analysis_node_id ? (
                        <Tooltip title={`Close ${analysis_node_id}`}>
                            <Button
                                size="small"
                                onClick={() => {
                                    setAnalysisNodeId(null);
                                }}
                                icon={<CloseOutlined />}
                            ></Button>
                        </Tooltip>
                    ) : (
                        <Tooltip title={`${analysis_node_id}`}>
                            <Button
                                size="small"
                                onClick={() => {
                                    setAnalysisNodeId(analysis_node_id || null);
                                    setSideView("editParamsPanel");
                                }}
                                icon={<EditOutlined />}
                            />
                        </Tooltip>
                    )}

                    <Button
                        loading={detailLoading}
                        onClick={() => loadSampleDetail(analysis_node_id)}
                        size="small"
                        icon={<RedoOutlined />}
                    />
                </Space>
            }
        >

            {!analysis_node_id || !selectedSampleDetail ? (
                <Skeleton active paragraph={{ rows: 2 }} />
            ) : (
                <Flex vertical gap={12}>
                    <Card size="small" styles={{ body: { padding: 12 } }}>
                        <Flex justify="space-between" align="flex-start" gap={12} wrap>
                            <Flex vertical gap={4}>
                                <Typography.Text type="secondary">node: {selectedSampleDetail.node?.node_id}</Typography.Text>
                                <Typography.Text type="secondary">
                                    analysis_node_id: {selectedSampleDetail.node?.id}
                                </Typography.Text>

                                <Typography.Text type="secondary">
                                    script_id: {selectedSampleDetail.node?.script_id}
                                </Typography.Text>

                                <Typography.Text type="secondary">
                                    container_name: <Tooltip title={selectedSampleDetail.node?.container_image}>
                                        {selectedSampleDetail.node?.container_name}
                                    </Tooltip>
                                </Typography.Text>

                                {selectedSampleDetail.node?.sample_id && (
                                    <Typography.Text type="secondary">sample: {selectedSampleDetail.node?.sample_id}</Typography.Text>
                                )}
                                {selectedSampleDetail.node?.rerun_reason && (
                                    <Typography.Text type="secondary">rerun reason: {selectedSampleDetail.node?.rerun_reason}</Typography.Text>
                                )}

                                {selectedSampleDetail.node?.output_dir && (
                                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0, wordBreak: "break-all" }}>
                                        output: {selectedSampleDetail.node?.output_dir}
                                    </Typography.Paragraph>
                                )}
                            </Flex>
                            <Space wrap>

                                <Tag
                                    style={{ cursor: "pointer" }}
                                    onClick={() => {

                                        invoke.nodeResolvedIO.open({ node: selectedSampleDetail.node },
                                            {
                                                title: `IO - ${selectedSampleDetail.node?.node_name}`,
                                                width: 800,
                                                footer: null,
                                            })
                                    }}>IO</Tag>
                                {selectedSampleDetail.node?.status == "running" &&
                                    <Tag
                                        style={{ cursor: "pointer" }}
                                        onClick={() => {

                                            invoke.containerInspect.open({
                                                params: {
                                                    inspect: "inspect",
                                                    id: selectedSampleDetail.node?.analysis_node_id,
                                                    run_type: "node"
                                                }
                                            },
                                                {
                                                    title: `Node Inspect - ${selectedSampleDetail.node?.node_name}`,
                                                    width: 800,
                                                    footer: null,
                                                })
                                        }}>Node Inspect</Tag>
                                }

                                {selectedSampleDetail.node?.server_status == "running" &&
                                    <Tag
                                        style={{ cursor: "pointer" }}
                                        onClick={() => {

                                            invoke.containerInspect.open({
                                                params: {
                                                    inspect: "inspect",
                                                    id: selectedSampleDetail.node?.analysis_node_id,
                                                    run_type: "nserver"
                                                }
                                            },
                                                {
                                                    title: `Server Inspect - ${selectedSampleDetail.node?.node_name}`,
                                                    width: 800,
                                                    footer: null,
                                                })
                                        }}>Server Inspect</Tag>
                                }





                                {selectedSampleDetail.status && (
                                    <Tag
                                        style={{ cursor: "pointer" }}
                                        onClick={() => {

                                            invoke.nodeError.open({ node: selectedSampleDetail.node },
                                                {
                                                    title: `Error - ${selectedSampleDetail.node?.node_name}`,
                                                    width: 800,
                                                    footer: null,
                                                })
                                        }}
                                        color={statusColorMap[selectedSampleDetail.status]}>{selectedSampleDetail.status}</Tag>
                                )}
                                {selectedSampleDetail.status == "done" && <Popconfirm title="is complete?" onConfirm={() => {
                                    async () => {
                                        await axios.post(`/complete-node/${selectedSampleDetail.node.analysis_node_id}`)
                                        message.success("complete success!")
                                    }
                                }}>
                                    <Button size="small"
                                    >
                                        complete node
                                    </Button>
                                </Popconfirm>}
                                {/* {selectedSampleDetail.server_status && (
                                    <Tag color={statusColorMap[selectedSampleDetail.server_status]}>
                                        {selectedSampleDetail.server_status}
                                    </Tag>
                                )} */}




                                {/* 
                                <Tag
                                    style={{ cursor: "pointer" }}
                                    onClick={() => {

                                        invoke.nodeLogs.open({ analysis_node_id: selectedSampleDetail.node.analysis_node_id },
                                            {
                                                title: `Logs - ${selectedSampleDetail.node?.node_name}`,
                                                width: 800,
                                                footer: null,
                                            })
                                    }}>Logs</Tag> */}
                            </Space>
                        </Flex>
                    </Card>
                    <AISummaryPanel
                        ownerType="analysis_node"
                        ownerId={analysis_node_id}
                    />
                    <AnalysisNodeFilesRender analysis_node_id={analysis_node_id} name="Node Files" />
                    <NodeParamsRender analysis_node_id={analysis_node_id} name="Node Params" />
                    {selectedSampleDetail?.result?.output_files && <FilesRender analysis_node_id={analysis_node_id} name="Output Files" files={selectedSampleDetail.result.output_files}></FilesRender>}
                    {selectedSampleDetail?.result?.cache_files && <FilesRender analysis_node_id={analysis_node_id} name="Cache Files" files={selectedSampleDetail?.result?.cache_files}></FilesRender>}

                    {selectedSampleDetail.status == "running" || detailLoading ? (
                        <Skeleton active paragraph={{ rows: 6 }} />
                    ) : (
                        <ViewResolver
                            analsyisResult={selectedSampleDetail.result || { images: [], tables: [], htmls: [], files: [] }}
                            view={"analysisResultDisplay"}
                        ></ViewResolver>
                    )}


                </Flex>
            )}

            <Modal
                open={terminalOpen}
                onCancel={() => setTerminalOpen(false)}
                footer={null}
                destroyOnClose
                width={960}
                title={`Terminal - ${selectedSampleDetail.node?.node_name || selectedSampleDetail.node?.node_id || ""}`}
            >
                {terminalOpen && (
                    <AnalysisNodeTerminal
                        id={selectedSampleDetail.node?.id ?? analysisNodeId ?? analysis_node_id ?? ""}
                        name={selectedSampleDetail.node?.node_name}
                    />
                )}
            </Modal>
        </Card>
    );
};



export default AnalysisNodeDetails;

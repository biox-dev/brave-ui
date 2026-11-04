import { Button, Card, Flex, Modal, Popconfirm, Skeleton, Space, Tag, Tooltip, Typography } from "antd";
import axios from "axios";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { CloseOutlined, EditOutlined, ExportOutlined, RedoOutlined, RobotOutlined } from "@ant-design/icons";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";
import AISummaryPanel from "@/components/ai-summary/ai-summary-panel";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import type { ViewRenderProps } from "@/core/component-registry/registry-types";
import { invoke } from "@/core/ui-system/invokeV2";
import { runAnalysisNodeApi, stopAnalysisNodeApi } from "@/api/analysisv1";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useInsertAgentRef } from "@/hooks/useInsertAgentRef";
import { useRouteMainTabTitle } from "@/hooks/useMainTabTitle";
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

// 底部结果区可切换的视图：运行结果 / 脚本代码 / 编辑脚本 / 节点参数（都通过 ViewResolver 内联渲染）。
type ResultViewKey = "analysisResultDisplay" | "scriptCode" | "createOrUpdateScript" | "nodeParams";

// Code 视图（components/script/code）默认按「填满视口剩余高度」自适应，
// 那套算法只适合 script-panel 这类从页面顶部开始的整页面板。
// 本组件内联在可滚动的长卡片底部，编辑器顶部通常已经接近或超出视口底部，
// 自适应结果会被钳到最小 320px，代码区又矮又难读。
// 这里显式给一个稳定高度：视口高度的 62%，下限 420px（至少看得到十几行），
// 上限 760px（宽屏下不至于长得离谱）。
const CODE_VIEW_HEIGHT = "clamp(420px, 62vh, 760px)";

export interface AnalysisNodeDetailsProps {
    analysis_node_id?: string;
    useTitle?: boolean;
}

const AnalysisNodeDetails: FC<AnalysisNodeDetailsProps> = ({ analysis_node_id, useTitle }) => {
    const [detailLoading, setDetailLoading] = useState(false);
    const [sampleDetailMap, setSampleDetailMap] = useState<Record<string, Partial<AnalysisNodeSample>>>({});
    const { analysisNodeId, setAnalysisNodeId } = useStoreRender();
    const { setSideView } = useSideViewContext();
    const { register, unregister } = useComponentStore();
    const message = useGlobalMessage();
    const [selectedSampleDetail, setSelectedSampleDetail] = useState<any>({});
    // 统一标签页标题通道：详情加载完成后把节点名同步给 MainTabs，
    // 直接打开/刷新该路由时标签页也能显示节点名。
    // useRouteMainTabTitle 只登记「id 与当前路由一致」的数据：本组件在
    // /analsyis-node-report/:id 之间切换时不会重新挂载，旧数据会残留一帧，
    // 不加判断会把上一个节点的名称写到新标签页上。
    // useTitle === false 时不参与标签页改名（交给上层/其它页面控制标题）。
    useRouteMainTabTitle(selectedSampleDetail?.node, {
        enabled: useTitle !== false,
        fields: ["node_name"],
    });
    // 运行中的节点可以打开容器终端（xterm.js -> WebSocket -> kubectl/docker exec）。
    const [terminalOpen, setTerminalOpen] = useState(false);
    // 底部 ViewResolver 当前展示的视图，点击 Code 时切到脚本代码而不是弹窗。
    const [resultView, setResultView] = useState<ResultViewKey>("analysisResultDisplay");
    const { containerURL } = useSelector((state: any) => state.user);

    // 把当前分析节点作为 @analysis_node:<id> 引用 chip 插进 Agent 输入框（面板未打开时自动切过去）。
    // Agent 侧用 get_analysis_node 调研：节点名称 / 类型 / 工作目录 / params.json / 脚本参数。
    const insertAgentRef = useInsertAgentRef();
    // 优先用详情接口返回的节点 id，详情未加载完时回退到路由传入的 id。
    const agentRefNodeId = String(selectedSampleDetail?.node?.id ?? analysis_node_id ?? "").trim();

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
        // 切换节点时回到结果视图，避免上一个节点的代码残留在新节点下。
        setResultView("analysisResultDisplay");
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

    // 节点 id / 脚本 id 在多个视图间复用，先算好避免重复书写。
    const nodeId = String(selectedSampleDetail.node?.id ?? analysis_node_id ?? "");
    const scriptId = selectedSampleDetail.node?.script_id;

    // 结果区视图参数：view 与 props 一起由 resultView 决定，用 switch 代替嵌套三元，
    // 新增视图时只要补一个 case。所有视图共用底部同一个 ViewResolver。
    const buildResultViewProps = (): ViewRenderProps => {
        switch (resultView) {
            case "scriptCode":
                return {
                    view: "scriptCode",
                    script_id: scriptId,
                    // 内联渲染的高度由调用方决定，见上方 CODE_VIEW_HEIGHT 的说明。
                    height: CODE_VIEW_HEIGHT,
                };
            case "createOrUpdateScript":
                return {
                    view: "createOrUpdateScript",
                    script_id: scriptId,
                    // 内联渲染没有弹窗壳会自动关闭：保存后刷新节点详情并切回代码视图。
                    callback: () => {
                        loadSampleDetail(analysis_node_id);
                        setResultView("scriptCode");
                    },
                };
            case "nodeParams":
                return {
                    view: "nodeParams",
                    analysis_node_id: nodeId,
                    // 内联渲染时没有弹窗壳自动关闭，回“关闭”就切回结果视图。
                    close: () => setResultView("analysisResultDisplay"),
                };
            default:
                return {
                    view: "analysisResultDisplay",
                    analsyisResult: selectedSampleDetail.result || { images: [], tables: [], htmls: [], files: [] },
                };
        }
    };

    const resultViewProps: ViewRenderProps = buildResultViewProps();

    // 按钮与结果视图之间互切：再次点击当前按钮或点 Result 都回到结果视图。
    const toggleResultView = (target: Exclude<ResultViewKey, "analysisResultDisplay">) => {
        setResultView((prev) => (prev === target ? "analysisResultDisplay" : target));
    };

    return (
        <Card
            size="small"
            title={selectedSampleDetail?.node?.script_name || "Result Report"}
            extra={
                <Space>
                    {/* <Tooltip title="Bind this analysis node as the current Agent context">
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
                    </Tooltip> */}

                    {/* 把当前分析节点作为 @analysis_node:<id> 引用插进 Agent 输入框，
                        模型收到引用后会用 get_analysis_node 读取节点名称 / 类型 / 工作目录与参数。 */}
                    <Tooltip
                        title={
                            agentRefNodeId
                                ? `Ask Agent about analysis node ${agentRefNodeId}`
                                : "Analysis node is not loaded yet"
                        }
                    >
                        <Button
                            size="small"
                            icon={<RobotOutlined />}
                            disabled={!agentRefNodeId}
                            onClick={() => {
                                const ok = insertAgentRef("analysis_node", agentRefNodeId, {
                                    label:
                                        selectedSampleDetail?.node?.node_name ||
                                        `AnalysisNode-${agentRefNodeId}`,
                                });
                                if (ok) message.success("Reference added to Agent input");
                            }}
                        >
                            Ask Agent
                        </Button>
                    </Tooltip>

                    {selectedSampleDetail && (
                        <Space>

                            <Tooltip
                                title={
                                    resultView === "nodeParams"
                                        ? "Back to the result view"
                                        : `Node Params - ${selectedSampleDetail.node?.id}`
                                }
                            >
                                <Button
                                    size="small"
                                    color="cyan"
                                    variant={resultView === "nodeParams" ? "outlined" : "solid"}
                                    onClick={() => {
                                        // 不弹窗：直接在底部 ViewResolver 里切换视图。
                                        toggleResultView("nodeParams");
                                    }}
                                >
                                    {resultView === "nodeParams" ? "Result" : "Params"}
                                </Button>
                            </Tooltip>
                            {/* 命令节点（Agent 创建、无 script）没有脚本可编辑，隐藏编辑入口。 */}
                            {!selectedSampleDetail.node?.is_command_node && (
                                <>
                                    <Tooltip
                                        title={
                                            resultView === "createOrUpdateScript"
                                                ? "Back to the result view"
                                                : `Edit Script ${selectedSampleDetail.node?.script_id}`
                                        }
                                    >
                                        <Button
                                            size="small"
                                            color="cyan"
                                            variant={resultView === "createOrUpdateScript" ? "outlined" : "solid"}
                                            onClick={() => {
                                                // 与 Params / Code 一致：不弹窗，直接在底部 ViewResolver 里切换视图。
                                                toggleResultView("createOrUpdateScript");
                                            }}
                                        >
                                            {resultView === "createOrUpdateScript" ? "Result" : "Edit Script"}
                                        </Button>
                                    </Tooltip>

                                    <Tooltip
                                        title={
                                            resultView === "scriptCode"
                                                ? "Back to the result view"
                                                : `Script Code ${selectedSampleDetail.node?.script_id}`
                                        }
                                    >
                                        <Button
                                            size="small"
                                            color="cyan"
                                            variant={resultView === "scriptCode" ? "outlined" : "solid"}
                                            onClick={() => {
                                                // 不弹窗：直接在底部 ViewResolver 里切换视图。
                                                toggleResultView("scriptCode");
                                            }}
                                        >
                                            {resultView === "scriptCode" ? "Result" : "Code"}
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

                                <Tag
                                    style={{ cursor: "pointer" }}
                                    onClick={() => {

                                        invoke.nodeLogs.open({ analysis_node_id: selectedSampleDetail.node?.id },
                                            {
                                                title: `Logs - ${selectedSampleDetail.node?.node_name}`,
                                                width: 800,
                                                footer: null,
                                            })
                                    }}>Logs</Tag>

                                <Tooltip title={`run.sh - ${selectedSampleDetail.node?.command_path || ""}`}>
                                    <Tag
                                        style={{ cursor: "pointer" }}
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
                                        }}>Command</Tag>
                                </Tooltip>
                            </Space>
                        </Flex>
                    </Card>
                    <AISummaryPanel
                        ownerType="analysis_node"
                        ownerId={analysis_node_id}
                    />
                    <AnalysisNodeFilesRender analysis_node_id={analysis_node_id} name="Node Files" />
                    {/* <NodeParamsRender analysis_node_id={analysis_node_id} name="Node Params" /> */}
                    {selectedSampleDetail?.result?.output_files && <FilesRender analysis_node_id={analysis_node_id} name="Output Files" files={selectedSampleDetail.result.output_files}></FilesRender>}
                    {selectedSampleDetail?.result?.cache_files && <FilesRender analysis_node_id={analysis_node_id} name="Cache Files" files={selectedSampleDetail?.result?.cache_files}></FilesRender>}

                    {/* 结果还在跑 / 正在刷新时，结果视图用 Skeleton；代码视图不受影响。 */}
                    {resultView === "analysisResultDisplay" && (selectedSampleDetail.status == "running" || detailLoading) ? (
                        <Skeleton active paragraph={{ rows: 6 }} />
                    ) : (
                        <ViewResolver {...resultViewProps}></ViewResolver>
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

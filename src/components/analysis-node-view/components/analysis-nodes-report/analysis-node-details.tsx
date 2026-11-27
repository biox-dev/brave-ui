import { Button, Card, Flex, Modal, Popconfirm, Skeleton, Space, Tag, Tooltip, Typography } from "antd";
import axios from "axios";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { CloseOutlined, ControlOutlined, EditOutlined, ExportOutlined, RedoOutlined, RobotOutlined } from "@ant-design/icons";
import AnalysisNodeTerminal from "@/components/container-manager/analysis-node-terminal";
import AISummaryPanel from "@/components/ai-summary/ai-summary-panel";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import type { ViewRenderProps } from "@/core/component-registry/registry-types";
import { invoke } from "@/core/ui-system/invokeV2";
import { runAnalysisNodeApi, stopAnalysisNodeApi } from "@/api/analysisv1";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useInsertAgentRef } from "@/hooks/useInsertAgentRef";
import { useRouteView } from "@/hooks/useRouteView";
import type { AnalysisNodeReportView } from "@/routes/route-view";
import { http } from "@/api/client/http";
import { useSelector } from "react-redux";
import { useStoreRender } from "@/context/render/RenderProvider";
import { ParamsEdit, ParamsPanelDock, ParamsPanelLayout } from "@/components/edit-params/params-panel";
import PanelLayout from "@/components/common/panel-layout";
import { useComponentStore } from "@/event-bus/stores/components";
import { FilesRender } from "../result-render/components/files-render";
import { AnalysisNodeFilesRender } from "../result-render/components/analysis-node-files-render";
import { NodeParamsRender } from "../result-render/components/node-params-render";
import { createContainerTerminalSessionApi } from "@/api/container-template-terminal";
import { openBottomTerminal } from "@/layout/bottom-panel-store";

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
// 视图名写成路由的「视图段」：/analsyis-node-report/:analysisNodeId/:view?
// 白名单与默认视图登记在 @/routes/route-view，布局层用同一份配置把视图段从标签页身份里去掉，
// 所以切视图既不会丢状态，也不会多出一个标签页。
type ResultViewKey = AnalysisNodeReportView;

// Code 视图（components/script/code）默认按「填满视口剩余高度」自适应，
// 那套算法只适合 script-panel 这类从页面顶部开始的整页面板。
// 本组件内联在可滚动的长卡片底部，编辑器顶部通常已经接近或超出视口底部，
// 自适应结果会被钳到最小 320px，代码区又矮又难读。
// 这里显式给一个稳定高度：视口高度的 62%，下限 420px（至少看得到十几行），
// 上限 760px（宽屏下不至于长得离谱）。
const CODE_VIEW_HEIGHT = "clamp(420px, 62vh, 760px)";

export interface AnalysisNodeDetailsProps {
    analysis_node_id?: string;
    /**
     * 当前组件是否由「带视图段的路由」渲染（/analsyis-node-report/:id/:view?）。
     *
     * 只有路由页打开时才把底部视图同步到 URL；弹窗（invoke.analysisNodeDetails）、
     * 内嵌复用（analysis-node-page / analysis-nodes-report）不开启，hook 内部退化为本地状态，
     * 避免把用户在看的那个页面的地址改成 `…/scriptCode`。
     */
    viewFromRoute?: boolean;
    /**
     * 由「承载本组件的标签页」注入的关闭动作（Agent 会话页右侧 MainTabs 会传）。
     *
     * 那种场景下本组件只是一个标签内容：Header 右上角的关闭按钮应该关闭标签，
     * 而不是去动全局 store 里的 analysisNodeId。
     */
    onCloseTab?: () => void;
}

const AnalysisNodeDetails: FC<AnalysisNodeDetailsProps> = ({ analysis_node_id, viewFromRoute, onCloseTab }) => {
    const [detailLoading, setDetailLoading] = useState(false);
    const [sampleDetailMap, setSampleDetailMap] = useState<Record<string, Partial<AnalysisNodeSample>>>({});
    const { analysisNodeId, setAnalysisNodeId } = useStoreRender();
    const { register, unregister } = useComponentStore();
    const message = useGlobalMessage();
    const [selectedSampleDetail, setSelectedSampleDetail] = useState<any>({});
    // 运行中的节点可以打开容器终端（xterm.js -> WebSocket -> kubectl/docker exec）。
    const [terminalOpen, setTerminalOpen] = useState(false);
    // 底部 ViewResolver 当前展示的视图：由路由视图段决定（刷新 / 前进后退 / 切标签页都能恢复），
    // 点击按钮时通过 setResultView 改 URL，不再用 useState 保存，避免"状态只活在内存里"。
    // 视图白名单由 ROUTE_VIEWS（@/routes/route-view）统一提供，这里不再重复传 views；
    // 默认视图（analysisResultDisplay）不写进 URL，节点报告地址保持干净。
    const [resultView, setResultView] = useRouteView<ResultViewKey>({
        defaultView: "analysisResultDisplay",
        enabled: viewFromRoute === true,
    });
    const { containerURL } = useSelector((state: any) => state.user);
    // 参数面板开关：页面显式声明编辑目标（当前分析节点），面板在右侧停靠。
    // 不再依赖全局 rightPanelCollapsed / sideView。
    const [paramsOpen, setParamsOpen] = useState(false)

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
        // 节点切换：视图由 URL 决定（/analsyis-node-report/:id/:view?），
        // 调用方跳转到新节点时通常不带视图段，因此会自动回到默认视图，不需要在这里重置。
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
    //
    // 注意：这里的 nodeId 必须由「详情接口 + 组件入参」推导，不能用 useStoreRender 里的 analysisNodeId。
    // analysisNodeId 是分析报告页自己的全局选中态：在 Agent 会话页的右侧 MainTabs 里打开本组件时
    // 只会传入 analysis_node_id 入参，store 里仍是 null，直接拿它拼 URL 就会请求到
    // /analysis/node/stop/null 这类无效地址（按钮看起来有反应，实际什么也没停）。
    const nodeId = String(selectedSampleDetail.node?.id ?? analysis_node_id ?? "");
    const scriptId = selectedSampleDetail.node?.script_id;

    // 节点详情里的 container_id 是容器模板（go_container_template_definition）的主键。
    // 点击时先按该模板新建一条终端会话（创建即启动容器），再按会话 ID 打开底部终端标签：
    // 会话创建与 WebSocket 连接分开，一个模板可以有多条会话，彼此独立。
    const nodeContainerId = String(selectedSampleDetail.node?.container_id ?? "").trim();
    const nodeTerminalTitle =
        selectedSampleDetail.node?.node_name ||
        selectedSampleDetail.node?.node_id ||
        `AnalysisNode-${nodeId}`;

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
            case "nodeCommand":
                return {
                    view: "nodeCommand",
                    analysis_node_id: nodeId,
                    node_name: selectedSampleDetail.node?.node_name,
                    // 内联渲染同样没有弹窗壳，关闭动作统一回到结果视图。
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
        <ParamsPanelLayout
            open={paramsOpen && Boolean(nodeId)}
            side="right"
            panel={
                <ParamsPanelDock
                    side="right"
                    title="Parameters"
                    onClose={() => setParamsOpen(false)}
                    storageKey="analysisNodeParamsPanelWidth"
                >
                    {nodeId ? (
                        <ParamsEdit
                            target={{ kind: "analysisNode", analysisNodeId: nodeId }}
                            onClose={() => setParamsOpen(false)}
                            onSaved={() => loadSampleDetail(analysis_node_id)}
                        />
                    ) : null}
                </ParamsPanelDock>
            }
        >
            <PanelLayout
                className="analysis-node-details-page page-flat"
                title={selectedSampleDetail?.node?.script_name || "Result Report"}
                bodyStyle={{ padding: 12 }}
                extra={
                    <Space>
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

                        {/* 参数面板开关：组件自己声明编辑目标（当前分析节点），面板在右侧停靠。 */}
                        <Tooltip title={paramsOpen ? "Hide parameters panel" : "Show parameters panel"}>
                            <Button
                                size="small"
                                icon={<ControlOutlined />}
                                type={paramsOpen ? "primary" : "default"}
                                disabled={!nodeId}
                                onClick={() => setParamsOpen((prev) => !prev)}
                            >
                                Parameters
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

                                {/* run.sh 命令视图：与 Params / Code 一样在底部 ViewResolver 内联切换，不弹窗。 */}
                                <Tooltip
                                    title={
                                        resultView === "nodeCommand"
                                            ? "Back to the result view"
                                            : `run.sh - ${selectedSampleDetail.node?.command_path || ""}`
                                    }
                                >
                                    <Button
                                        size="small"
                                        color="cyan"
                                        variant={resultView === "nodeCommand" ? "outlined" : "solid"}
                                        onClick={() => {
                                            // 不弹窗：直接在底部 ViewResolver 里切换视图。
                                            toggleResultView("nodeCommand");
                                        }}
                                    >
                                        {resultView === "nodeCommand" ? "Result" : "Command"}
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
                                                            // 用 nodeId（入参 / 详情）而不是全局 store 的 analysisNodeId，见上方说明。
                                                            if (!nodeId) {
                                                                message.error("Analysis node id is missing");
                                                                return;
                                                            }
                                                            await http.post(`/analysis/node/stop/${nodeId}`)
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
                                                            if (!nodeId) {
                                                                message.error("Analysis node id is missing");
                                                                return;
                                                            }
                                                            await http.post(`/analysis/${nodeId}/run-node`)
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

                                        {/* 底部面板终端（terminal-session）：按节点绑定的容器模板打开 / 聚焦持久终端标签。
                                        终端容器由模板单独创建，与节点是否 running 无关，因此不做状态限制；
                                        切页签、收起面板都不会断开 PTY，重复点击只会聚焦已有标签。 */}
                                        <Tooltip
                                            title={
                                                nodeContainerId
                                                    ? `Open terminal session in the bottom panel (container template ${nodeContainerId})`
                                                    : "container_id is missing from the node detail"
                                            }
                                        >
                                            <Button
                                                size="small"
                                                color="cyan"
                                                variant="solid"
                                                disabled={!nodeContainerId}
                                                onClick={() => {
                                                    void createContainerTerminalSessionApi({
                                                        container_template_id: nodeContainerId,
                                                    })
                                                        .then((resp) => {
                                                            openBottomTerminal(
                                                                resp.data.session_id,
                                                                resp.data.name || nodeTerminalTitle,
                                                            );
                                                        })
                                                        .catch(() => {
                                                            message.error("Failed to create terminal session");
                                                        });
                                                }}
                                            >
                                                Terminal Session
                                            </Button>
                                        </Tooltip>

                                        {/* 弹窗终端直接 exec 进该节点自身的容器，必须节点 running 才可用。 */}
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

                        {onCloseTab || analysisNodeId == analysis_node_id ? (
                            <Tooltip title={`Close ${analysis_node_id}`}>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setParamsOpen(false);
                                        // 标签内嵌（Agent 会话页 MainTabs）时关闭的是标签，不是全局选中节点。
                                        if (onCloseTab) {
                                            onCloseTab();
                                            return;
                                        }
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
                                        // 参数面板在页面右侧停靠，只对本组件生效。
                                        setParamsOpen(true);
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
                        <Card size="small" variant="borderless" styles={{ body: { padding: 12 } }}>
                            <Flex justify="space-between" align="flex-start" gap={12} wrap>
                                <Flex vertical gap={4}>
                                    <Typography.Text type="secondary">node: {selectedSampleDetail.node?.node_id}</Typography.Text>
                                    <Typography.Text type="secondary">
                                        analysis_node_id: {selectedSampleDetail.node?.id}
                                    </Typography.Text>
                                    {selectedSampleDetail.node?.script_id && <Typography.Text type="secondary">
                                        script_id: {selectedSampleDetail.node?.script_id}
                                    </Typography.Text>}


                                    <Typography.Text type="secondary">
                                        container_name: <Tooltip title={selectedSampleDetail.node?.container_image}>
                                            {selectedSampleDetail.node?.container_name} ( {selectedSampleDetail.node?.container_id} )
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
                                    {/* 查看节点原始请求参数（request_param，后端以 JSON 字符串返回），只读弹窗。 */}
                                    <Tag
                                        style={{ cursor: "pointer" }}
                                        onClick={() => {
                                            invoke.nodeRequestParam.open({ node: selectedSampleDetail.node },
                                                {
                                                    title: `Request Param - ${selectedSampleDetail.node?.node_name}`,
                                                    width: 800,
                                                    footer: null,
                                                })
                                        }}>Request Param</Tag>
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
            </PanelLayout>

            {/* 终端弹窗不参与页面滚动区，挂在面板外层（antd Modal 会 portal 到 body）。 */}
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
                        id={nodeId}
                        name={selectedSampleDetail.node?.node_name}
                    />
                )}
            </Modal>
        </ParamsPanelLayout>
    );
};



export default AnalysisNodeDetails;

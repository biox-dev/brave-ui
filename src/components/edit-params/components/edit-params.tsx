import { Button, Empty, Form, Space, Spin, Tag, Tooltip } from "antd"
import { FC, useEffect, useMemo, useRef } from "react"
import { ClearOutlined, RedoOutlined } from "@ant-design/icons"
import CreateOrUpdateParsms from "./create-or-update-parsms"
import { useStoreRender } from "@/context/render/RenderProvider"
import { useEditParamsTarget, type EditParamsTarget } from "../use-edit-params-target"

export type EditParamsPanelProps = {
    /**
     * 编辑哪个对象的参数。由页面显式传入（不再依赖 RenderProvider 里的
     * analysisId / analysisNodeId / relation / script 组合出的隐式上下文）。
     */
    target?: EditParamsTarget | null
    /** 关闭面板（标题栏 / 标签上的关闭按钮）。 */
    onClose?: () => void
    /** 保存成功后的回调（页面可用于刷新自己的数据）。 */
    onSaved?: () => void
}

const EditParamsPanel: FC<EditParamsPanelProps> = ({ target, onClose, onSaved }) => {
    const [form] = Form.useForm()
    const store = useStoreRender() ?? {}
    const {
        // 运行状态仍然来自 RenderProvider：分析开始 / 结束由 SSE 写入，
        // 面板只消费，避免和后端实时事件脱节。
        formStatus,
        setFormStatus,
        setAnalysisId: setGlobalAnalysisId,
        setAnalysisNodeId: setGlobalAnalysisNodeId,
        // 旧入口（view="editParamsPanel"）没有显式 target，用全局上下文兜底。
        analysisId: contextAnalysisId,
        analysisNodeId: contextAnalysisNodeId,
        relation,
        script,
    } = store
    const jobStatus = useRef<any>(null)

    // 兼容旧入口：没传 target 时沿用 RenderProvider 的优先级（节点 > 分析 > 流程 > 脚本）。
    // 新页面（script-panel / workflow-panel / 分析报告 / 节点详情）都显式传 target。
    const fallbackTarget = useMemo<EditParamsTarget | null>(() => {
        if (contextAnalysisNodeId) {
            return { kind: "analysisNode", analysisNodeId: String(contextAnalysisNodeId) }
        }
        if (contextAnalysisId) {
            return { kind: "analysis", analysisId: String(contextAnalysisId) }
        }
        if (relation?.id) {
            return { kind: "workflow", workflowId: String(relation.id) }
        }
        if (script?.id) {
            return { kind: "script", scriptId: String(script.id) }
        }
        return null
    }, [contextAnalysisNodeId, contextAnalysisId, relation?.id, script?.id])

    const {
        data,
        loading,
        effectiveTarget,
        analysisId,
        analysisNodeId,
        scriptId,
        reload,
        setAnalysisId,
        setAnalysisNodeId,
    } = useEditParamsTarget(target ?? fallbackTarget)

    useEffect(() => {
        if (!data) {
            return
        }
        if (effectiveTarget?.kind === "analysis" || effectiveTarget?.kind === "analysisNode") {
            form.resetFields()
            // request_param 只含分析参数；名称与缓存策略来自顶层元数据字段。
            form.setFieldsValue({
                ...data.requestParam,
                analysis_name: data.nodeName,
                cache_type: data.cacheType,
            })
        }
        // 分析 / 节点返回真实 status，流程 / 脚本为 null（与旧行为一致）。
        setFormStatus?.(data.status ?? null)
        // form / setFormStatus 都是稳定引用；data 只在目标变化或刷新后更新。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, effectiveTarget])

    /**
     * 保存后切换面板目标：让后续保存更新刚创建的对象，而不是重复创建。
     * 同时同步到 RenderProvider 的全局 id —— SSE 事件（analysis_started 等）
     * 仍然按这个 id 分发运行状态。
     */
    const handleSetAnalysisId = (id?: string | null) => {
        setAnalysisId(id)
        setGlobalAnalysisId?.(id ?? null)
    }
    const handleSetAnalysisNodeId = (id?: string | null) => {
        setAnalysisNodeId(id)
        setGlobalAnalysisNodeId?.(id ?? null)
    }

    /** 标签上的关闭按钮：只关闭面板，不改变页面当前选中的分析 / 节点。 */
    const handleCloseTarget = () => {
        onClose?.()
    }

    return (
        <Spin spinning={loading}>
            {data ? (
                <>
                    <Space wrap>
                        {analysisId ? (
                            <Tooltip title={analysisId}>
                                <Tag color="green" closable onClose={handleCloseTarget}>
                                    Analysis({analysisId})
                                </Tag>
                            </Tooltip>
                        ) : null}
                        {analysisNodeId ? (
                            <Tooltip title={analysisNodeId}>
                                <Tag color="blue" closable onClose={handleCloseTarget}>
                                    Node Analysis ({analysisNodeId})
                                </Tag>
                            </Tooltip>
                        ) : null}
                        <Button
                            onClick={() => void reload()}
                            size="small"
                            icon={<RedoOutlined />}
                            aria-label="Reload parameters"
                        />
                        <Tag>{formStatus}</Tag>
                        <Tooltip title="Reset form">
                            <Button
                                onClick={() => {
                                    form.resetFields()
                                    void reload()
                                }}
                                size="small"
                                icon={<ClearOutlined />}
                                aria-label="Reset form"
                            />
                        </Tooltip>
                    </Space>

                    <CreateOrUpdateParsms
                        showCreate
                        form={form}
                        {...data}
                        // 目标参数显式覆盖 data 中的同名字段，保证保存请求带上正确的 id。
                        // 非当前类型的目标传 null（而不是 undefined），避免回退到全局上下文。
                        analysisId={analysisId ?? null}
                        analysisNodeId={analysisNodeId ?? null}
                        // 节点目标需要把节点绑定的脚本 id 一起提交，因此回退到加载到的 data.scriptId。
                        scriptId={scriptId ?? data.scriptId ?? null}
                        isScriptTarget={effectiveTarget?.kind === "script"}
                        formStatus={formStatus}
                        setFormStatus={setFormStatus}
                        setAnalysisId={handleSetAnalysisId}
                        setAnalysisNodeId={handleSetAnalysisNodeId}
                        jobStatus={jobStatus}
                        callback={onSaved}
                    />
                </>
            ) : (
                <Empty description={loading ? "Loading parameters" : "No parameters to edit"} />
            )}
        </Spin>
    )
}

export default EditParamsPanel

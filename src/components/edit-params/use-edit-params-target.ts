import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { editNodeParamsApi, editParamsV2Api } from "@/api/analysis"
import { getScriptFormApi, getWorkflowFormApi } from "@/api/workflow"
import { onParamsRefresh } from "./params-refresh"

/**
 * 参数编辑「目标」——明确描述「为哪个业务对象编辑参数」。
 *
 * 以前这些信息藏在 `RenderProvider` 的多个全局状态里（analysisId / analysisNodeId /
 * relation / script），再由 `sideView === "editParamsPanel"` 决定加载哪一份表单，
 * 页面必须先写全局状态，面板再反读，任何一个页面都能影响另一个页面。
 *
 * 现在页面只用 target 声明意图，面板自己加载、自己刷新，互不影响：
 * - analysis     分析记录（/analysis/edit-params-v2/:id）
 * - analysisNode 分析节点（/analysis/edit-node-params/:id）
 * - workflow     工作流（/workflow/:id/form）
 * - script       脚本（/script/:id/form）
 */
export type EditParamsTarget =
    | { kind: "analysis"; analysisId: string }
    | { kind: "analysisNode"; analysisNodeId: string }
    | { kind: "workflow"; workflowId: string }
    | { kind: "script"; scriptId: string }

/** target 的稳定字符串标识，用于 memo / effect 依赖（避免对象字面量每次渲染都变化）。 */
export const editParamsTargetKey = (target?: EditParamsTarget | null): string => {
    if (!target) {
        return ""
    }
    switch (target.kind) {
        case "analysis":
            return `analysis:${target.analysisId}`
        case "analysisNode":
            return `analysisNode:${target.analysisNodeId}`
        case "workflow":
            return `workflow:${target.workflowId}`
        case "script":
            return `script:${target.scriptId}`
        default:
            return ""
    }
}

/**
 * 参数面板需要的表单数据，形状与 `CreateOrUpdateParsms` 的 props 对齐。
 * `requestParam` 只放分析参数；分析元数据（id / workflow_id / script_id / 名称 / 缓存策略）
 * 作为平级字段传给提交逻辑。
 */
export type EditParamsData = {
    requestParam: any
    formJson?: any[]
    dataMap?: any
    databases?: any
    workflowId?: any
    scriptId?: any
    nodeName?: string
    cacheType?: any
    status?: any
}

const loadTarget = async (target: EditParamsTarget): Promise<EditParamsData> => {
    switch (target.kind) {
        case "analysis": {
            const resp = await editParamsV2Api(target.analysisId)
            return {
                requestParam: resp.data.request_param,
                // 分析元数据与 request_param 分开传递，保证 request_param 只含分析参数。
                workflowId: resp.data.workflow_id,
                nodeName: resp.data.analysis_name,
                cacheType: resp.data.cache_type,
                dataMap: { ...resp.data.analysis_result },
                formJson: resp.data.formJson,
                status: resp.data.status ?? null,
            }
        }
        case "analysisNode": {
            const resp = await editNodeParamsApi(target.analysisNodeId)
            return {
                requestParam: resp.data.request_param,
                scriptId: resp.data.script_id,
                nodeName: resp.data.node_name,
                cacheType: resp.data.cache_type,
                formJson: resp.data.formJson,
                dataMap: resp.data.analysis_result,
                status: resp.data.status ?? null,
            }
        }
        case "workflow": {
            const resp = await getWorkflowFormApi({ workflowId: target.workflowId })
            return {
                requestParam: {},
                workflowId: target.workflowId,
                dataMap: { ...resp.data.analysis_result },
                formJson: resp.data.formJson,
                databases: resp.data.databases,
                status: null,
            }
        }
        case "script": {
            const resp = await getScriptFormApi(target.scriptId)
            return {
                // script_id 走请求顶层字段，不写入 request_param。
                requestParam: {},
                scriptId: target.scriptId,
                dataMap: { ...resp.data.analysis_result },
                formJson: resp.data.formJson,
                status: null,
            }
        }
        default:
            throw new Error("unsupported params target")
    }
}

type LoadedState = {
    key: string
    data: EditParamsData
}

/**
 * 按 target 加载参数表单数据。
 *
 * 返回值里的 `setAnalysisId` / `setAnalysisNodeId` 用于保存后切换面板目标：
 * - 工作流 / 脚本第一次保存后会返回 analysis_id / analysis_node_id，
 *   面板应当继续编辑刚创建的对象，而不是重复创建；
 * - 这两个 setter 只影响当前面板，不再写进全局 `RenderProvider`，
 *   因此同一时间打开多个页面也不会互相覆盖。
 */
export const useEditParamsTarget = (target?: EditParamsTarget | null) => {
    const baseKey = editParamsTargetKey(target)

    // override 记录「保存后切换到的新目标」。带上 baseKey：页面切换对象后
    // （例如左侧树里点另一个分析）旧 override 自动失效，不需要额外 effect 清理。
    const [override, setOverride] = useState<{ baseKey: string; target: EditParamsTarget } | null>(null)
    const effectiveOverride = override && override.baseKey === baseKey ? override.target : null
    const rawTarget = effectiveOverride ?? target ?? null
    const effectiveKey = editParamsTargetKey(rawTarget)
    // 页面常把 target 写成对象字面量（每次渲染都是新引用），这里按「内容 key」固定引用，
    // 否则下游 effect / useCallback 会每次渲染都被判定为依赖变化。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const effectiveTarget = useMemo(() => rawTarget, [effectiveKey])

    const [loaded, setLoaded] = useState<LoadedState | null>(null)
    const [loading, setLoading] = useState(false)
    const requestIdRef = useRef(0)

    const reload = useCallback(async () => {
        if (!effectiveTarget) {
            requestIdRef.current += 1
            setLoaded(null)
            setLoading(false)
            return
        }
        const requestId = ++requestIdRef.current
        const key = editParamsTargetKey(effectiveTarget)
        setLoading(true)
        try {
            const data = await loadTarget(effectiveTarget)
            // 目标切换 / 组件卸载后到达的旧响应直接丢弃。
            if (requestIdRef.current === requestId) {
                setLoaded({ key, data })
            }
        } catch (error) {
            console.error("load params failed", error)
        } finally {
            if (requestIdRef.current === requestId) {
                setLoading(false)
            }
        }
        // effectiveTarget 由 effectiveKey 唯一决定，用 key 做依赖即可。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveKey])

    useEffect(() => {
        reload()
        return () => {
            // 卸载后让在途请求失效。
            requestIdRef.current += 1
        }
    }, [reload])

    // 表单内控件（如上传文件）触发的刷新：由 RenderProvider.loadParams 统一广播。
    useEffect(() => onParamsRefresh(() => { void reload() }), [reload])

    const setAnalysisId = useCallback((analysisId?: string | null) => {
        setOverride(analysisId ? { baseKey, target: { kind: "analysis", analysisId } } : null)
    }, [baseKey])

    const setAnalysisNodeId = useCallback((analysisNodeId?: string | null) => {
        setOverride(analysisNodeId ? { baseKey, target: { kind: "analysisNode", analysisNodeId } } : null)
    }, [baseKey])

    const resetTarget = useCallback(() => {
        setOverride(null)
    }, [])

    // 数据必须与当前目标一致才返回，避免切换对象时短暂露出上一个对象的表单。
    const data = loaded && loaded.key === effectiveKey ? loaded.data : null

    const ids = useMemo(() => {
        switch (effectiveTarget?.kind) {
            case "analysis":
                return { analysisId: effectiveTarget.analysisId, analysisNodeId: undefined, scriptId: undefined, workflowId: undefined }
            case "analysisNode":
                return { analysisId: undefined, analysisNodeId: effectiveTarget.analysisNodeId, scriptId: undefined, workflowId: undefined }
            case "workflow":
                return { analysisId: undefined, analysisNodeId: undefined, scriptId: undefined, workflowId: effectiveTarget.workflowId }
            case "script":
                return { analysisId: undefined, analysisNodeId: undefined, scriptId: effectiveTarget.scriptId, workflowId: undefined }
            default:
                return { analysisId: undefined, analysisNodeId: undefined, scriptId: undefined, workflowId: undefined }
        }
    }, [effectiveTarget])

    return {
        data,
        loading,
        reload,
        effectiveTarget,
        ...ids,
        setAnalysisId,
        setAnalysisNodeId,
        resetTarget,
    }
}

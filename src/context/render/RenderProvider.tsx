import { createContext, FC, useContext, useEffect, useMemo, useState } from "react"
import { useComponentStore } from "@/event-bus/stores/components"
import { emitParamsRefresh } from "@/components/edit-params/params-refresh"

export const RenderContext = createContext<any>(null)

export const useStoreRender = () => {
    return useContext(RenderContext)
}

export const RenderProvider: FC<any> = ({ children }) => {

    // const [componentParentIdsMap, setComponentParentIdsMap] = useState<any>({})
    const [resultTableList, setResultTableList] = useState<any>()
    const [toolsPanelView, setToolsPanelView] = useState<any>("inputFileComponent")
    const [analysisId, setAnalysisId] = useState<any>(null)
    const [script, setScript] = useState<any>(null)
    const [loading, setLoading] = useState<boolean>(false)

    const [workflow, setWorkflow] = useState<any>()

    const [analysisNodeId, setAnalysisNodeId] = useState<any>(null)

    // const [formParam, setFormParam] = useState<FromParamType | null>(null)
    const [openAnalysis, setOpenAnalysis] = useState<any>([])
    const [relation, setRelation] = useState<any>(null)
    const [requestParam, setRequestParam] = useState<any>(null)
    const [formStatus, setFormStatus] = useState<any>(null)

    const updateFormStatus = (args: any) => {
        // debugger
        if (args?.status) {
            setFormStatus(args.status)
        }
        // setFormStatus("running");
    }
    const instance = useMemo(() => {
        return {
            dagStarted: (args: any) => {
                updateFormStatus(args)
            }, dagDone: (args: any) => {
                console.log(args)
                updateFormStatus(args)
            }

        }
    }, [])
    const { register, unregister } = useComponentStore();

    useEffect(() => {
        if (analysisId) {
            console.log(analysisId)
            register("analysis", analysisId, instance);
            return () => {
                // debugger
                unregister("analysis", analysisId, instance);
            }
        }

    }, [analysisId]);
    const instanceNode = useMemo(() => {
        return {
            analysisStarted: (args: any) => {
                updateFormStatus(args)
            },
            analysisDone: (args: any) => {
                updateFormStatus(args)
            }

        }
    }, [])
    useEffect(() => {
        if (analysisNodeId) {
            register("analysis", analysisNodeId, instanceNode);
            return () => {
                unregister("analysis", analysisNodeId, instanceNode);
            }
        }

    }, [analysisNodeId]);

    // 业务上下文（llmEnv）已移除：工作目录固定为当前激活项目的默认目录。

    const clear = () => {
        // setComponentParentIdsMap({})
        setResultTableList(null)
        setToolsPanelView("inputFileComponent")
        setAnalysisId(null)
        setRelation(null)
        // setFormParam(null)
        setRequestParam(null)
        setOpenAnalysis([])
        setScript(null)
        setAnalysisNodeId(null)
    }

    /**
     * 参数面板刷新入口。
     *
     * 参数面板已经不再从 RenderProvider 的全局 requestParam 读数据：它按页面传进来的
     * `EditParamsTarget` 自己加载。这里只保留一个与业务无关的广播，供表单内控件
     * （例如 `collected-file-list` 上传文件后）通知当前打开的面板重新拉取表单数据。
     *
     * `force` 仅为兼容旧调用方（`loadParams(true)`）保留。
     */
    const loadParams = async (_force = false) => {
        void _force
        emitParamsRefresh()
    }


    // 参数面板自己注册刷新监听；这里仍保留 forms 组件通道，保证
    // `component.invoke(forms, analysis, reload)` 之类的旧调用也能触发刷新。
    useEffect(() => {
        register("forms", "analysis", {
            reload: () => loadParams(true)
        });
        return () => {
            unregister("forms", "analysis");
        }
    }, [register, unregister]);

    const addOpenAnalysis = (analysis: any) => {
        if (openAnalysis.find((item: any) => item.analysis_id === analysis.analysis_id)) {
            return
        }
        setOpenAnalysis((prev: any) => [...prev, analysis])
    }

    const checkIsOpen = (analysis_id: string) => {
        return openAnalysis.find((item: any) => item.analysis_id === analysis_id)
    }

    const closeAnalysis = (analysis_id: string) => {

        setOpenAnalysis((prev: any) => prev.filter((item: any) => item.analysis_id !== analysis_id))
    }
    return (
        <RenderContext.Provider
            value={{
                // componentParentIdsMap,
                // setComponentParentIdsMap,
              
                resultTableList,
                setResultTableList,
                toolsPanelView,
                setToolsPanelView,
                analysisId,
                setAnalysisId,
                relation,
                setRelation,
                requestParam,
                clear,
                openAnalysis,
                addOpenAnalysis,
                checkIsOpen,
                closeAnalysis,
                loadParams,
                setAnalysisNodeId,
                analysisNodeId,
                formStatus,
                setFormStatus,
                setScript,
                script,
                loading,
                setLoading,
                workflow,
                setWorkflow

            }}
        >
            {children}
        </RenderContext.Provider>
    )
}
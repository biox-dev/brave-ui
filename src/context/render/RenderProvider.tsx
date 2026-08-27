import axios from "axios"
import { createContext, FC, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useSideViewContext } from "../side/SideViewContext"
import { useComponentStore } from "@/event-bus/stores/components"
import { getScriptFormApi, getWorkflowFormApi } from "@/api/workflow"
import { useDispatch, useSelector } from "react-redux"
import { editNodeParamsApi, editParamsV2Api } from "@/api/analysis"
import { setUserItem } from "@/store/userSlice"

export const RenderContext = createContext<any>(null)

export const useStoreRender = () => {
    return useContext(RenderContext)
}

type FromParamType = {
    type: string,
    bizKey: string
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
    const [formData, setFormData] = useState<any>(null)
    const [formStatus, setFormStatus] = useState<any>(null)
    // const { setSideView, sideView, sideOptions, setSideOptions } = useSideViewContext();
    const { sideView } = useSelector((state: any) => state.user); // 'light' | 'dark'

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

    const clear = () => {
        // setComponentParentIdsMap({})
        setResultTableList(null)
        setToolsPanelView("inputFileComponent")
        setAnalysisId(null)
        setRelation(null)
        // setFormParam(null)
        setRequestParam(null)
        setOpenAnalysis([])
        setFormData(null)
        setScript(null)
        setAnalysisNodeId(null)
    }
    const buildRequestParams = () => {
        let dataComponentIds: any = []
        if (relation.inputFile) {
            dataComponentIds = relation.inputFile.map((item: any) => item.component_id)

        }
        const requestParams = {
            analysis_type: "workflow",
            component_id: relation.component_id,
            data_component_ids: JSON.stringify(dataComponentIds),
            // component_parent_ids_map: componentParentIdsMap,
            relation_id: relation.relation_id,
        }
        return {
            requestParam: requestParams,
            dataMap: resultTableList ? resultTableList : {},
            formJson: relation.formJson,
            databases: relation.databases
        }
    }
    const loadToolsForm = async (tools_id: any) => {
        const resp = await getWorkflowFormApi({
            workflowId: tools_id
            // projectId: project_id
        })
        // const resp = await axios.get(`/tools/get-from-json/${tools_id}`)
        // return resp.data
        return {
            dataMap: { ...resp.data.analysis_result },
            formJson: resp.data.formJson,
        }
    }
    const loadAnalysis = async (analysisId: any) => {
        // setLoading(true)
        // const resp = await axios.post(`/analysis/edit-params-v2/${analysisId}`)
        const resp = await editParamsV2Api(analysisId)
        return {
            requestParam: resp.data.request_param,
            dataMap: { ...resp.data.analysis_result },
            formJson: resp.data.formJson,
            // databases: resp.data.databases,
            // upstreamFormJson: resp.data.upstreamFormJson,
            status: resp.data.status,
        }
    }
    const loadNodeAnalysis = async (nodeAnalysisId: any) => {
        // /analysis/edit-node-params/{analysis_node_id}
        // const resp = await axios.post(`/analysis/edit-node-params/${nodeAnalysisId}`)
        const resp = await editNodeParamsApi(nodeAnalysisId)
        return {
            requestParam: resp.data.request_param,
            formJson: resp.data.formJson,
            dataMap: resp.data.analysis_result,
            // databases: resp.data.databases,
            status: resp.data.status,
        }
    }
    const loadParams = async (force = false) => {
        console.log("sideView", sideView)

        // debugger
        if (sideView == "editParamsPanel") {
            setLoading(true)
            if (analysisNodeId) {
                const data = await loadNodeAnalysis(analysisNodeId)
                setFormStatus(data.status)
                setRequestParam({
                    ...data,
                    type: "nodeAnalysis",
                })
            
            } else if (analysisId) {

                const data = await loadAnalysis(analysisId)
                // debugger
                setFormStatus(data.status)
                setRequestParam({
                    ...data,
                    type: "analysis",
                })
            } else if (relation) {
                setFormStatus(null)
                let data = formData;
                if (!data || force) {
                    data = await loadToolsForm(relation.relation_id)
                    // setFormData(data)
                }
                const params = buildRequestParams()
                setRequestParam({
                    ...params,
                    ...data,

                })


            } else if (script) {
                console.log("script", script)
                const resp = await getScriptFormApi(script.id)
                console.log(resp)
                setRequestParam({
                    requestParam: {
                        script_id: script.id,
                        analysis_type: "script"
                    },
                    dataMap: { ...resp.data.analysis_result },
                    formJson: resp.data.formJson,
                })
             

            }
            setLoading(false)
        }

    }
    useEffect(() => {
        register("forms", "analysis", {
            reload: () => {
                // debugger
                console.log("reload analysis form")
                loadParams(true)
            }
        });
        return () => {
            // debugger
            unregister("forms", "analysis");
        }


    }, [analysisNodeId, analysisId, sideView, relation]);

    useEffect(() => {
        loadParams()
    }, [relation, sideView, analysisId, analysisNodeId, script])

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
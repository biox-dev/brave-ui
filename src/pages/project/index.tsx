import { FC, useEffect, useState } from "react"
import { Button, Card, Empty, Flex, Popconfirm, Skeleton, Space, Spin, Tabs } from "antd"
import ComponentsDetailsRender from '../../core/ui-renderer/ViewResolver';
import { renderViewButton } from "@/utils/render-view-btn"
import { useDispatch, useSelector } from "react-redux"
import { ReloadOutlined } from "@ant-design/icons"
import { useSideViewContext } from "@/context/side/SideViewContext"
import { invoke } from "@/core/ui-system/invokeV2";
import { deleteProjectReportApi, getProjectReportDetailApi, listProjectReportApi, type ProjectReportDetailItem, type ProjectReportItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { setUserItem } from "@/store/userSlice";

const Project: FC<any> = () => {
    const [view, setView] = useState<any>("analysisDocView")
    const { project, activeProjectReportId } = useSelector((state: any) => state.user);
    const dispatch = useDispatch()
    const { setSideView, setSideOptions ,setLeftPaneContent,clearLeftPane} = useSideViewContext();
    const [loading, setLoading] = useState(false)
    const message = useGlobalMessage()
    const [reportList, setReportList] = useState<ProjectReportItem[]>([])
    const [activeReport, setActiveReport] = useState<ProjectReportDetailItem>()
    const [activeReportId, setActiveReportId] = useState<string | undefined>(activeProjectReportId || undefined)

    const loadProjectReports = async (preferReportID?: string) => {
        // if (!project) return;
        setLoading(true)
        const listResp = await listProjectReportApi()
        setLoading(false)
        const listData = Array.isArray(listResp.data) ? listResp.data : []

        setReportList(listData)

        if (listData.length === 0) {
            setActiveReportId(undefined)
            setActiveReport(undefined)
            dispatch(setUserItem({ activeProjectReportId: null }))
            return
        }

        const fallbackID = String(listData[0]?.id)
        const preferID = preferReportID ?? activeProjectReportId ?? undefined
        const nextID = (preferID && listData.some((item: any) => String(item.id) === String(preferID)))
            ? String(preferID)
            : fallbackID
        setActiveReportId(nextID)
        dispatch(setUserItem({ activeProjectReportId: nextID }))
    }

    const loadReportDetail = async (id?: string) => {
        if (!id) {
            setActiveReport(undefined)
            return
        }

        const resp = await getProjectReportDetailApi(id)
        setActiveReport(resp.data)
    }

    const openCreateReportModal = async () => {
        if (!project) return
        try {
            const created = await invoke.projectReportItemForm.openAsync(
                {
                    mode: "create",
                    project_id: project,
                },
                {
                    title: "Create Project Report Item",
                    footer: null,
                    width: 560,
                }
            )
            await loadProjectReports(created?.id)
        } catch {
        }
    }

    const openUpdateReportModal = async () => {
        if (!activeReport) {
            message.warning("Please select a report tab first")
            return
        }

        try {
            await invoke.projectReportItemForm.openAsync(
                {
                    mode: "update",
                    project_id: project,
                    report: activeReport,
                },
                {
                    title: "Update Project Report Item",
                    footer: null,
                    width: 560,
                }
            )
            await loadProjectReports(activeReport.id)
        } catch {
        }
    }

    const deleteActiveReport = async () => {
        if (!activeReport) {
            message.warning("Please select a report tab first")
            return
        }

        await deleteProjectReportApi({
            id: activeReport.id,
        })
        message.success("Deleted successfully")
        await loadProjectReports()
    }


    // useEffect(() => {
    //     setSideOptions([
    //         {
    //             label: "LLM",
    //             value: "llm-card"
    //         }, {
    //             label: "Container App",
    //             value: "appSessionPage"
    //         }
    //     ])
    //     // setSideView("analysis-tools")
    //     return () => {
    //         setSideOptions([])
    //         setSideView("llm-card")
    //     }
    // }, [])

       useEffect(() => {
        setSideOptions([
            {
                label: "LLM",
                value: "llm-card"
            }, {
                label: "Container App",
                value: "appSessionPage"
            },
            {
                label: "Parameters",
                value: "editParamsPanel"
            }
        ])
        setSideView("editParamsPanel")
      
        return () => {
            setSideOptions([])
            setSideView("llm-card")
            clearLeftPane()
        }
    }, [])

    useEffect(() => {
        loadProjectReports()
    }, [project])

    useEffect(() => {
        loadReportDetail(activeReportId)
    }, [activeReportId])


    return <div >
        <Card
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                height: " 100%",
                boxShadow: "none"
            }}
            styles={{
                body: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    height: " 100%",
                    // padding: 0,
                    overflowY: "auto"
                }
            }}
            variant="borderless" size="small" extra={
                <Flex gap={"small"}>
                    {/* <Button size="small" onClick={()=>{
                        window.open(`${getPathname()}/docs/${project}/`,"_blank")
                    }}>docs</Button> */}
                    {reportList.length > 0 && <Space>
                        {renderViewButton(view, setView, "analysisDocView", "View")}
                        {renderViewButton(view, setView, "analysisDocEditor", "Edit")}
                    </Space>}


                    <Button size="small" color="cyan" variant="solid" onClick={openCreateReportModal}>Add Item</Button>
                    {activeReport && <Space>
                        <Button size="small" color="cyan" variant="solid" onClick={openUpdateReportModal}>Edit Item</Button>
                        <Popconfirm title="Delete selected report item?" onConfirm={deleteActiveReport}>
                            <Button size="small" color="red" variant="solid">Delete Item</Button>
                        </Popconfirm>
                    </Space>

                    }

                    <Button icon={<ReloadOutlined></ReloadOutlined>} size="small" color="cyan" variant="solid" onClick={() => {
                        loadProjectReports(activeReportId)
                    }}></Button>
                </Flex>

            }>
            {/* {JSON.stringify(reportList)} */}
            <Spin spinning={loading}>
                {reportList.length > 0 ? <>
                    <Tabs
                        size="small"

                        activeKey={activeReportId ? String(activeReportId) : undefined}
                        onChange={(key) => {
                            setActiveReportId(key)
                            dispatch(setUserItem({ activeProjectReportId: key }))
                        }}
                        items={reportList.map((item) => ({
                            key: String(item.id),
                            label: item.title || `Untitled-${item.id}`,
                        }))}
                    />

                    <ComponentsDetailsRender view={view}
                      
                        project_id={project}
                        report={activeReport}
                        content={activeReport?.content}
                        onSaved={() => loadReportDetail(activeReport?.id)}></ComponentsDetailsRender>

                </> : <Empty description="No project report item, please create one first" />}
            </Spin>
        </Card>

    </div>
}

export default Project
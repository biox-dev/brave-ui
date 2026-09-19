import { Button, Card, Empty, Popconfirm, Segmented, Skeleton, Spin, Tag, Tooltip } from "antd"
import { DeleteOutlined, FileTextOutlined, ReloadOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router"
import { useModal } from "@/hooks/useModal"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useStoreRender } from "@/context/render/RenderProvider"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import Markdown from "@/components/markdown"
import GitStateActions from "../components-relation/components/git-state-actions"
import { useI18n } from "@/hooks/useI18n"
import { http } from "@/api/client/http"
import "./script-panel.css"

/** Views the script panel can switch between. */
type ScriptViewKey = "analysisNodePage" | "createOrUpdateScript" | "scriptCode" | "PublishToolsV2"

/** Default view; reset whenever the mounted component type changes. */
const DEFAULT_VIEW: ScriptViewKey = "analysisNodePage"

type ScriptPanelProps = { component_type?: string }

const ScriptPanel: FC<ScriptPanelProps> = ({ component_type }) => {
    const { script_id } = useParams()
    const { locale } = useI18n()
    const zh = locale !== "en_US"
    const message = useGlobalMessage()
    const { openModal } = useModal()
    const { script, setScript, clear } = useStoreRender()

    const [view, setView] = useState<ScriptViewKey>(DEFAULT_VIEW)
    const [loading, setLoading] = useState(false)

    const loadScript = useCallback(async (scriptId: string) => {
        setLoading(true)
        try {
            const resp = await http.get(`/script/${scriptId}/get-script`)
            setScript(resp.data)
        } finally {
            setLoading(false)
        }
    }, [setScript])

    const reload = useCallback(() => {
        if (script?.id) {
            loadScript(String(script.id))
        }
    }, [script?.id, loadScript])

    useEffect(() => {
        if (component_type !== "script" || !script_id) {
            return
        }
        loadScript(decodeURIComponent(script_id))
    }, [component_type, script_id, loadScript])

    // Reset the shared script store only when the panel unmounts.
    useEffect(() => {
        return () => {
            clear()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Available tabs depend on whether the script has been published (component_id).
    const views = useMemo<{ label: string; value: ScriptViewKey }[]>(() => {
        const options: { label: string; value: ScriptViewKey }[] = []
        if (script?.component_id) {
            options.push(
                { label: zh ? "分析节点" : "Analysis Nodes", value: "analysisNodePage" },
                { label: zh ? "结构" : "Structure", value: "createOrUpdateScript" },
                { label: zh ? "代码" : "Code", value: "scriptCode" },
            )
        }
        options.push({ label: zh ? "发布" : "Publish", value: "PublishToolsV2" })
        return options
    }, [script?.component_id, zh])

    // Keep the active tab valid when the script (or its publish state) changes.
    useEffect(() => {
        if (!views.some((item) => item.value === view)) {
            setView(views[0].value)
        }
    }, [views, view])

    const handleDelete = async () => {
        await http.post(`/script/delete/${encodeURIComponent(script.id)}`)
        message.success(zh ? "脚本已删除" : "Script deleted")
        clear()
    }

    return (
        <div className="script-panel">
            <Card size="small" className="script-panel-card" styles={{ body: { padding: 0 } }}>
                <Spin spinning={loading}>
                    {script ? (
                        <>
                            <header className="script-panel-header">
                                <div className="script-panel-heading">
                                    <div className="script-panel-title-row">
                                        <FileTextOutlined className="script-panel-icon" />
                                        <Tooltip title={script.script_path || script.component_name}>
                                            <span className="script-panel-title">
                                                {script.component_name || script.script_path || script.id}
                                            </span>
                                        </Tooltip>
                                        {script.script_type ? (
                                            <Tag color="blue" style={{ marginInlineEnd: 0 }}>{script.script_type}</Tag>
                                        ) : null}
                                        <GitStateActions entity="script" item={script} onReload={reload} />
                                    </div>
                                    {script.script_path ? (
                                        <Tooltip title={script.script_path}>
                                            <span className="script-panel-path">{script.script_path}</span>
                                        </Tooltip>
                                    ) : null}
                                </div>

                                <div className="script-panel-actions">
                                    <Segmented
                                        size="small"
                                        value={view}
                                        options={views}
                                        onChange={(value) => setView(value as ScriptViewKey)}
                                    />
                                    <Tooltip title={zh ? "刷新" : "Refresh"}>
                                        <Button size="small" icon={<ReloadOutlined />} onClick={reload} />
                                    </Tooltip>
                                    <Popconfirm
                                        title={zh ? "确定删除该脚本？" : "Delete this script?"}
                                        description={zh
                                            ? "若存在分析节点或已被工作流引用，则无法删除。"
                                            : "Cannot delete when analysis nodes exist or this script is referenced by a workflow."}
                                        onConfirm={handleDelete}
                                    >
                                        <Tooltip title={zh ? "删除" : "Delete"}>
                                            <Button size="small" danger icon={<DeleteOutlined />} />
                                        </Tooltip>
                                    </Popconfirm>
                                </div>
                            </header>

                            {script.description ? (
                                <div className="script-panel-description">
                                    <Markdown data={script.description} />
                                </div>
                            ) : null}

                            <div className="script-panel-body">
                                <ViewResolver
                                    type="script"
                                    store={script}
                                    callback={reload}
                                    view={view}
                                    script_id={script.id}
                                    component={script}
                                    openModal={openModal}
                                    structure={{ component_type }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="script-panel-placeholder">
                            {loading ? (
                                <Skeleton active />
                            ) : (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={zh ? "请在左侧选择一个脚本" : "Select a script from the left"}
                                />
                            )}
                        </div>
                    )}
                </Spin>
            </Card>
        </div>
    )
}

export default ScriptPanel
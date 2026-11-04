import { Button, Card, Empty, Popconfirm, Segmented, Skeleton, Spin, Tag, Tooltip } from "antd"
import { DeleteOutlined, FileTextOutlined, ReloadOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import { useModal } from "@/hooks/useModal"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useStoreRender } from "@/context/render/RenderProvider"
import ViewResolver from "@/core/ui-renderer/ViewResolver"
import Markdown from "@/components/markdown"
import GitStateActions from "../components-relation/components/git-state-actions"
import { useI18n } from "@/hooks/useI18n"
import { useRouteMainTabTitle } from "@/hooks/useMainTabTitle"
import { useRouteView } from "@/hooks/useRouteView"
import type { ScriptPanelView } from "@/routes/route-view"
import { http } from "@/api/client/http"
import "./script-panel.css"

/**
 * Views the script panel can switch between.
 * 视图名同时是路由的「视图段」（/c/scripts/:script_id/:view?），白名单登记在
 * @/routes/route-view 的 ROUTE_VIEWS；布局层用同一份配置把视图段从标签页身份里去掉。
 */
type ScriptViewKey = ScriptPanelView

/** Default view; the tab list is static so this is always a valid value. */
const DEFAULT_VIEW: ScriptViewKey = "analysisNodePage"

type ScriptPanelProps = { component_type?: string }

const ScriptPanel: FC<ScriptPanelProps> = ({ component_type }) => {
    const { script_id } = useParams()
    const { locale } = useI18n()
    const zh = locale !== "en_US"
    const message = useGlobalMessage()
    const { openModal } = useModal()
    const { script, setScript, clear } = useStoreRender()

    // 当前视图由路由视图段决定（/c/scripts/:script_id/:view?）：刷新、前进后退、切标签页都能恢复；
    // 切换到另一个脚本时地址里不带视图段，会自动回到默认视图。
    // 路由不是 /c/scripts/:id（例如 /c/scripts 列表页、/c/file）时 hook 自动退化为本地状态。
    const [view, setView] = useRouteView<ScriptViewKey>({ defaultView: DEFAULT_VIEW })
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
    

    // 统一标签页标题通道：详情加载完成后把脚本名同步给 MainTabs，
    // 直接打开/刷新该路由时标签页也能显示脚本名。
    // useRouteMainTabTitle 只登记「id 与当前路由一致」的数据：本组件在 /c/scripts/:script_id
    // 之间切换时不会重新挂载，旧数据会残留一帧，不加判断会把上一个脚本的名称写到新标签页上。
    useRouteMainTabTitle(script, { fields: ["name", "script_path"] })

    // Static tab list, mirroring workflow-panel: every script shows the same tabs.
    const views: { label: string; value: ScriptViewKey }[] = [
        { label: zh ? "分析节点" : "Analysis Nodes", value: "analysisNodePage" },
        { label: zh ? "编辑" : "Edit", value: "createOrUpdateScript" },
        { label: zh ? "代码" : "Code", value: "scriptCode" },
        { label: "README", value: "scriptReadme" },
        { label: zh ? "发布" : "Publish", value: "PublishToolsV2" },
    ]

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
                                        <Tooltip title={script.script_path || script.name}>
                                            <span className="script-panel-title">
                                                {script.name || script.script_path || script.id}
                                            </span>
                                        </Tooltip>
                                        {script.script_type ? (
                                            <Tag color="blue" style={{ marginInlineEnd: 0 }}>{script.script_type}</Tag>
                                        ) : null}
                                    </div>
                                    {/* {script.script_path ? (
                                        <Tooltip title={script.script_path}>
                                            <span className="script-panel-path">{script.script_path}</span>
                                        </Tooltip>
                                    ) : null} */}
                                </div>

                                <div className="script-panel-actions">
                                    {/* Git 状态与主操作并列：标题行只放「身份信息」，避免长标题把
                                        状态标签和按钮挤到下一行、或者把标题本身挤成省略号。 */}
                                    <GitStateActions entity="script" item={script} onReload={reload} />
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

                            {/* 视图切换单独占一行：脚本标题长度不可控，和 Segmented 同排时
                                要么标签被挤换行、要么整块被压到下面，视觉上很不稳定。 */}
                            <nav className="script-panel-tabs" aria-label={zh ? "脚本视图" : "Script views"}>
                                <Segmented
                                    size="small"
                                    value={view}
                                    options={views}
                                    onChange={(value) => setView(value as ScriptViewKey)}
                                />
                            </nav>

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
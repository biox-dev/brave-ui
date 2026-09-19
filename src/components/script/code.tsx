import { Button, Flex, message, Skeleton, Space, Tag, Tooltip, Typography, theme } from "antd"
import { FileTextOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { MonacoEditor } from "../react-monaco-editor"
import { getScriptContentApi, saveScriptContentApi } from "@/api/pipeline/script-content"

/** 编辑器最小高度，避免容器测量前塌陷。 */
const MIN_EDITOR_HEIGHT = 320
/** 编辑器底部预留的页面留白。 */
const BOTTOM_GAP = 24

/**
 * 脚本主文件查看 / 编辑组件。
 * 兼容历史调用方传 script_id 或 component_id 两种写法，两者都是脚本 int64 主键。
 */
const Code: FC<any> = ({ script_id, component_id }) => {
    const scriptId = script_id || component_id
    const { token } = theme.useToken()
    const [messageApi, contextHolder] = message.useMessage()
    const [data, setData] = useState<{ path?: string; content?: string }>()
    const [saving, setSaving] = useState(false)
    const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT)
    const editorRef = useRef<any>(null)
    const wrapRef = useRef<HTMLDivElement>(null)

    // 请求错误已由 http 拦截器统一提示，这里只处理成功路径。
    const load = useCallback(async () => {
        if (!scriptId) return
        const resp = await getScriptContentApi(scriptId).catch(() => undefined)
        if (resp) setData(resp)
    }, [scriptId])

    useEffect(() => {
        load()
    }, [load])

    // 高度自适应：编辑器始终填满当前可视区域中它下方的剩余空间。
    useLayoutEffect(() => {
        const sync = () => {
            const el = wrapRef.current
            if (!el) return
            const available = window.innerHeight - el.getBoundingClientRect().top - BOTTOM_GAP
            setEditorHeight(Math.max(MIN_EDITOR_HEIGHT, Math.floor(available)))
        }
        sync()
        window.addEventListener("resize", sync)
        return () => window.removeEventListener("resize", sync)
    }, [data])

    // 优先取编辑器当前内容；编辑器未挂载时退回已加载内容。
    const handleSave = async () => {
        const content = editorRef.current?.getValue?.() ?? data?.content ?? ""
        setSaving(true)
        try {
            await saveScriptContentApi(scriptId, { content })
            messageApi.success("Saved")
            await load()
        } catch {
            // 错误已由 http 拦截器统一提示
        } finally {
            setSaving(false)
        }
    }

    const lineCount = data?.content ? data.content.split("\n").length : 0

    return <Flex vertical gap={12}>
        {contextHolder}

        <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <FileTextOutlined style={{ color: token.colorTextTertiary }} />
                <Tooltip title={data?.path}>
                    <Typography.Text ellipsis style={{ fontFamily: "monospace", minWidth: 0, flex: "0 1 auto" }}>
                        {data?.path || "Loading script..."}
                    </Typography.Text>
                </Tooltip>
                <Tag style={{ marginInlineEnd: 0 }}>python · {lineCount} lines</Tag>
            </Flex>
            <Space>
                <Button size="small" color="cyan" variant="outlined" icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
                <Button size="small" color="cyan" variant="solid" icon={<SaveOutlined />} loading={saving} disabled={!scriptId} onClick={handleSave}>Save</Button>
            </Space>
        </Flex>

        <div
            ref={wrapRef}
            style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: "hidden" }}
        >
            {data
                ? <MonacoEditor height={editorHeight} value={data.content} editorRef={editorRef} defaultLanguage="python"></MonacoEditor>
                : <Skeleton active paragraph={{ rows: 10 }} style={{ padding: 16 }}></Skeleton>}
        </div>
    </Flex>
}

export default Code
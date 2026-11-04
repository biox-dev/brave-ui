import { Alert, Button, Flex, message, Segmented, Skeleton, Space, Tag, Tooltip, Typography, theme } from "antd"
import { FileTextOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { MonacoEditor } from "../react-monaco-editor"
import LightweightEditor from "./lightweight-editor"
import { getScriptContentApi, saveScriptContentApi } from "@/api/pipeline/script-content"

/** 编辑器最小高度，避免容器测量前塌陷。 */
const MIN_EDITOR_HEIGHT = 320
/** 编辑器底部预留的页面留白。 */
const BOTTOM_GAP = 24
/** Monaco 超过该时间仍未挂载完成，就自动降级到轻量编辑器（弱网下 chunk 可能加载很久）。 */
const MONACO_MOUNT_TIMEOUT = 8000
/** 编辑器模式持久化键。 */
const EDITOR_MODE_KEY = "brave.script.code.editorMode"

type EditorMode = "light" | "monaco"

/** 文件扩展名 → Monaco 语言 id（monaco-setup 只注册了这些语言）。 */
const EXTENSION_LANGUAGE: Record<string, string> = {
    py: "python",
    r: "r",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    qmd: "markdown",
    md: "markdown",
    json: "json",
    ipynb: "json",
    yml: "yaml",
    yaml: "yaml",
    sql: "sql",
}

/** 从文件路径推断 Monaco 语言，识别不了时按纯文本处理。 */
const languageFromPath = (path?: string) => {
    const extension = path?.split(".").pop()?.toLowerCase()
    return (extension && EXTENSION_LANGUAGE[extension]) || "plaintext"
}

/** 读取上次选择的编辑器模式，读取失败时回退到轻量编辑器。 */
const readEditorMode = (): EditorMode => {
    try {
        return localStorage.getItem(EDITOR_MODE_KEY) === "monaco" ? "monaco" : "light"
    } catch {
        return "light"
    }
}

/** 从 axios 错误里取出后端返回的可读信息。 */
const pickErrorMessage = (err: any) =>
    err?.response?.data?.error?.message ||
    err?.response?.data?.detail ||
    err?.message ||
    "Failed to load script content"

/**
 * 脚本主文件查看 / 编辑组件。
 * 兼容历史调用方传 script_id 或 component_id 两种写法，两者都是脚本 int64 主键。
 *
 * 之前这里只有 `data` 一个状态：请求失败只弹一次全局提示，界面会永久停在
 * “Loading script...”。现在区分 loading / error / not-found，并提供「轻量 / Monaco」
 * 两种编辑器：轻量模式零依赖、秒开（默认），Monaco 挂载超时会自动降级，不再无限等待。
 *
 * height：可选。不传时按“填满视口剩余高度”自适应（整页面板场景，如 script-panel）；
 * 内联渲染在可滚动长页面（如分析节点详情卡片底部）时，wrap 的 top 往往已接近/超出
 * 视口底部，自适应结果会被钳到最小 320px，此时应由调用方显式传入高度（px 或 CSS 长度）。
 */
const Code: FC<any> = ({ script_id, component_id, height }) => {
    const scriptId = script_id || component_id
    const { token } = theme.useToken()
    const [messageApi, contextHolder] = message.useMessage()

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>()
    /** 404：脚本主文件尚未生成，按空文件处理，保存时会自动创建。 */
    const [notFound, setNotFound] = useState(false)
    const [path, setPath] = useState<string>()
    const [content, setContent] = useState("")
    const [savedContent, setSavedContent] = useState("")
    const [saving, setSaving] = useState(false)
    const [editorHeight, setEditorHeight] = useState(MIN_EDITOR_HEIGHT)
    const [mode, setMode] = useState<EditorMode>(() => readEditorMode())
    const [monacoMounted, setMonacoMounted] = useState(false)

    const editorRef = useRef<any>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    /** 请求序号：切换脚本时丢弃过期响应，避免旧数据覆盖新脚本。 */
    const requestSeq = useRef(0)

    // 请求错误已由 http 拦截器统一提示，这里只负责把结果落到界面上。
    const load = useCallback(async () => {
        if (!scriptId) return
        const seq = ++requestSeq.current
        setLoading(true)
        setError(undefined)
        try {
            const resp = await getScriptContentApi(scriptId)
            if (seq !== requestSeq.current) return
            setPath(resp?.path)
            setContent(resp?.content ?? "")
            setSavedContent(resp?.content ?? "")
            setNotFound(false)
        } catch (err: any) {
            if (seq !== requestSeq.current) return
            if (err?.response?.status === 404) {
                // 主文件不存在：允许用户直接编辑并保存（后端会创建文件）。
                setPath(undefined)
                setContent("")
                setSavedContent("")
                setNotFound(true)
                setError(undefined)
            } else {
                setError(pickErrorMessage(err))
            }
        } finally {
            if (seq === requestSeq.current) setLoading(false)
        }
    }, [scriptId])

    useEffect(() => {
        load()
    }, [load])

    // 高度自适应：编辑器始终填满当前可视区域中它下方的剩余空间。
    // 调用方显式传了 height 时不做测量，避免内联在长页面底部时被钳到最小高度。
    useLayoutEffect(() => {
        if (height != null) return
        const sync = () => {
            const el = wrapRef.current
            if (!el) return
            const available = window.innerHeight - el.getBoundingClientRect().top - BOTTOM_GAP
            setEditorHeight(Math.max(MIN_EDITOR_HEIGHT, Math.floor(available)))
        }
        sync()
        window.addEventListener("resize", sync)
        return () => window.removeEventListener("resize", sync)
    }, [height, content, loading, error])

    // 兜底：Monaco 加载失败或极慢时不要让界面卡在 “Loading editor…”，直接降级到轻量编辑器。
    useEffect(() => {
        if (mode !== "monaco" || monacoMounted || loading || error) return
        const timer = window.setTimeout(() => {
            setMode("light")
            messageApi.warning("Monaco 加载超时，已切换到轻量编辑器")
        }, MONACO_MOUNT_TIMEOUT)
        return () => window.clearTimeout(timer)
    }, [mode, monacoMounted, loading, error, messageApi])

    const handleModeChange = useCallback((next: EditorMode) => {
        setMode(next)
        try {
            localStorage.setItem(EDITOR_MODE_KEY, next)
        } catch {
            // 隐私模式下 localStorage 可能不可用，忽略即可。
        }
    }, [])

    const handleSave = async () => {
        if (!scriptId) return
        // 优先取编辑器当前内容；编辑器未挂载时退回受控内容。
        const value = editorRef.current?.getValue?.() ?? content
        setSaving(true)
        try {
            const resp = await saveScriptContentApi(scriptId, { content: value })
            setSavedContent(value)
            setContent(value)
            if (resp?.path) setPath(resp.path)
            setNotFound(false)
            messageApi.success("Saved")
        } catch {
            // 错误已由 http 拦截器统一提示
        } finally {
            setSaving(false)
        }
    }

    const lineCount = useMemo(() => (content ? content.split("\n").length : 0), [content])
    const language = useMemo(() => languageFromPath(path), [path])
    const dirty = content !== savedContent
    // 显式传入的高度优先，未传时用视口测量结果。
    const resolvedHeight = height != null ? height : editorHeight

    return <Flex vertical gap={12}>
        {contextHolder}

        <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <FileTextOutlined style={{ color: token.colorTextTertiary }} />
                <Tooltip title={path}>
                    <Typography.Text ellipsis style={{ fontFamily: "monospace", minWidth: 0, flex: "0 1 auto" }}>
                        {path || (notFound ? "Script file not created yet" : loading ? "Loading script..." : "Script")}
                    </Typography.Text>
                </Tooltip>
                <Tag style={{ marginInlineEnd: 0 }}>{language} · {lineCount} lines</Tag>
                {dirty ? <Tag color="orange" style={{ marginInlineEnd: 0 }}>Unsaved</Tag> : null}
            </Flex>
            <Space>
                <Segmented
                    size="small"
                    value={mode}
                    onChange={(value) => handleModeChange(value as EditorMode)}
                    options={[
                        { label: "轻量", value: "light" },
                        { label: "Monaco", value: "monaco" },
                    ]}
                />
                <Button size="small" color="cyan" variant="outlined" icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
                <Button size="small" color="cyan" variant="solid" icon={<SaveOutlined />} loading={saving} disabled={!scriptId} onClick={handleSave}>Save</Button>
            </Space>
        </Flex>

        {notFound && !loading && !error ? (
            <Alert
                type="info"
                showIcon
                message="脚本主文件尚未创建"
                description="保存后会按脚本类型生成 main.py / main.R / main.qmd 等主文件。"
            />
        ) : null}

        <div
            ref={wrapRef}
            style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, overflow: "hidden" }}
        >
            {loading
                ? <Skeleton active paragraph={{ rows: 10 }} style={{ padding: 16 }}></Skeleton>
                : error
                    ? <Alert
                        type="error"
                        showIcon
                        style={{ margin: 16 }}
                        message="脚本内容加载失败"
                        description={error}
                        action={<Button size="small" icon={<ReloadOutlined />} onClick={load}>Retry</Button>}
                    ></Alert>
                    : mode === "light"
                        ? <LightweightEditor height={resolvedHeight} value={content} onChange={setContent} />
                        : <MonacoEditor
                            height={resolvedHeight}
                            value={content}
                            path={path}
                            language={language}
                            editorRef={editorRef}
                            onChange={(value: string | undefined) => setContent(value ?? "")}
                            onEditorMount={() => setMonacoMounted(true)}
                        ></MonacoEditor>}
        </div>
    </Flex>
}

export default Code
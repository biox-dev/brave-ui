import { Button, Flex, message, Tooltip, Typography } from "antd"
import { FC, useCallback, useEffect, useRef, useState } from "react"
import { MonacoEditor } from "../react-monaco-editor"
import { getScriptContentApi, saveScriptContentApi } from "@/api/pipeline/script-content"

/**
 * 脚本主文件查看 / 编辑组件。
 * 兼容历史调用方传 script_id 或 component_id 两种写法，两者都是脚本 int64 主键。
 */
const Code: FC<any> = ({ script_id, component_id }) => {
    const scriptId = script_id || component_id
    const [messageApi, contextHolder] = message.useMessage()
    const [data, setData] = useState<{ path?: string; content?: string }>()
    const [saving, setSaving] = useState(false)
    const editorRef = useRef<any>(null)

    // 请求错误已由 http 拦截器统一提示，这里只处理成功路径。
    const getModuleContent = useCallback(async () => {
        if (!scriptId) return
        const resp = await getScriptContentApi(scriptId).catch(() => undefined)
        if (resp) setData(resp)
    }, [scriptId])

    useEffect(() => {
        getModuleContent()
    }, [getModuleContent])

    const handleSave = async () => {
        // 优先取编辑器当前内容；编辑器未挂载时退回已加载内容。
        const content = editorRef.current?.getValue?.() ?? data?.content ?? ""
        setSaving(true)
        try {
            await saveScriptContentApi(scriptId, { content })
            messageApi.success("Saved")
            await getModuleContent()
        } catch {
            // 错误已由 http 拦截器统一提示
        } finally {
            setSaving(false)
        }
    }

    return <>
        {data?.path && <Typography>{data.path}</Typography>}
        <Flex justify="flex-end" gap={"small"}>
            <Button size="small" color="cyan" variant="solid" onClick={getModuleContent}>Refresh</Button>
            <Tooltip title={data?.path}>
                <Button size="small" color="cyan" variant="solid" loading={saving} disabled={!scriptId} onClick={handleSave}>Save</Button>
            </Tooltip>
        </Flex>
        {contextHolder}
        <MonacoEditor value={data?.content} editorRef={editorRef} defaultLanguage="python"></MonacoEditor>
    </>
}

export default Code
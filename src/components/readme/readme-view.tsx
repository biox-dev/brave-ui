import { Button, Empty, Flex, Segmented, Skeleton, Tooltip, Typography } from "antd"
import { EditOutlined, EyeOutlined, FileMarkdownOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useRef, useState } from "react"
import Markdown from "@/components/markdown"
import { MonacoEditor } from "@/components/react-monaco-editor"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useI18n } from "@/hooks/useI18n"
import {
	getScriptReadmeApi,
	getWorkflowReadmeApi,
	saveScriptReadmeApi,
	saveWorkflowReadmeApi,
} from "@/api/pipeline/readme"

/** README.md 所属实体类型。 */
export type ReadmeEntity = "script" | "workflow"

/** 查看 / 编辑模式。 */
type ReadmeMode = "preview" | "edit"

export interface ReadmeViewProps {
	/** 读取与保存走哪一类接口。 */
	entity: ReadmeEntity
	/** 组件 int64 主键。 */
	id?: string | number
}

/** Markdown 编辑器高度。 */
const EDITOR_HEIGHT = 420

/**
 * README.md 查看 / 编辑视图（脚本与工作流共用）。
 * 作为普通 view 注册（见 ./index.ts），由 panel 的 Segmented 切换展示，不使用弹窗。
 */
const ReadmeView: FC<ReadmeViewProps> = ({ entity, id }) => {
	const { locale } = useI18n()
	const zh = locale !== "en_US"
	const message = useGlobalMessage()

	const [mode, setMode] = useState<ReadmeMode>("preview")
	const [content, setContent] = useState("")
	const [path, setPath] = useState("")
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const editorRef = useRef<any>(null)

	const hasId = id !== undefined && id !== null && id !== ""

	// 请求错误已由 http 拦截器统一提示，这里只处理成功路径。
	const load = useCallback(async () => {
		if (!hasId) {
			return
		}
		setLoading(true)
		try {
			const resp = entity === "script"
				? await getScriptReadmeApi(id)
				: await getWorkflowReadmeApi(id)
			setContent(resp?.content ?? "")
			setPath(resp?.path ?? "")
		} catch {
			setContent("")
		} finally {
			setLoading(false)
		}
	}, [entity, id, hasId])

	useEffect(() => {
		load()
	}, [load])

	// 优先取编辑器当前内容；编辑器未挂载（查看模式）时退回已加载内容。
	const handleSave = async () => {
		if (!hasId) {
			return
		}
		const value = editorRef.current?.getValue?.() ?? content
		setSaving(true)
		try {
			if (entity === "script") {
				await saveScriptReadmeApi(id, { content: value })
			} else {
				await saveWorkflowReadmeApi(id, { content: value })
			}
			setContent(value)
			message.success(zh ? "README 已保存" : "README saved")
		} catch {
			// 错误已由 http 拦截器统一提示
		} finally {
			setSaving(false)
		}
	}

	const modeOptions = [
		{ label: zh ? "查看" : "View", value: "preview" as ReadmeMode, icon: <EyeOutlined /> },
		{ label: zh ? "编辑" : "Edit", value: "edit" as ReadmeMode, icon: <EditOutlined /> },
	]

	return (
		<Flex vertical gap={12}>
			<Flex align="center" justify="space-between" gap={12} wrap>
				<Flex align="center" gap={8} style={{ minWidth: 0 }}>
					<FileMarkdownOutlined style={{ color: "#1677ff" }} />
					<Tooltip title={path}>
						<Typography.Text type="secondary" ellipsis style={{ fontFamily: "monospace", maxWidth: "46vw" }}>
							{path || "README.md"}
						</Typography.Text>
					</Tooltip>
				</Flex>
				<Flex align="center" gap={8} wrap>
					<Segmented
						size="small"
						value={mode}
						options={modeOptions}
						onChange={(value) => setMode(value as ReadmeMode)}
					/>
					<Button size="small" icon={<ReloadOutlined />} onClick={load}>
						{zh ? "刷新" : "Refresh"}
					</Button>
					<Button
						size="small"
						type="primary"
						icon={<SaveOutlined />}
						loading={saving}
						disabled={!hasId}
						onClick={handleSave}
					>
						{zh ? "保存" : "Save"}
					</Button>
				</Flex>
			</Flex>

			{loading ? (
				<Skeleton active paragraph={{ rows: 8 }} />
			) : mode === "edit" ? (
				<div style={{ border: "1px solid var(--sharp-divider, #eceff4)", borderRadius: 8, overflow: "hidden" }}>
					<MonacoEditor
						height={EDITOR_HEIGHT}
						value={content}
						editorRef={editorRef}
						defaultLanguage="markdown"
					/>
				</div>
			) : content ? (
				<div style={{ maxHeight: "60vh", overflow: "auto" }}>
					<Markdown data={content} />
				</div>
			) : (
				<Empty
					image={Empty.PRESENTED_IMAGE_SIMPLE}
					description={zh
						? "暂无 README.md，切换到编辑即可创建"
						: "No README.md yet — switch to Edit to create one"}
				>
					<Button size="small" type="primary" icon={<EditOutlined />} onClick={() => setMode("edit")}>
						{zh ? "编辑" : "Edit"}
					</Button>
				</Empty>
			)}
		</Flex>
	)
}

export default ReadmeView

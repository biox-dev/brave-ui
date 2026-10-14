import { Alert, Button, Empty, Popconfirm, Segmented, Spin, Tag, Tooltip } from "antd"
import { UndoOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useRef, useState } from "react"
import {
	getGitDiffApi,
	revertGitFileApi,
	type GitDiffFile,
	type GitDiffFileStatus,
	type GitDiffResponse,
	type GitDiffSection,
} from "@/api/pipeline/git"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useI18n } from "@/hooks/useI18n"

/**
 * 「查看本地变化」视图：展示组件目录（本地 git 工作区仓库）的 diff。
 *
 * 作为普通 view 注册（见 ./index.ts），由 `invoke.gitDiff.open(...)` 以 Modal 形式打开
 * （弹窗容器由 `UIContainer` 统一渲染，本组件只负责内容，不再内联 `<Modal>`）。
 *
 * 数据来自 `GET /script/{id}/git-diff` / `GET /workflow/{id}/git-diff`，分两段：
 *   - 工作区改动：相对本地 HEAD 的未提交改动（含未跟踪文件）；
 *   - 未发布提交：本地 HEAD 相对 store HEAD 的差异（已提交但还没发布）。
 *
 * 「工作区改动」里的每个文件可单独撤回（`POST .../git-revert-file`）：恢复为本地 HEAD
 * 版本（新增文件则删除），只影响该文件、不产生提交。
 *
 * 后端 `internal/utils/git_diff.go` 负责真正算 diff，这里只做展示。
 */
export interface GitDiffViewProps {
	entity: "script" | "workflow"
	/** 组件 int64 主键（后端 `json:"id,string"`，前端收到的就是字符串）。 */
	id?: string | number
	/** 由 UI 容器注入：关闭弹窗。 */
	close?: () => void
}

const statusColor: Record<GitDiffFileStatus, string> = {
	added: "green",
	modified: "gold",
	deleted: "red",
}

const statusLabel = (status: GitDiffFileStatus, zh: boolean): string => {
	switch (status) {
		case "added":
			return zh ? "新增" : "added"
		case "deleted":
			return zh ? "删除" : "deleted"
		default:
			return zh ? "修改" : "modified"
	}
}

const monospace = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/** 单行着色：与 git 的 unified diff 记号保持一致。 */
const lineStyle = (line: string): { background: string; color: string } => {
	if (line.startsWith("diff --git")) {
		return { background: "#f0f5ff", color: "#1d39c4" }
	}
	if (line.startsWith("@@")) {
		return { background: "#f9f0ff", color: "#531dab" }
	}
	if (line.startsWith("+++") || line.startsWith("---")) {
		return { background: "transparent", color: "#8c8c8c" }
	}
	if (line.startsWith("+")) {
		return { background: "#f6ffed", color: "#135200" }
	}
	if (line.startsWith("-")) {
		return { background: "#fff1f0", color: "#820014" }
	}
	return { background: "transparent", color: "inherit" }
}

const GitDiffView: FC<GitDiffViewProps> = ({ entity, id }) => {
	const { locale } = useI18n()
	const message = useGlobalMessage()
	const zh = locale === "zh_CN"

	const hasId = id !== undefined && id !== null && id !== ""

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const [data, setData] = useState<GitDiffResponse | undefined>(undefined)
	const [tab, setTab] = useState<string>("worktree")
	const [revertingPath, setRevertingPath] = useState("")
	// 只保留最后一次加载结果，避免快速切换实体时旧响应覆盖新数据。
	const loadSeq = useRef(0)

	// reload 抽为可复用回调：初次加载与「撤回」成功后都走同一条链路。
	const reload = useCallback(
		async (showSpinner = true) => {
			if (!hasId) {
				return
			}
			const seq = ++loadSeq.current
			if (showSpinner) {
				setLoading(true)
			}
			setError("")
			try {
				const resp = await getGitDiffApi(entity, id)
				if (seq === loadSeq.current) {
					setData(resp)
				}
			} catch (err) {
				if (seq === loadSeq.current) {
					setData(undefined)
					setError(err instanceof Error ? err.message : String(err))
				}
			} finally {
				if (showSpinner && seq === loadSeq.current) {
					setLoading(false)
				}
			}
		},
		[entity, id, hasId],
	)

	useEffect(() => {
		setTab("worktree")
		void reload()
		// id 是 int64 主键（字符串），加载只在实体/主键变化时重跑。
	}, [reload])

	// 撤回单个文件的未提交改动：恢复为本地 HEAD 版本后静默刷新 diff。
	const handleRevert = useCallback(
		async (path: string) => {
			setRevertingPath(path)
			try {
				await revertGitFileApi(entity, id as string | number, path)
				message.success(zh ? `已撤回 ${path}` : `Reverted ${path}`)
				await reload(false)
			} catch (err) {
				message.error(err instanceof Error ? err.message : String(err))
			} finally {
				setRevertingPath("")
			}
		},
		[entity, id, message, reload, zh],
	)

	const section: GitDiffSection | undefined = tab === "unpublished" ? data?.unpublished : data?.worktree

	const renderFileTags = (target: GitDiffSection, canRevert: boolean) => (
		<div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
			{target.files.map((file: GitDiffFile) => (
				<span key={file.path} style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
					<Tooltip
						title={
							file.omitted
								? `${statusLabel(file.status, zh)} ${file.path} · ${zh ? "文件过大，未展示内容" : "file too large, content omitted"}`
								: file.binary
									? `${statusLabel(file.status, zh)} ${file.path} · ${zh ? "二进制文件，不展示内容" : "binary file, content not shown"}`
									: `${statusLabel(file.status, zh)} ${file.path} +${file.additions} -${file.deletions}`
						}
					>
						<Tag color={statusColor[file.status] ?? "default"} style={{ marginInlineEnd: 0, maxWidth: "100%" }}>
							<span style={{ fontFamily: monospace, wordBreak: "break-all" }}>{file.path}</span>
							{!file.binary && !file.omitted && (file.additions > 0 || file.deletions > 0) && (
								<span style={{ marginInlineStart: 6 }}>
									+{file.additions} -{file.deletions}
								</span>
							)}
						</Tag>
					</Tooltip>
					{canRevert && (
						<Popconfirm
							title={zh ? "撤回该文件的未提交改动？" : "Discard changes to this file?"}
							description={zh ? "文件将恢复为最近一次提交时的内容。" : "The file is restored to the last commit."}
							okText={zh ? "撤回" : "Revert"}
							cancelText={zh ? "取消" : "Cancel"}
							okButtonProps={{ danger: true }}
							onConfirm={() => handleRevert(file.path)}
						>
							<Button
								type="text"
								size="small"
								danger
								icon={<UndoOutlined />}
								loading={revertingPath === file.path}
								style={{ marginInlineStart: 2 }}
							/>
						</Popconfirm>
					)}
				</span>
			))}
		</div>
	)

	const renderSection = (target: GitDiffSection | undefined) => {
		if (!target || !target.has_changes) {
			return <Empty description={zh ? "没有可展示的改动" : "No changes to show"} />
		}
		return (
			<>
				<div style={{ marginBottom: 8, color: "rgba(0, 0, 0, 0.45)", fontSize: 12 }}>
					{zh ? `${target.file_count} 个文件` : `${target.file_count} files`}
					{` · +${target.additions} -${target.deletions}`}
					{target.base_commit ? ` · ${zh ? "基线" : "base"} ${target.base_commit.slice(0, 7)}` : ""}
					{target.target_commit ? ` -> ${target.target_commit.slice(0, 7)}` : ""}
					{target.truncated ? (zh ? " · 内容过大已截断" : " · truncated") : ""}
				</div>
				{renderFileTags(target, tab === "worktree")}
				<div
					style={{
						maxHeight: "56vh",
						overflow: "auto",
						border: "1px solid #f0f0f0",
						borderRadius: 4,
						background: "#fafafa",
					}}
				>
					<pre style={{ margin: 0, fontFamily: monospace, fontSize: 12, lineHeight: "18px" }}>
						{target.patch.split("\n").map((line, index) => {
							const style = lineStyle(line)
							return (
								<div
									// diff 行本身没有稳定 key，用行号即可（内容只读、不重排）。
									key={index}
									style={{
										...style,
										padding: "0 8px",
										whiteSpace: "pre-wrap",
										wordBreak: "break-all",
									}}
								>
									{line === "" ? " " : line}
								</div>
							)
						})}
					</pre>
				</div>
			</>
		)
	}

	if (loading) {
		return (
			<div style={{ textAlign: "center", padding: "32px 0" }}>
				<Spin />
			</div>
		)
	}
	if (error) {
		return <Alert type="error" showIcon message={zh ? "读取本地变化失败" : "Failed to load local changes"} description={error} />
	}
	if (!data) {
		return <Empty description={zh ? "暂无数据" : "No data"} />
	}
	if (!data.initialized) {
		return (
			<Alert
				type="info"
				showIcon
				message={zh ? "本地目录还不是 git 仓库" : "The local directory is not a git repository yet"}
				description={data.repo_dir}
			/>
		)
	}
	if (!data.has_changes) {
		return <Empty description={zh ? "本地没有变化" : "No local changes"} />
	}

	const tabs = [{ label: zh ? "工作区改动" : "Worktree", value: "worktree" }]
	// 「未发布提交」只在本地领先 store 时才有意义（store 领先本地时差异不是本地改动）。
	if (data.unpublished?.has_changes && data.git_state?.local_ahead) {
		tabs.push({ label: zh ? "未发布提交" : "Unpublished commits", value: "unpublished" })
	}

	return (
		<>
			<Segmented
				size="small"
				value={tab}
				options={tabs}
				onChange={(value) => setTab(String(value))}
				style={{ marginBottom: 12 }}
			/>
			{renderSection(section)}
			<div style={{ marginTop: 8, fontSize: 12, color: "rgba(0, 0, 0, 0.45)", wordBreak: "break-all" }}>
				{data.repo_dir}
			</div>
		</>
	)
}

export default GitDiffView

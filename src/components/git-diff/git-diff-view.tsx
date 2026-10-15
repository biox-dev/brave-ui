import { Alert, Button, Empty, Popconfirm, Segmented, Spin, Tag, Tooltip } from "antd"
import { UndoOutlined } from "@ant-design/icons"
import { FC, useCallback, useEffect, useRef, useState } from "react"
import {
	getGitDiffApi,
	revertGitFileApi,
	type GitDiffFile,
	type GitDiffResponse,
	type GitDiffSection,
} from "@/api/pipeline/git"
import {
	getProjectReportGitDiffApi,
	revertProjectReportFileApi,
} from "@/api/project"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useI18n } from "@/hooks/useI18n"
import {
	gitDiffFileTooltip,
	gitDiffLineStyle,
	gitDiffMonospace,
	gitDiffSectionSummary,
	gitDiffStatusColor,
} from "./shared"

/**
 * 「查看本地变化」视图：展示组件目录或报告目录（本地 git 工作区仓库）的 diff。
 *
 * 作为普通 view 注册（见 ./index.ts），由 `invoke.gitDiff.open(...)` 以 Modal 形式打开
 * （弹窗容器由 `UIContainer` 统一渲染，本组件只负责内容，不再内联 `<Modal>`）。
 *
 * 两个数据源共用同一套展示（后端 diff 结构一致，都复用 `utils.GitDiffSection`）：
 *   - entity=script / workflow：`GET /{entity}/{id}/git-diff`，分「工作区改动」与「未发布提交」两段；
 *   - entity=project_report：`GET /project/project-report-git-diff`，只有「工作区改动」一段
 *     （报告没有发布目标），撤回走 `POST /project/revert-project-report-file`。
 *
 * 「工作区改动」里的每个文件可单独撤回：恢复为本地 HEAD 版本（新增文件则删除），
 * 只影响该文件、不产生提交。
 */
export interface GitDiffViewProps {
	entity: "script" | "workflow" | "project_report"
	/** 组件 / 报告的 int64 主键（后端 `json:"...id,string"`，前端收到的就是字符串）。 */
	id?: string | number
	/** 由 UI 容器注入：关闭弹窗。 */
	close?: () => void
}

/** 视图内部归一化后的 diff 数据（两个数据源落到同一形状）。 */
interface DiffData {
	repo_dir: string
	initialized: boolean
	has_changes: boolean
	worktree: GitDiffSection
	unpublished?: GitDiffSection
	/** 「未发布提交」段落是否可用（仅组件目录支持）。 */
	supportsUnpublished: boolean
	local_ahead: boolean
}

const GitDiffView: FC<GitDiffViewProps> = ({ entity, id }) => {
	const { locale } = useI18n()
	const message = useGlobalMessage()
	const zh = locale === "zh_CN"

	const hasId = id !== undefined && id !== null && id !== ""

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const [data, setData] = useState<DiffData | undefined>(undefined)
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
				let next: DiffData
				if (entity === "project_report") {
					const resp = await getProjectReportGitDiffApi(id as string | number)
					next = {
						repo_dir: resp.repo_dir,
						initialized: resp.initialized,
						has_changes: resp.has_changes,
						worktree: resp.worktree,
						supportsUnpublished: false,
						local_ahead: false,
					}
				} else {
					const resp: GitDiffResponse = await getGitDiffApi(entity, id as string | number)
					next = {
						repo_dir: resp.repo_dir,
						initialized: resp.initialized,
						has_changes: resp.has_changes,
						worktree: resp.worktree,
						unpublished: resp.unpublished,
						supportsUnpublished: true,
						local_ahead: !!resp.git_state?.local_ahead,
					}
				}
				if (seq === loadSeq.current) {
					setData(next)
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
				if (entity === "project_report") {
					await revertProjectReportFileApi(id as string | number, path)
				} else {
					await revertGitFileApi(entity, id as string | number, path)
				}
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
					<Tooltip title={gitDiffFileTooltip(file, zh)}>
						<Tag color={gitDiffStatusColor[file.status] ?? "default"} style={{ marginInlineEnd: 0, maxWidth: "100%" }}>
							<span style={{ fontFamily: gitDiffMonospace, wordBreak: "break-all" }}>{file.path}</span>
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
					{gitDiffSectionSummary(target, zh)}
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
					<pre style={{ margin: 0, fontFamily: gitDiffMonospace, fontSize: 12, lineHeight: "18px" }}>
						{target.patch.split("\n").map((line, index) => {
							const style = gitDiffLineStyle(line)
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
	// 「未发布提交」只在组件目录（有 store 发布目标）且本地领先 store 时才有意义
	// （store 领先本地时差异不是本地改动）；报告目录没有发布目标，永远是单段。
	if (data.supportsUnpublished && data.unpublished?.has_changes && data.local_ahead) {
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

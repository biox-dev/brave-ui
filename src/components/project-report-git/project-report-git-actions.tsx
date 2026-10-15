import { Button, Input, Popconfirm, Popover, Space, Tag } from "antd"
import {
	DiffOutlined,
	InfoCircleOutlined,
	ReloadOutlined,
	SaveOutlined,
	UndoOutlined,
} from "@ant-design/icons"
import { FC, useCallback, useEffect, useState } from "react"
import {
	commitProjectReportApi,
	getProjectReportGitDiffApi,
	revertProjectReportFileApi,
	type ProjectReportGitDiffResponse,
} from "@/api/project"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useI18n } from "@/hooks/useI18n"
import { invoke } from "@/core/ui-system/invokeV2"

/**
 * 报告工作目录（`data/<projectId>/report/<reportId>`）的 git 操作条。
 *
 * 与组件目录的 `pages/components-relation/components/git-state-actions.tsx` 交互对齐，
 * 但报告没有「store / 发布」这一侧，因此只保留三个动作：
 *
 *   - 查看变化：打开复用的 `invoke.gitDiff` 弹窗（`entity="project_report"`），
 *     弹窗内支持按文件「撤回」（等同 `git checkout HEAD -- <path>`）；
 *   - 提交：把报告目录的所有改动提交为一个 commit（可填写 commit message）；
 *   - 撤回全部：把报告目录所有文件恢复为最近一次提交的版本（等同 `git checkout HEAD -- .`）。
 *
 * 状态完全由磁盘上的 git 元数据实时推导（与组件目录同一套原语），不落库。
 */
export interface ProjectReportGitActionsProps {
	/** 报告 int64 主键（后端 `json:"id,string"`，前端收到的就是字符串）。 */
	reportId?: string | number
	/** 报告文件保存成功等场景下，通知父组件刷新（例如重新拉取文件内容）。 */
	onReload?: () => void
}

const ProjectReportGitActions: FC<ProjectReportGitActionsProps> = ({ reportId, onReload }) => {
	const message = useGlobalMessage()
	const { locale } = useI18n()
	const zh = locale === "zh_CN"

	const hasId = reportId !== undefined && reportId !== null && reportId !== ""

	const [state, setState] = useState<ProjectReportGitDiffResponse | undefined>(undefined)
	const [loading, setLoading] = useState(false)
	const [commitOpen, setCommitOpen] = useState(false)
	const [commitMessage, setCommitMessage] = useState("")
	const [committing, setCommitting] = useState(false)
	const [revertingAll, setRevertingAll] = useState(false)

	// 只读刷新：加载失败时静默（例如报告目录还没初始化），不打扰用户。
	const reload = useCallback(
		async (showSpinner = false) => {
			if (!hasId) {
				setState(undefined)
				return
			}
			if (showSpinner) {
				setLoading(true)
			}
			try {
				const resp = await getProjectReportGitDiffApi(reportId as string | number)
				setState(resp)
			} catch {
				setState(undefined)
			} finally {
				if (showSpinner) {
					setLoading(false)
				}
			}
		},
		[hasId, reportId],
	)

	useEffect(() => {
		void reload()
	}, [reload])

	const gitState = state?.git_state
	const initialized = !!gitState?.initialized
	const dirty = !!gitState?.dirty

	// 「查看变化」：有基线提交且存在未提交改动时可用（与组件目录的可见性规则一致）。
	const canViewDiff = hasId && initialized && dirty
	// 「提交」：报告文件改过（dirty）或在未初始化的报告目录上首次建立版本时可用。
	const canCommit = hasId && (!initialized || dirty)
	// 「撤回全部」：仅在存在未提交改动时有可撤回的内容。
	const canRevertAll = hasId && initialized && dirty

	const handleCommit = async () => {
		if (!hasId || committing) {
			return
		}
		setCommitting(true)
		try {
			const result = await commitProjectReportApi(reportId as string | number, commitMessage)
			message.success(
				result.committed
					? zh
						? "已提交报告改动"
						: "Report changes committed"
					: zh
						? "没有需要提交的改动"
						: "Nothing to commit",
			)
			setCommitOpen(false)
			setCommitMessage("")
			await reload()
			onReload?.()
		} finally {
			setCommitting(false)
		}
	}

	// 撤回全部：把报告目录所有文件恢复为 HEAD 版本。逐文件调用撤回接口（同一份原语），
	// 避免为「整目录撤回」再单开一个接口。
	const handleRevertAll = async () => {
		if (!hasId || revertingAll) {
			return
		}
		const paths = (state?.worktree.files ?? []).map((file) => file.path)
		if (paths.length === 0) {
			return
		}
		setRevertingAll(true)
		try {
			for (const path of paths) {
				await revertProjectReportFileApi(reportId as string | number, path)
			}
			message.success(zh ? "已撤回全部本地改动" : "All local changes reverted")
			await reload()
			onReload?.()
		} finally {
			setRevertingAll(false)
		}
	}

	const busy = loading || committing || revertingAll

	const statusTags = [
		!initialized
			? { key: "uninitialized", color: "default", label: zh ? "未建立版本" : "No version yet" }
			: dirty
				? { key: "dirty", color: "orange", label: zh ? "有未提交改动" : "Uncommitted edits" }
				: { key: "clean", color: "green", label: zh ? "已提交" : "Committed" },
	]

	return (
		<Space size={4} wrap>
			{statusTags.map((tag) => (
				<Tag key={tag.key} color={tag.color} style={{ marginInlineEnd: 0 }}>
					{tag.label}
				</Tag>
			))}

			<Popover
				trigger="click"
				placement="bottomLeft"
				title={zh ? "报告目录状态" : "Report directory"}
				content={
					<div style={{ maxWidth: 460, fontSize: 12 }}>
						<div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
							<span style={{ color: "rgba(0, 0, 0, 0.45)", flex: "0 0 auto" }}>{zh ? "目录" : "Dir"}</span>
							<span style={{ wordBreak: "break-all" }}>{gitState?.dir || "-"}</span>
						</div>
						<div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
							<span style={{ color: "rgba(0, 0, 0, 0.45)", flex: "0 0 auto" }}>{zh ? "最新提交" : "Commit"}</span>
							<span style={{ fontFamily: "monospace" }}>{gitState?.commit ? gitState.commit.slice(0, 7) : "-"}</span>
						</div>
					</div>
				}
			>
				<span style={{ cursor: "pointer" }}>
					<Tag color="blue" icon={<InfoCircleOutlined />} style={{ marginInlineEnd: 0 }} />
				</span>
			</Popover>

			{/* 查看变化：报告目录内的按文件 diff + 单文件撤回（复用组件目录的 diff 视图）。 */}
			{canViewDiff && (
				<Button
					size="small"
					color="geekblue"
					variant="outlined"
					icon={<DiffOutlined />}
					disabled={busy}
					onClick={() =>
						invoke.gitDiff.open(
							{ entity: "project_report", id: reportId as string | number },
							{
								footer: null,
								width: 960,
								title: `${zh ? "报告本地变化" : "Report local changes"}`,
							},
						)
					}
				>
					{zh ? "查看变化" : "View Changes"}
				</Button>
			)}

			{/* 撤回全部：整目录恢复为最近一次提交。 */}
			{canRevertAll && (
				<Popconfirm
					title={zh ? "撤回全部本地改动？" : "Discard all local changes?"}
					description={
						<div style={{ maxWidth: 320 }}>
							{zh
								? "报告目录下的所有文件都会恢复为最近一次提交时的内容，未提交的修改将丢失。"
								: "Every file in the report directory will be restored to the last commit; uncommitted edits are lost."}
						</div>
					}
					okText={zh ? "撤回" : "Revert"}
					cancelText={zh ? "取消" : "Cancel"}
					okButtonProps={{ danger: true, loading: revertingAll }}
					onConfirm={handleRevertAll}
				>
					<Button size="small" color="red" variant="outlined" icon={<UndoOutlined />} disabled={busy}>
						{zh ? "撤回修改" : "Discard Changes"}
					</Button>
				</Popconfirm>
			)}

			{/* 提交：把报告目录的所有改动提交为一个 commit，可填写 commit message。 */}
			{canCommit && (
				<Popover
					trigger="click"
					placement="bottomLeft"
					open={commitOpen}
					onOpenChange={(open) => {
						setCommitOpen(open)
						if (!open) {
							setCommitMessage("")
						}
					}}
					title={zh ? "提交报告改动" : "Commit report changes"}
					content={
						<div style={{ width: 320 }}>
							<div style={{ marginBottom: 8, fontSize: 12, color: "rgba(0, 0, 0, 0.45)" }}>
								{zh
									? "把报告目录下的所有改动提交为一个 commit（等同 git add -A + commit）。"
									: "Commits every change under the report directory as a single commit (git add -A + commit)."}
							</div>
							<Input
								value={commitMessage}
								onChange={(event) => setCommitMessage(event.target.value)}
								placeholder={zh ? "可选：commit message" : "Optional commit message"}
								allowClear
								disabled={committing}
								onPressEnter={handleCommit}
							/>
							<div style={{ marginTop: 8, textAlign: "right" }}>
								<Space size={4}>
									<Button size="small" disabled={committing} onClick={() => setCommitOpen(false)}>
										{zh ? "取消" : "Cancel"}
									</Button>
									<Button size="small" type="primary" loading={committing} onClick={handleCommit}>
										{zh ? "确定" : "OK"}
									</Button>
								</Space>
							</div>
						</div>
					}
				>
					<Button size="small" color="green" variant="outlined" icon={<SaveOutlined />} disabled={busy}>
						{zh ? "提交" : "Commit"}
					</Button>
				</Popover>
			)}

			<Button
				size="small"
				color="cyan"
				variant="outlined"
				icon={<ReloadOutlined />}
				loading={loading}
				disabled={committing || revertingAll}
				onClick={() => void reload(true)}
			/>
		</Space>
	)
}

export default ProjectReportGitActions

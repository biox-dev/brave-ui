import { Button, Input, Popconfirm, Popover, Space, Tag, Tooltip } from "antd"
import { FC, useState, type ReactNode } from "react"
import { DiffOutlined, InfoCircleOutlined, LinkOutlined, ReloadOutlined, SaveOutlined, SyncOutlined } from "@ant-design/icons"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useI18n } from "@/hooks/useI18n"
import { http } from "@/api/client/http"
import { saveScriptFilesApi, saveWorkflowFilesApi } from "@/api/pipeline/export-files"
import type { GitSyncState } from "@/api/pipeline/git"
import { invoke } from "@/core/ui-system/invokeV2"

/**
 * `git_state` 与后端 `utils.GitSyncState` 一一对应（类型定义见 `@/api/pipeline/git`），
 * 来自 `GetScriptById` / `GetWorkflowById` 返回的 `git_state`
 * （由磁盘上的 git 元数据实时推导，不落库）。
 *
 * 「查看本地变化」按钮调用的 `git-diff` 接口也复用同一套状态位。
 */
type StoreEntity = "script" | "workflow"

interface GitStateActionsProps {
	entity: StoreEntity
	item?: Record<string, unknown>
	onReload?: () => void
}

interface StatusTag {
	key: string
	color: string
	label: string
	tip: string
}

const toText = (value: unknown): string => {
	if (value === null || value === undefined) {
		return ""
	}
	return String(value)
}

const shortCommit = (value: unknown): string => toText(value).trim().slice(0, 7)

/**
 * 把 git 地址转成可在浏览器打开的网页地址；无法转换（如本地路径）时返回空串。
 * ssh 形式 `git@github.com:owner/repo.git` → `https://github.com/owner/repo`。
 */
const toWebURL = (raw: string): string => {
	const url = toText(raw).trim()
	if (!url) {
		return ""
	}
	const ssh = url.match(/^git@([^:]+):(.+)$/)
	if (ssh) {
		return `https://${ssh[1]}/${ssh[2].replace(/\.git$/, "")}`
	}
	if (/^https?:\/\//i.test(url)) {
		return url.replace(/\.git$/, "")
	}
	return ""
}

const readGitState = (value: unknown): GitSyncState | undefined => {
	if (!value || typeof value !== "object") {
		return undefined
	}
	return value as GitSyncState
}

const joinTip = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(" ")

/**
 * 可视化 `git_state`：把「本地未提交改动 / 待发布 / store 有更新 / 已同步」
 * 这几个布尔位渲染成标签，并在需要时给出「检查更新 / 重新安装」动作。
 */
const GitStateActions: FC<GitStateActionsProps> = ({ entity, item, onReload }) => {
	const message = useGlobalMessage()
	const { locale } = useI18n()
	const zh = locale === "zh_CN"

	const [checkingUpdate, setCheckingUpdate] = useState(false)
	const [reinstalling, setReinstalling] = useState(false)
	// 「生成导出文件并提交」的展开状态 / 可选 commit message / 提交中标记。
	const [commitOpen, setCommitOpen] = useState(false)
	const [commitMessage, setCommitMessage] = useState("")
	const [committing, setCommitting] = useState(false)

	const state = readGitState(item?.git_state)
	const version = toText(item?.version)
	const storeId = toText(item?.store_id)
	// 组件 int64 主键（后端 `json:"id,string"`，前端收到的就是字符串）。
	const componentId = toText(item?.id)

	const reinstallEndpoint = entity === "script"
		? `/workflow/install-script/${encodeURIComponent(storeId)}`
		: `/workflow/install-workflow/${encodeURIComponent(storeId)}`

	/**
	 * 「生成导出文件并提交」入口的可见性：只在本地代码有变化时展示。
	 *
	 * 保存组件（/workflow/save-script、/workflow/save-workflow）不再隐式生成 script.json /
	 * workflow.json，也不再隐式提交 git，因此需要用户显式触发一次：
	 *   - `local_dirty`：工作区存在未提交改动（保存后、上传封面/README 后都会有）；
	 *   - `!local_initialized`：本地目录还不是 git 仓库（首次保存，尚无任何提交）。
	 * 提交过后工作区变干净且仓库已初始化，该入口自动隐藏（剩余差异交给发布）。
	 */
	const canGenerateFiles = componentId !== "" && (!state?.local_initialized || !!state?.local_dirty)

	/**
	 * 「查看本地变化」入口的可见性：本地目录已是 git 仓库、且存在本地变化
	 * （`local_dirty` 未提交改动 或 `local_ahead` 已提交未发布）时展示。
	 *
	 * 目录还不是 git 仓库（`!local_initialized`）时没有可对比的基线，隐藏该入口。
	 */
	const canViewDiff = componentId !== "" && !!state?.local_initialized && !!state?.local_dirty

	if (!state) {
		return null
	}

	// store 裸仓库上配置的远程仓库（发布到远程时写入 git remote，不落库）：
	// 可能多个（github / gitee / origin ...），因此下面都按列表展示。
	const remotes = state.remotes ?? []

	const handleGenerateFiles = async () => {
		if (!componentId || committing) {
			return
		}
		setCommitting(true)
		try {
			// 错误已由 http 拦截器统一提示。
			if (entity === "script") {
				await saveScriptFilesApi(componentId, commitMessage)
			} else {
				await saveWorkflowFilesApi(componentId, commitMessage)
			}
			message.success(zh ? "已生成导出文件并提交" : "Export files generated and committed")
			setCommitOpen(false)
			setCommitMessage("")
			onReload?.()
		} finally {
			setCommitting(false)
		}
	}

	const localCommit = shortCommit(state.local_commit)
	const storeCommit = shortCommit(state.store_commit)
	const commitTip = [
		localCommit ? `${zh ? "本地" : "local"} ${localCommit}` : "",
		storeCommit ? `store ${storeCommit}` : "",
	].filter(Boolean).join(" · ")

	// 状态标签：直接映射 git_state 的布尔位，一眼区分「本地有改动 / 待发布 / 待安装 / 已同步」。
	const statusTags: StatusTag[] = []
	if (!state.local_initialized && !state.store_initialized) {
		statusTags.push({
			key: "uninitialized",
			color: "default",
			label: zh ? "未初始化" : "Not initialized",
			tip: joinTip(
				zh ? "本地目录与 store 都还不是 git 仓库：尚未保存或发布过。" : "Neither the local dir nor the store is a git repository yet.",
				commitTip,
			),
		})
	} else {
		if (!state.store_initialized) {
			statusTags.push({
				key: "unpublished",
				color: "default",
				label: zh ? "未发布" : "Unpublished",
				tip: joinTip(
					zh ? "本地已有版本仓库，但还没有发布到 store。" : "A local repo exists but nothing has been published to the store yet.",
					commitTip,
				),
			})
		}
		if (state.local_dirty) {
			statusTags.push({
				key: "dirty",
				color: "orange",
				label: zh ? "本地未提交" : "Local edits",
				tip: zh ? "工作区存在未提交改动（含未跟踪文件），尚未生成版本提交。" : "The worktree has uncommitted changes (including untracked files).",
			})
		}
		if (state.local_ahead && state.store_initialized) {
			statusTags.push({
				key: "local-ahead",
				color: "gold",
				label: zh ? "待发布" : "Ahead of store",
				tip: joinTip(
					zh ? "本地已有提交但未发布到 store。" : "Local commits have not been published to the store.",
					commitTip,
				),
			})
		}
		if (state.store_ahead) {
			statusTags.push({
				key: "store-ahead",
				color: "red",
				label: zh ? "store 有更新" : "Store updated",
				tip: joinTip(
					zh ? "store 有本地没有的提交，需要重新安装同步。" : "The store has commits that are missing locally; reinstall to sync.",
					commitTip,
				),
			})
		}
		if (state.in_sync) {
			statusTags.push({
				key: "in-sync",
				color: "green",
				label: zh ? "已同步" : "In sync",
				tip: joinTip(zh ? "本地干净且与 store 一致。" : "The worktree is clean and matches the store.", commitTip),
			})
		}
	}

	const commitCell = (value: unknown): ReactNode => {
		const full = toText(value).trim()
		if (!full) {
			return "-"
		}
		return (
			<Tooltip title={full}>
				<span style={{ fontFamily: "monospace" }}>{full.slice(0, 7)}</span>
			</Tooltip>
		)
	}

	const flagCell = (flag: boolean): ReactNode => (
		<Tag color={flag ? "red" : "default"} style={{ marginInlineEnd: 0 }}>
			{flag ? (zh ? "是" : "yes") : (zh ? "否" : "no")}
		</Tag>
	)

	const detailRow = (label: string, value: ReactNode): ReactNode => (
		<div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
			<span style={{ color: "rgba(0, 0, 0, 0.45)", flex: "0 0 auto" }}>{label}</span>
			<span style={{ wordBreak: "break-all" }}>{value}</span>
		</div>
	)

	const details = (
		<div style={{ maxWidth: 460, fontSize: 12 }}>
			{detailRow(zh ? "本地目录" : "Local dir", state.local_dir || "-")}
			{detailRow(zh ? "store 目录" : "Store dir", state.store_dir || "-")}
			{detailRow(zh ? "本地 commit" : "Local commit", commitCell(state.local_commit))}
			{detailRow(zh ? "store commit" : "Store commit", commitCell(state.store_commit))}
			{detailRow(zh ? "未提交改动" : "Local edits", flagCell(!!state.local_dirty))}
			{detailRow(zh ? "本地领先 store" : "Local ahead", flagCell(!!state.local_ahead))}
			{detailRow(zh ? "store 领先本地" : "Store ahead", flagCell(!!state.store_ahead))}
			{detailRow(
				zh ? "远程仓库" : "Remotes",
				remotes.length === 0
					? "-"
					: remotes.map((remote) => `${remote.name}: ${remote.urls.join(", ")}`).join(" / "),
			)}
		</div>
	)

	// 远程仓库列表：每个 remote 一行，地址可点击时跳浏览器（本地路径 / 未知协议则只展示文本）。
	const remotesContent = (
		<div style={{ maxWidth: 460, fontSize: 12 }}>
			{remotes.map((remote) => (
				<div key={remote.name} style={{ marginBottom: 8 }}>
					<Tag color="blue" style={{ marginInlineEnd: 8 }}>
						{remote.name}
					</Tag>
					{remote.urls.map((rawURL) => {
						const webURL = toWebURL(rawURL)
						return (
							<div key={rawURL} style={{ marginTop: 4, wordBreak: "break-all" }}>
								{webURL ? (
									<a href={webURL} target="_blank" rel="noopener noreferrer">
										{rawURL}
									</a>
								) : (
									<span>{rawURL}</span>
								)}
							</div>
						)
					})}
				</div>
			))}
		</div>
	)

	// redownload 走 store 仓库的 origin（拉取上游更新），因此要求仓库上确实配置了 origin remote。
	const hasOriginRemote = remotes.some((remote) => remote.name === "origin")
	const canCheckUpdate = storeId !== "" && hasOriginRemote
	// 只要本地与 store 存在差异（本地有未提交/未发布改动，或 store 领先本地）就展示：
	// 用户可以随时用 store 的版本覆盖回本地。store 尚未初始化时没有内容可拉取，不展示。
	const canReinstall = storeId !== "" && !!state.store_initialized && !state.in_sync
	// 本地存在会被覆盖的改动（未提交改动 / 已提交未发布）时，在确认框里额外提醒。
	const reinstallOverwritesLocal = !!state.has_local_changes

	return (
		<Space size={4} wrap>
			{/* {!!version && (
				<Tooltip title={zh ? "组件版本（保存时填写）" : "Component version (set on save)"}>
					<Tag style={{ marginInlineEnd: 0 }}>{version}</Tag>
				</Tooltip>
			)} */}

			{statusTags.map((tag) => (
				<Tooltip key={tag.key} title={tag.tip}>
					<Tag color={tag.color} style={{ marginInlineEnd: 0 }}>
						{tag.label}
					</Tag>
				</Tooltip>
			))}

			<Popover
				trigger="click"
				placement="bottomLeft"
				title={zh ? "Git 同步状态" : "Git sync state"}
				content={details}
			>
				<span style={{ cursor: "pointer" }}>
					<Tag color="blue" icon={<InfoCircleOutlined />} style={{ marginInlineEnd: 0 }} />
				</span>
			</Popover>

			{/* 远程仓库：store 裸仓库上配置的 remote（发布到远程时写入，不落库），可能多个。 */}
			{remotes.length > 0 && (
				<Popover
					trigger="click"
					placement="bottomLeft"
					title={zh ? "远程仓库" : "Remotes"}
					content={remotesContent}
				>
					<span style={{ cursor: "pointer" }}>
						<Tag color="geekblue" icon={<LinkOutlined />} style={{ marginInlineEnd: 0 }}>
							{remotes.length}
						</Tag>
					</span>
				</Popover>
			)}

			{/* 查看本地变化：仅在本地仓库存在且有变化（未提交改动 / 已提交未发布）时展示。 */}
			{canViewDiff && (
				<Button
					size="small"
					color="geekblue"
					variant="outlined"
					icon={<DiffOutlined />}
					disabled={checkingUpdate || reinstalling || committing}
					onClick={() =>
						invoke.gitDiff.open(
							{ entity, id: componentId },
							{
								footer: null,
								width: 960,
								title: `${zh ? "本地变化" : "Local changes"} · ${entity === "script" ? (zh ? "脚本" : "script") : zh ? "工作流" : "workflow"}`,
							},
						)
					}
				>
					{zh ? "查看变化" : "View Changes"}
				</Button>
			)}

			{/* 生成导出文件并提交：仅在本地代码有变化（未提交改动 / 本地目录还没成为 git 仓库）时展示。 */}
			{canGenerateFiles && (
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
					title={zh ? "生成导出文件并提交" : "Generate files & commit"}
					content={
						<div style={{ width: 320 }}>
							<div style={{ marginBottom: 8, fontSize: 12, color: "rgba(0, 0, 0, 0.45)" }}>
								{zh
									? `将重新生成 ${entity === "script" ? "script.json" : "workflow.json"}，并把本地目录改动提交为一个 commit。`
									: `Regenerates ${entity === "script" ? "script.json" : "workflow.json"} and commits the local changes.`}
							</div>
							<Input
								value={commitMessage}
								onChange={(event) => setCommitMessage(event.target.value)}
								placeholder={zh ? "可选：commit message" : "Optional commit message"}
								allowClear
								disabled={committing}
								onPressEnter={handleGenerateFiles}
							/>
							<div style={{ marginTop: 8, textAlign: "right" }}>
								<Space size={4}>
									<Button size="small" disabled={committing} onClick={() => setCommitOpen(false)}>
										{zh ? "取消" : "Cancel"}
									</Button>
									<Button size="small" type="primary" loading={committing} onClick={handleGenerateFiles}>
										{zh ? "确定" : "OK"}
									</Button>
								</Space>
							</div>
						</div>
					}
				>
					<Button
						size="small"
						color="green"
						variant="outlined"
						icon={<SaveOutlined />}
						loading={committing}
						disabled={checkingUpdate || reinstalling}
					>
						{zh ? "生成并提交" : "Generate & Commit"}
					</Button>
				</Popover>
			)}

			{canCheckUpdate && (
				<Button
					size="small"
					color="cyan"
					variant="outlined"
					icon={<SyncOutlined />}
					loading={checkingUpdate}
					disabled={reinstalling}
					onClick={async () => {
						try {
							setCheckingUpdate(true)
							await http.post(`/store/redownload`, { id: storeId })
							message.success(zh ? "已从远端更新 store" : "Store refreshed from remote")
							onReload?.()
						} finally {
							setCheckingUpdate(false)
						}
					}}
				>
					{zh ? "检查更新" : "Check Update"}
				</Button>
			)}

			{canReinstall && (
				<Popconfirm
					title={zh ? "从 store 重新安装？" : "ReInstall from store?"}
					description={
						<div style={{ maxWidth: 320 }}>
							<div>
								{zh
									? "将用 store 中的版本覆盖本地目录，并同步组件记录。"
									: "The local directory will be overwritten by the store version and the component record synced."}
							</div>
							{reinstallOverwritesLocal && (
								<div style={{ marginTop: 4, color: "#d4380d" }}>
									{zh
										? `本地存在${state.local_dirty && state.local_ahead ? "未提交改动与未发布的提交" : state.local_dirty ? "未提交改动" : "已提交但未发布的提交"}，会被丢弃。`
										: `Local ${state.local_dirty && state.local_ahead ? "uncommitted changes and unpublished commits" : state.local_dirty ? "uncommitted changes" : "commits not yet published"} will be discarded.`}
								</div>
							)}
						</div>
					}
					okButtonProps={{ loading: reinstalling, disabled: checkingUpdate }}
					cancelButtonProps={{ disabled: reinstalling }}
					onConfirm={async () => {
						try {
							setReinstalling(true)
							await http.post(reinstallEndpoint, {}, { timeout: 60000 })
							message.success(zh ? "重新安装完成" : "ReInstalled successfully")
							onReload?.()
						} finally {
							setReinstalling(false)
						}
					}}
				>
					<Button
						size="small"
						color="blue"
						variant="solid"
						icon={<ReloadOutlined />}
						loading={reinstalling}
						disabled={checkingUpdate}
					>
						{zh ? "重新安装" : "ReInstall"}
					</Button>
				</Popconfirm>
			)}
		</Space>
	)
}

export default GitStateActions

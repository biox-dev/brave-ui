import type { GitDiffFile, GitDiffFileStatus, GitDiffSection } from "@/api/pipeline/git"

/**
 * 组件目录（script / workflow）与报告目录（project_report）共用的 git diff 展示原语。
 *
 * 两处的后端 diff 结构一致（都复用 `utils.GitDiffSection`），差异只在「是否有未发布提交
 * 段落」与「撤回接口的路径」上，因此把纯展示逻辑集中在这里，避免 diff 视图重复实现。
 */

/** git diff 文件状态 -> antd Tag 颜色。 */
export const gitDiffStatusColor: Record<GitDiffFileStatus, string> = {
	added: "green",
	modified: "gold",
	deleted: "red",
}

/** git diff 文件状态 -> 展示文案（中英）。 */
export const gitDiffStatusLabel = (status: GitDiffFileStatus, zh: boolean): string => {
	switch (status) {
		case "added":
			return zh ? "新增" : "added"
		case "deleted":
			return zh ? "删除" : "deleted"
		default:
			return zh ? "修改" : "modified"
	}
}

/** diff 代码块使用的等宽字体栈。 */
export const gitDiffMonospace = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/** 单行着色：与 git 的 unified diff 记号保持一致。 */
export const gitDiffLineStyle = (line: string): { background: string; color: string } => {
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

/** 单个文件的悬浮提示文案（区分二进制 / 超大文件）。 */
export const gitDiffFileTooltip = (file: GitDiffFile, zh: boolean): string => {
	const label = gitDiffStatusLabel(file.status, zh)
	if (file.omitted) {
		return `${label} ${file.path} · ${zh ? "文件过大，未展示内容" : "file too large, content omitted"}`
	}
	if (file.binary) {
		return `${label} ${file.path} · ${zh ? "二进制文件，不展示内容" : "binary file, content not shown"}`
	}
	return `${label} ${file.path} +${file.additions} -${file.deletions}`
}

/** section 概要文案：文件数 / 增删行数 / 基线 commit / 是否截断。 */
export const gitDiffSectionSummary = (section: GitDiffSection, zh: boolean): string => {
	const parts = [
		zh ? `${section.file_count} 个文件` : `${section.file_count} files`,
		`+${section.additions} -${section.deletions}`,
	]
	if (section.base_commit) {
		parts.push(`${zh ? "基线" : "base"} ${section.base_commit.slice(0, 7)}`)
	}
	if (section.target_commit) {
		parts.push(`-> ${section.target_commit.slice(0, 7)}`)
	}
	if (section.truncated) {
		parts.push(zh ? "内容过大已截断" : "truncated")
	}
	return parts.join(" · ")
}

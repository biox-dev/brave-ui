import { FC } from "react"
import { useParams } from "react-router"
import { ProjectReportFilePanel } from "@/components/project-report-file"

/**
 * ReportFile 是报告正文文件（output.md）的路由页：`/report-file/:report-id`。
 *
 * 界面本身在 `components/project-report-file`（`ProjectReportFilePanel`）：
 * Agent 会话右侧工作区的「projectReportFile」标签复用同一个组件，
 * 避免文件读取、git 操作、PDF 导出等逻辑出现两份实现。本页只负责从路由取报告 ID。
 */
const ReportFile: FC = () => {
  const { "report-id": reportId } = useParams<{ "report-id": string }>()

  return <ProjectReportFilePanel reportId={reportId} />
}

export default ReportFile

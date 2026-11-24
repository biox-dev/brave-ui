import { FC } from "react"
import { useParams } from "react-router"
import ProjectReportFilePanel from "@/pages/page-route/project-report-file-panel"

/**
 * ReportFile 是报告正文文件（output.md）的路由页：`/report-file/:report-id`。
 *
 * 界面实现在 `pages/page-route/project-report-file-panel.tsx`，与 Agent 会话右侧
 * 工作区的 `projectReportFile` 标签共用同一个组件；本页只负责从路由取报告 ID。
 */
const ReportFile: FC = () => {
  const { "report-id": reportId } = useParams<{ "report-id": string }>()

  return <ProjectReportFilePanel reportId={reportId} />
}

export default ReportFile

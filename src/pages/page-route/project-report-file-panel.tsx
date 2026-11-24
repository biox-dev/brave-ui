import { FC, useEffect, useState } from "react"
import { Button, Flex, Segmented, Skeleton, Spin, Tag, Tooltip } from "antd"
import {
  FilePdfOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons"
import { useSelector } from "react-redux"
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver"
import {
  getProjectReportDetailApi,
  getProjectReportFileApi,
  getProjectReportFileHtmlApi,
  updateProjectReportFileApi,
  type ProjectReportDetail,
} from "@/api/project"
import ProjectReportGitActions from "@/components/project-report-git/project-report-git-actions"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useInsertAgentRef } from "@/hooks/useInsertAgentRef"
import PanelLayout from "@/components/common/panel-layout"
import { printHtmlDocument } from "@/utils/print-html"

type ReportFileMode = "view" | "update"

export interface ProjectReportFilePanelProps {
  /** 报告 ID：来自路由参数 `/report-file/:report-id`，或右侧工作区标签的 `params.reportId`。 */
  reportId?: string
  /**
   * 是否渲染页面自身的标题栏（`PanelLayout` 的 header）。
   *
   * 路由整页打开时需要（没有别的地方显示报告名）；作为右侧工作区的标签内容时
   * 标签栏已经给了标题，再画一条标题栏会挤占高度，传 `false` 只保留内容区。
   */
  showHeader?: boolean
  /**
   * 挂载时直接进入「更新」视图。
   *
   * 从会话结果里点进来的报告，用户通常是为了接着改正文，因此工作区标签传 `true`；
   * 普通路由页仍默认「查看」。
   */
  defaultMode?: ReportFileMode
}

/**
 * 报告正文（工作目录下的 output.md）查看 / 编辑面板。
 *
 * 这是**唯一一份**报告文件界面实现：普通路由页 `/report-file/:report-id`
 * 与 Agent 会话右侧工作区标签（`projectReportFile` 视图）都复用它，
 * 区别只在「报告 ID 从哪来」与「要不要自己的标题栏」由 props 决定。
 *
 * - 顶部「查看 / 更新」切换：查看用 markdown 渲染，更新用 Monaco 编辑器；
 * - 报告目录纳入 git 版本管理（首次保存自动 init，见后端 UpdateProjectReportFile），
 *   右上角复用 ProjectReportGitActions 提供「查看变化 / 提交 / 撤回修改」；
 * - 右上角「Ask Agent」把本报告作为 @report:<id> 引用插进 Agent 输入框。
 */
const ProjectReportFilePanel: FC<ProjectReportFilePanelProps> = ({
  reportId,
  showHeader = true,
  defaultMode = "view",
}) => {
  const message = useGlobalMessage()
  // 把本报告的 @report:<id> 引用 chip 插进 Agent 输入框（面板未打开时会自动切过去）。
  const insertAgentRef = useInsertAgentRef()
  const { project } = useSelector((state: any) => state.user)
  const projectId = typeof project === "string" ? project : project?.project_id

  const [mode, setMode] = useState<ReportFileMode>(defaultMode)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // 导出 PDF：复用 HTML 导出能力（内嵌图片）后送入浏览器打印流程。
  const [pdfExporting, setPdfExporting] = useState(false)
  const [report, setReport] = useState<ProjectReportDetail>()
  // content 是已保存的内容（用于查看视图），draft 是编辑器中的草稿。
  const [content, setContent] = useState("")
  const [draft, setDraft] = useState("")
  // gitVersion 用于在 git 操作（提交 / 撤回）后强制刷新 git 操作条本身。
  const [gitVersion, setGitVersion] = useState(0)

  const load = async (id?: string) => {
    if (!id) {
      setReport(undefined)
      setContent("")
      setDraft("")
      return
    }

    setLoading(true)
    try {
      const [detailResp, fileResp] = await Promise.all([
        getProjectReportDetailApi(id),
        getProjectReportFileApi(id),
      ])
      setReport(detailResp.data)
      const fileContent = fileResp.data?.content ?? ""
      setContent(fileContent)
      setDraft(fileContent)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(reportId)
  }, [reportId])

  // reportId 变化（同一个标签被重新指向另一份报告）时回到默认视图。
  useEffect(() => {
    setMode(defaultMode)
  }, [reportId, defaultMode])

  const handleExportPdf = async () => {
    if (!reportId) {
      message.warning("No report loaded")
      return
    }

    setPdfExporting(true)
    try {
      // 使用内嵌图片版本，导出时无需网络、图片不缺失。
      const resp = await getProjectReportFileHtmlApi(reportId, true)
      printHtmlDocument(resp.data)
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPdfExporting(false)
    }
  }

  const handleSave = async () => {
    if (!reportId) {
      message.warning("No report loaded")
      return
    }

    setSaving(true)
    try {
      await updateProjectReportFileApi({ report_id: reportId, content: draft })
      message.success("Saved successfully")
      // 保存后同步查看视图内容，方便直接切回查看。
      setContent(draft)
      // 保存会在报告目录产生未提交改动，刷新 git 操作条的状态标签。
      setGitVersion((version) => version + 1)
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setSaving(false)
    }
  }

  const extra = (
    <Flex gap="small" align="center" wrap>
      {/* 把当前报告作为 @report:<id> 引用插进 Agent 输入框（相当于手动打一个引用 chip）。 */}
      <Button
        size="small"
        icon={<RobotOutlined />}
        disabled={!reportId}
        onClick={() => {
          const ok = insertAgentRef("report", reportId, {
            label: report?.title || `Report-${reportId}`,
          })
          if (ok) message.success("Reference added to Agent input")
        }}
      >
        Ask Agent
      </Button>
      {/* 报告目录的 git 操作：查看变化 / 提交 / 撤回修改。 */}
      <ProjectReportGitActions
        key={`${reportId}-${gitVersion}`}
        reportId={reportId}
        onReload={() => load(reportId)}
      />
      <Segmented
        size="small"
        value={mode}
        onChange={(value) => setMode(value as ReportFileMode)}
        options={[
          { label: "查看", value: "view" },
          { label: "更新", value: "update" },
        ]}
      />
      {/* 导出报告文件（output.md）为 PDF：后端渲染自包含 HTML 后走浏览器打印。 */}
      <Button
        size="small"
        icon={<FilePdfOutlined />}
        loading={pdfExporting}
        disabled={!reportId}
        onClick={handleExportPdf}
      >
        PDF
      </Button>
      {mode === "update" && (
        <Button
          size="small"
          color="cyan"
          variant="solid"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
        >
          保存
        </Button>
      )}
      <Button
        icon={<ReloadOutlined />}
        size="small"
        color="cyan"
        variant="solid"
        onClick={() => load(reportId)}
      />
    </Flex>
  )

  const body = (
    <Spin spinning={loading}>
      {loading ? (
        <Skeleton active />
      ) : !reportId || !report ? (
        <Tag color="orange">Report not found</Tag>
      ) : mode === "view" ? (
        <ComponentsDetailsRender
          view="analysisDocView"
          project_id={projectId}
          content={content}
        />
      ) : (
        <ComponentsDetailsRender
          view="projectReportFileEditor"
          project_id={projectId}
          content={draft}
          onChange={setDraft}
        />
      )}
    </Spin>
  )

  // 作为右侧工作区标签内容时不画自己的标题栏，只保留内容（连同操作条）。
  if (!showHeader) {
    return (
      <Flex vertical gap="small" style={{ height: "100%", padding: 12 }}>
        {extra}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{body}</div>
      </Flex>
    )
  }

  return (
    <PanelLayout
      className="report-file-page page-flat"
      bodyStyle={{ padding: 12 }}
      title={
        <Flex align="center" gap="small">
          <Tooltip title={reportId}>
            <span>{report?.title || "Report File"}</span>
          </Tooltip>
        </Flex>
      }
      extra={extra}
    >
      {body}
    </PanelLayout>
  )
}

export default ProjectReportFilePanel

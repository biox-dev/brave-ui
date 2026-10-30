import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Segmented, Skeleton, Spin, Tag } from "antd";
import { ArrowLeftOutlined, FilePdfOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import {
  getProjectReportDetailApi,
  getProjectReportFileApi,
  getProjectReportFileHtmlApi,
  updateProjectReportFileApi,
  type ProjectReportDetail,
} from "@/api/project";
import ProjectReportGitActions from "@/components/project-report-git/project-report-git-actions";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { LLMEnvType, setLLMEnv } from "@/utils/llm-env";
import { printHtmlDocument } from "@/utils/print-html";

type ReportFileView = "view" | "update";

// ReportFile 用于查看/编辑报告工作目录下的自身 markdown 文件（output.md）。
// 顶部提供「查看 / 更新」视图切换：查看用 markdown 渲染，更新用编辑器。
// 报告目录同时纳入 git 版本管理（首次保存自动 init，见后端 UpdateProjectReportFile），
// 右上角复用 ProjectReportGitActions 提供「查看变化 / 提交 / 撤回修改」。
const ReportFile: FC<any> = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const { "report-id": reportId } = useParams<{ "report-id": string }>();

  const [view, setView] = useState<ReportFileView>("view");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 导出 PDF：复用 HTML 导出能力（内嵌图片）后送入浏览器打印流程。
  const [pdfExporting, setPdfExporting] = useState(false);
  const [report, setReport] = useState<ProjectReportDetail>();
  // content 是已保存的内容（用于查看视图），draft 是编辑器中的草稿。
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  // gitVersion 用于在 git 操作（提交 / 撤回）后强制刷新 git 操作条本身。
  const [gitVersion, setGitVersion] = useState(0);

  const load = async (id?: string) => {
    if (!id) {
      setReport(undefined);
      setContent("");
      setDraft("");
      return;
    }

    setLoading(true);
    try {
      const [detailResp, fileResp] = await Promise.all([
        getProjectReportDetailApi(id),
        getProjectReportFileApi(id),
      ]);
      setReport(detailResp.data);
      const fileContent = fileResp.data?.content ?? "";
      setContent(fileContent);
      setDraft(fileContent);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(reportId);
  }, [reportId]);

  // handleExportPdf 拉取报告自身文件的 HTML（内嵌图片）并交给浏览器打印为 PDF。
  const handleExportPdf = async () => {
    if (!reportId) {
      message.warning("No report loaded");
      return;
    }

    setPdfExporting(true);
    try {
      // 使用内嵌图片版本，导出时无需网络、图片不缺失。
      const resp = await getProjectReportFileHtmlApi(reportId, true);
      printHtmlDocument(resp.data);
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPdfExporting(false);
    }
  };

  const handleSave = async () => {
    if (!reportId) {
      message.warning("No report loaded");
      return;
    }

    setSaving(true);
    try {
      await updateProjectReportFileApi({ report_id: reportId, content: draft });
      message.success("Saved successfully");
      // 保存后同步查看视图内容，方便直接切回查看。
      setContent(draft);
      // 保存会在报告目录产生未提交改动，刷新 git 操作条的状态标签。
      setGitVersion((version) => version + 1);
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxShadow: "none",
      }}
      styles={{
        body: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflowY: "auto",
        },
      }}
      variant="borderless"
      size="small"
      title={
        <Flex align="center" gap="small">
          {/* <Button size="small" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} /> */}
          <span>{report?.title || "Report File"}</span>
        </Flex>
      }
      extra={
        <Flex gap="small" align="center">
          {/* 把当前报告绑定为当前用户的 Agent 业务上下文（llmEnv）。 */}
          <Button
            size="small"
            color="geekblue"
            variant="solid"
            disabled={!reportId}
            onClick={async () => {
              await setLLMEnv(reportId, LLMEnvType.ProjectReport);
              message.success("Agent context bound to report");
            }}
          >
            Use as Agent Context
          </Button>
          {/* 报告目录的 git 操作：查看变化 / 提交 / 撤回修改。 */}
          <ProjectReportGitActions
            key={`${reportId}-${gitVersion}`}
            reportId={reportId}
            onReload={() => load(reportId)}
          />
          <Segmented
            size="small"
            value={view}
            onChange={(value) => setView(value as ReportFileView)}
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
          {view === "update" && (
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
      }
    >
      <Spin spinning={loading}>
        {loading ? (
          <Skeleton active />
        ) : !report ? (
          <Tag color="orange">Report not found</Tag>
        ) : view === "view" ? (
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
    </Card>
  );
};

export default ReportFile;

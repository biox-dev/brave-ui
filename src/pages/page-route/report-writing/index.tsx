import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Modal, Segmented, Skeleton, Spin, Tag } from "antd";
import { ArrowLeftOutlined, BookOutlined, DownloadOutlined, EditOutlined, FileMarkdownOutlined, FilePdfOutlined, FileTextOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import {
  getProjectReportContentApi,
  getProjectReportHtmlApi,
  getProjectReportItemContentApi,
  publishProjectReportItemToDocApi,
  publishProjectReportToDocApi,
  type ProjectReportContentResponse,
  type ProjectReportItemContentResponse,
} from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { setLLMEnv } from "@/utils/llm-env";
import { printHtmlDocument } from "@/utils/print-html";
import { getPathname } from "@/utils/utils";

// sanitizeFileName 移除文件名中的非法字符，空标题时回退到默认名。
const sanitizeFileName = (name: string, fallback: string) => {
  const cleaned = (name || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  return cleaned || fallback;
};

const ReportWriting: FC<any> = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const { "project-report-id": projectReportId, "item-id": itemId } = useParams<{
    "project-report-id": string;
    "item-id": string;
  }>();

  const [view, setView] = useState<any>("analysisDocView");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingReport, setPublishingReport] = useState(false);
  // 报告容器视图：报告标题 + 所有条目拼接后的正文。
  const [content, setContent] = useState<ProjectReportContentResponse>();
  // 单个条目视图：入参为 ProjectReportItem ID，显示该条目的 markdown。
  const [itemContent, setItemContent] = useState<ProjectReportItemContentResponse>();
  // HTML 预览弹窗：支持「内嵌图片（base64）」与「原始链接」两种模式。
  const [htmlPreview, setHtmlPreview] = useState<{
    open: boolean;
    loading: boolean;
    inlineImages: boolean;
    content: string;
  }>({ open: false, loading: false, inlineImages: true, content: "" });
  // 导出 PDF：复用 HTML 导出能力（内嵌图片）后送入浏览器打印流程。
  const [pdfExporting, setPdfExporting] = useState(false);
  // 下载原始 Markdown：将报告聚合后的 markdown 文本保存为 .md 文件。
  const [mdDownloading, setMdDownloading] = useState(false);

  const loadContent = async (reportId?: string, currentItemId?: string) => {
    if (!reportId && !currentItemId) {
      setContent(undefined);
      setItemContent(undefined);
      return;
    }

    setLoading(true);
    try {
      if (currentItemId) {
        // Item detail view: drop stale report container content so the
        // title/body are always driven by the active route branch.
        setContent(undefined);
        const resp = await getProjectReportItemContentApi(currentItemId);
        setItemContent(resp.data);
        return;
      }
      // Report container view: drop the previously opened item, otherwise the
      // stale itemContent keeps overriding title/content.
      setItemContent(undefined);
      const resp = await getProjectReportContentApi(reportId!);
      setContent(resp.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLLMEnv(projectReportId, "projectReport");
    loadContent(projectReportId, itemId);
  }, [projectReportId, itemId]);

  const handlePublishToDoc = async () => {
    if (!itemId) {
      message.warning("No report item loaded");
      return;
    }

    setPublishing(true);
    try {
      await publishProjectReportItemToDocApi(itemId);
      message.success("Report item published to project doc");
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPublishing(false);
    }
  };

  // handlePublishReportToDoc 将报告下所有条目批量发布到报告文档目录。
  const handlePublishReportToDoc = async () => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }

    setPublishingReport(true);
    try {
      await publishProjectReportToDocApi(projectReportId);
      message.success("Report published to project doc");
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPublishingReport(false);
    }
  };

  // handleOpenDoc 在新标签页打开该报告的文档（后端按 ProjectReport ID 解析文档目录）。
  const handleOpenDoc = () => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }
    window.open(`${getPathname()}/docs/${projectReportId}/`, "_blank");
  };

  const loadHtmlPreview = async (inlineImages: boolean) => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }
    setHtmlPreview((prev) => ({ ...prev, open: true, loading: true }));
    try {
      const resp = await getProjectReportHtmlApi(projectReportId, inlineImages);
      setHtmlPreview({ open: true, loading: false, inlineImages, content: resp.data });
    } catch {
      // Error is surfaced globally by the http client interceptor.
      setHtmlPreview((prev) => ({ ...prev, loading: false }));
    }
  };

  const downloadHtmlPreview = () => {
    if (!htmlPreview.content) {
      return;
    }
    const blob = new Blob([htmlPreview.content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${content?.title || "report"}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }
    setPdfExporting(true);
    try {
      // 使用内嵌图片版本，导出时无需网络、图片不缺失。
      const resp = await getProjectReportHtmlApi(projectReportId, true);
      printHtmlDocument(resp.data);
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPdfExporting(false);
    }
  };

  // handleDownloadMarkdown 拉取最新的报告聚合内容并保存为原始 Markdown 文件。
  const handleDownloadMarkdown = async () => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }

    setMdDownloading(true);
    try {
      const resp = await getProjectReportContentApi(projectReportId);
      const markdown = resp.data?.content ?? "";
      if (!markdown) {
        message.warning("Report is empty");
        return;
      }
      const title = resp.data?.title || content?.title || "report";
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFileName(title, "report")}.md`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setMdDownloading(false);
    }
  };

  const openUpdateReportModal = async () => {
    if (!projectReportId) {
      message.warning("No report loaded");
      return;
    }

    try {
      await invoke.projectReportItemForm.openAsync(
        {
          mode: "update",
          project_id: projectId,
          report: { id: projectReportId, project_id: projectId ?? "", title: content?.title ?? "", created_at: "", updated_at: "" },
        },
        {
          title: "Update Project Report",
          footer: null,
          width: 560,
        }
      );
      await loadContent(projectReportId);
    } catch {
      // User canceled the update modal.
    }
  };

  const title = itemContent?.title || content?.title || "Report Writing";
  const activeContent = itemContent?.content ?? content?.content;

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
          {itemId && (
            <Button
              size="small"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
            />
          )}
          <span>{title}</span>
        </Flex>
      }
      extra={
        <Flex gap="small">
          {renderViewButton(view, setView, "analysisDocView", "View")}
          {!itemId && projectReportId && (
            <Button
              size="small"
              icon={<FileMarkdownOutlined />}
              loading={mdDownloading}
              onClick={handleDownloadMarkdown}
            >
              MD
            </Button>
          )}
          {!itemId && projectReportId && (
            <Button
              size="small"
              icon={<FileTextOutlined />}
              loading={htmlPreview.loading}
              onClick={() => loadHtmlPreview(htmlPreview.inlineImages)}
            >
              HTML
            </Button>
          )}
          {!itemId && projectReportId && (
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              loading={pdfExporting}
              onClick={handleExportPdf}
            >
              PDF
            </Button>
          )}
          {!itemId && projectReportId && (
            <Button
              size="small"
              color="cyan"
              variant="solid"
              icon={<EditOutlined />}
              onClick={openUpdateReportModal}
            >
              Edit Report
            </Button>
          )}
          {!itemId && projectReportId && (
            <Button
              size="small"
              color="green"
              variant="solid"
              icon={<SendOutlined />}
              loading={publishingReport}
              onClick={handlePublishReportToDoc}
            >
              Publish to Doc
            </Button>
          )}
          {!itemId && projectReportId && (
            <Button
              size="small"
              color="purple"
              variant="solid"
              icon={<BookOutlined />}
              onClick={handleOpenDoc}
            >
              Open Doc
            </Button>
          )}
          {itemId && (
            <Button
              size="small"
              color="green"
              variant="solid"
              icon={<SendOutlined />}
              loading={publishing}
              onClick={handlePublishToDoc}
            >
              Publish to Doc
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            size="small"
            color="cyan"
            variant="solid"
            onClick={() => loadContent(projectReportId, itemId)}
          />
        </Flex>
      }
    >
      <Spin spinning={loading}>
        {loading ? (
          <Skeleton active />
        ) : itemId ? (
          itemContent ? (
            <ComponentsDetailsRender
              view={view}
              project_id={projectId}
              content={activeContent}
            />
          ) : (
            <Tag color="orange">Report item not found</Tag>
          )
        ) : content ? (
          <ComponentsDetailsRender
            view={view}
            project_id={projectId}
            content={activeContent}
            onSaved={() => loadContent(projectReportId)}
          />
        ) : (
          <Tag color="orange">Report not found</Tag>
        )}
      </Spin>

      <Modal
        open={htmlPreview.open}
        title="Report HTML"
        width={960}
        footer={null}
        onCancel={() => setHtmlPreview((prev) => ({ ...prev, open: false }))}
        styles={{ body: { height: "70vh", padding: 0 } }}
      >
        <Flex align="center" justify="space-between" style={{ padding: "8px 16px" }}>
          <Segmented
            value={htmlPreview.inlineImages ? "inline" : "url"}
            options={[
              { label: "内嵌图片", value: "inline" },
              { label: "原始链接", value: "url" },
            ]}
            onChange={(value) => loadHtmlPreview(value === "inline")}
          />
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={!htmlPreview.content}
            onClick={downloadHtmlPreview}
          >
            下载
          </Button>
        </Flex>
        <Spin spinning={htmlPreview.loading}>
          <iframe
            title="report-html"
            srcDoc={htmlPreview.content}
            sandbox="allow-same-origin"
            style={{ width: "100%", height: "calc(70vh - 49px)", border: "none" }}
          />
        </Spin>
      </Modal>
    </Card>
  );
};

export default ReportWriting;

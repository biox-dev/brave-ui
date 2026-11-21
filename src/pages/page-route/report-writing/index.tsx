import { FC, useEffect, useState } from "react";
import { Button, Card, Descriptions, Empty, Flex, Modal, Segmented, Skeleton, Spin, Tag } from "antd";
import {
	BookOutlined,
	DownloadOutlined,
	EditOutlined,
	FileMarkdownOutlined,
	FilePdfOutlined,
	FileTextOutlined,
	ReloadOutlined,
	SendOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import {
	getPlanDetailApi,
	getProjectReportDetailApi,
	getProjectReportFileApi,
	getProjectReportHtmlApi,
	publishProjectReportToDocApi,
	type AgentPlan,
	type ProjectReport,
} from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { printHtmlDocument } from "@/utils/print-html";
import { getPathname } from "@/utils/utils";
import { resolveAnalysisAssetHTML } from "@/utils/analysis-url";

// sanitizeFileName 移除文件名中的非法字符，空标题时回退到默认名。
const sanitizeFileName = (name: string, fallback: string) => {
	const cleaned = (name || "").replace(/[\\/:*?"<>|]/g, "_").trim();
	return cleaned || fallback;
};

// ReportWriting 是报告主区域页面：展示报告正文（output.md），并提供其依据计划（plan）的只读视图。
// 报告只有一份正文，结构（章节）由 agent 计划描述，因此这里不再有「条目」概念。
const ReportWriting: FC = () => {
	const message = useGlobalMessage();
	const { project, baseURL } = useSelector((state: any) => state.user);
	const projectId = typeof project === "string" ? project : project?.project_id;

	const { "project-report-id": projectReportId } = useParams<{ "project-report-id": string }>();

	const [view, setView] = useState<any>("analysisDocView");
	const [loading, setLoading] = useState(false);
	const [report, setReport] = useState<ProjectReport>();
	const [content, setContent] = useState("");
	// 报告绑定的计划（只读展示）：节点只带 source + source_id，供人或 agent 追溯素材来源。
	const [plan, setPlan] = useState<AgentPlan>();
	const [publishingReport, setPublishingReport] = useState(false);
	const [htmlPreview, setHtmlPreview] = useState<{
		open: boolean;
		loading: boolean;
		inlineImages: boolean;
		content: string;
	}>({ open: false, loading: false, inlineImages: true, content: "" });
	const [pdfExporting, setPdfExporting] = useState(false);
	const [mdDownloading, setMdDownloading] = useState(false);

	const load = async (reportId?: string) => {
		if (!reportId) {
			setReport(undefined);
			setContent("");
			setPlan(undefined);
			return;
		}
		setLoading(true);
		try {
			const [detailResp, fileResp] = await Promise.all([
				getProjectReportDetailApi(reportId),
				getProjectReportFileApi(reportId),
			]);
			setReport(detailResp.data);
			setContent(fileResp.data?.content ?? "");
			// 计划只有绑定时才拉取；拉取失败不影响正文展示。
			const planId = detailResp.data?.plan_id;
			if (planId) {
				try {
					setPlan((await getPlanDetailApi(planId)).data);
				} catch {
					setPlan(undefined);
				}
			} else {
				setPlan(undefined);
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load(projectReportId);
	}, [projectReportId]);

	const handlePublishReportToDoc = async () => {
		if (!projectReportId) {
			message.warning("No report loaded");
			return;
		}
		setPublishingReport(true);
		try {
			await publishProjectReportToDocApi(projectReportId);
			message.success("Report published to project doc");
		} finally {
			setPublishingReport(false);
		}
	};

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
		link.download = `${report?.title || "report"}.html`;
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
			const resp = await getProjectReportHtmlApi(projectReportId, true);
			printHtmlDocument(resp.data);
		} finally {
			setPdfExporting(false);
		}
	};

	const handleDownloadMarkdown = async () => {
		if (!content) {
			message.warning("Report is empty");
			return;
		}
		setMdDownloading(true);
		try {
			const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${sanitizeFileName(report?.title ?? "report", "report")}.md`;
			link.click();
			URL.revokeObjectURL(url);
		} finally {
			setMdDownloading(false);
		}
	};

	const openUpdateReportModal = async () => {
		if (!projectReportId || !report) {
			message.warning("No report loaded");
			return;
		}
		try {
			await invoke.projectReportItemForm.openAsync(
				{ mode: "update", report: { ...report, project_id: projectId ?? report.project_id } },
				{ title: "Update Project Report", footer: null, width: 560 }
			);
			await load(projectReportId);
		} catch {
			// User canceled the update modal.
		}
	};

	return (
		<Card
			style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", boxShadow: "none" }}
			styles={{ body: { flex: 1, display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" } }}
			variant="borderless"
			size="small"
			title={<span>{report?.title || "Report Writing"}</span>}
			extra={
				<Flex gap="small">
					{renderViewButton(view, setView, "analysisDocView", "View")}
					<Button size="small" icon={<FileMarkdownOutlined />} loading={mdDownloading} onClick={handleDownloadMarkdown}>
						MD
					</Button>
					<Button size="small" icon={<FileTextOutlined />} loading={htmlPreview.loading} onClick={() => loadHtmlPreview(htmlPreview.inlineImages)}>
						HTML
					</Button>
					<Button size="small" icon={<FilePdfOutlined />} loading={pdfExporting} onClick={handleExportPdf}>
						PDF
					</Button>
					<Button size="small" color="cyan" variant="solid" icon={<EditOutlined />} onClick={openUpdateReportModal}>
						Edit Report
					</Button>
					<Button size="small" color="green" variant="solid" icon={<SendOutlined />} loading={publishingReport} onClick={handlePublishReportToDoc}>
						Publish to Doc
					</Button>
					<Button size="small" color="purple" variant="solid" icon={<BookOutlined />} onClick={handleOpenDoc}>
						Open Doc
					</Button>
					<Button icon={<ReloadOutlined />} size="small" color="cyan" variant="solid" onClick={() => void load(projectReportId)} />
				</Flex>
			}
		>
			<Spin spinning={loading}>
				{loading ? (
					<Skeleton active />
				) : !report ? (
					<Tag color="orange">Report not found</Tag>
				) : (
					<Flex vertical gap="middle">
						{plan ? (
							<Descriptions size="small" column={1} bordered title="Source Plan">
								<Descriptions.Item label="Plan">{plan.title || plan.id}</Descriptions.Item>
								<Descriptions.Item label="Goal">{plan.goal || "-"}</Descriptions.Item>
								<Descriptions.Item label="Items">
									<Flex vertical gap={4}>
										{(plan.items ?? []).map((item) => (
											<span key={item.id}>
												<Tag>{item.source}</Tag>
												{item.title}
												{item.source_id ? <span style={{ opacity: 0.65 }}> · {item.source_id}</span> : null}
											</span>
										))}
										{(plan.items ?? []).length === 0 ? (
											<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No item" />
										) : null}
									</Flex>
								</Descriptions.Item>
							</Descriptions>
						) : (
							<Tag color="default">Report is not bound to a plan</Tag>
						)}
						<ComponentsDetailsRender
							view={view}
							project_id={projectId}
							content={content}
							onSaved={() => load(projectReportId)}
						/>
					</Flex>
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
					<Button size="small" icon={<DownloadOutlined />} disabled={!htmlPreview.content} onClick={downloadHtmlPreview}>
						下载
					</Button>
				</Flex>
				<Spin spinning={htmlPreview.loading}>
					{/* 后端导出的 HTML 里图片路径以数据目录为根（无 /data-analysis 前缀，
					    srcDoc 会按站点绝对路径解析），预览时统一补上前缀。 */}
					<iframe
						title="report-html"
						srcDoc={resolveAnalysisAssetHTML(htmlPreview.content, baseURL)}
						sandbox="allow-same-origin"
						style={{ width: "100%", height: "calc(70vh - 49px)", border: "none" }}
					/>
				</Spin>
			</Modal>
		</Card>
	);
};

export default ReportWriting;

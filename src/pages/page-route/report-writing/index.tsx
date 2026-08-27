import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Skeleton, Spin, Tag } from "antd";
import { ArrowLeftOutlined, EditOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import { getProjectReportDetailApi, publishProjectReportToDocApi, type ProjectReportDetailItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useStoreRender } from "@/context/render/RenderProvider";
import { setLLMEnv } from "@/utils/llm-env";

const ReportWriting: FC<any> = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;
  // const { setLLMEnv } = useStoreRender()

  const { "project-report-id": projectReportId } = useParams<{
    "project-report-id": string;
  }>();


  const [view, setView] = useState<any>("analysisDocView");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeReport, setActiveReport] = useState<ProjectReportDetailItem>();

  const loadReportDetail = async (id?: string) => {
    if (!id) {
      setActiveReport(undefined);
      return;
    }

    setLoading(true);
    try {
      const resp = await getProjectReportDetailApi(id);
      setActiveReport(resp.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLLMEnv(projectReportId, "projectReport");
    loadReportDetail(projectReportId);
  }, [projectReportId]);

  const handlePublishToDoc = async () => {
    if (!activeReport) {
      message.warning("No report loaded");
      return;
    }

    setPublishing(true);
    try {
      await publishProjectReportToDocApi(activeReport.id);
      message.success("Report published to project doc");
    } catch {
      // Error is surfaced globally by the http client interceptor.
    } finally {
      setPublishing(false);
    }
  };

  const openUpdateReportModal = async () => {
    if (!activeReport) {
      message.warning("No report loaded");
      return;
    }

    try {
      await invoke.projectReportItemForm.openAsync(
        {
          mode: "update",
          project_id: projectId,
          report: activeReport,
        },
        {
          title: "Update Project Report Item",
          footer: null,
          width: 560,
        }
      );
      await loadReportDetail(activeReport.id);
    } catch {
      // User canceled the update modal.
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
          {/* <Button
            size="small"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/")}
          /> */}
          <span>{activeReport?.title || "Report Writing"}</span> ({activeReport?.id})
        </Flex>
      }
      extra={
        <Flex gap="small">
          {renderViewButton(view, setView, "analysisDocView", "View")}
          {renderViewButton(view, setView, "analysisDocEditor", "Edit")}
          {activeReport && (
            <Button
              size="small"
              color="cyan"
              variant="solid"
              icon={<EditOutlined />}
              onClick={openUpdateReportModal}
            >
              Edit Item
            </Button>
          )}
          {activeReport && activeReport.content_source === "file" && (
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
            onClick={() => loadReportDetail(projectReportId)}
          />
        </Flex>
      }
    >
      <Spin spinning={loading}>
        {loading ? (
          <Skeleton active />
        ) : activeReport ? (
          <ComponentsDetailsRender
            view={view}
            project_id={projectId}
            report={activeReport}
            content={activeReport?.content}
            onSaved={() => loadReportDetail(activeReport?.id)}
          />
        ) : (
          <Tag color="orange">Report not found</Tag>
        )}
      </Spin>
    </Card>
  );
};

export default ReportWriting;

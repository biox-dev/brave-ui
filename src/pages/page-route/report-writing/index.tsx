import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Skeleton, Spin, Tag } from "antd";
import { ArrowLeftOutlined, EditOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import {
  getProjectReportContentApi,
  getProjectReportItemContentApi,
  publishProjectReportItemToDocApi,
  type ProjectReportContentResponse,
  type ProjectReportItemContentResponse,
} from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { setLLMEnv } from "@/utils/llm-env";

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
  // 报告容器视图：报告标题 + 所有条目拼接后的正文。
  const [content, setContent] = useState<ProjectReportContentResponse>();
  // 单个条目视图：入参为 ProjectReportItem ID，显示该条目的 markdown。
  const [itemContent, setItemContent] = useState<ProjectReportItemContentResponse>();

  const loadContent = async (reportId?: string, currentItemId?: string) => {
    if (!reportId) {
      setContent(undefined);
      setItemContent(undefined);
      return;
    }

    setLoading(true);
    try {
      if (currentItemId) {
        // Switching to an item view: drop stale report container content so the
        // title/body are always driven by the active route branch.
        setContent(undefined);
        const resp = await getProjectReportItemContentApi(currentItemId);
        setItemContent(resp.data);
        return;
      }
      // Switching back to the report view: drop the previously opened item,
      // otherwise the stale itemContent keeps overriding title/content.
      setItemContent(undefined);
      const resp = await getProjectReportContentApi(reportId);
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
              onClick={() => navigate(`/report-writing/${projectReportId}`)}
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
              color="cyan"
              variant="solid"
              icon={<EditOutlined />}
              onClick={openUpdateReportModal}
            >
              Edit Report
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
    </Card>
  );
};

export default ReportWriting;

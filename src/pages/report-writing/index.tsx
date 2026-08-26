import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Skeleton, Spin, Tag } from "antd";
import { ArrowLeftOutlined, EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import { getProjectReportDetailApi, type ProjectReportDetailItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const ReportWriting: FC<any> = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const { "project-report-id": projectReportId } = useParams<{
    "project-report-id": string;
  }>();

  const [view, setView] = useState<any>("analysisDocView");
  const [loading, setLoading] = useState(false);
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
    loadReportDetail(projectReportId);
  }, [projectReportId]);

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
          <span>{activeReport?.title || "Report Writing"}</span>
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

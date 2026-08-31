import { FC, useEffect, useState } from "react";
import { Button, Card, Flex, Skeleton, Spin, Tag } from "antd";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import { getLiteratureDetailApi, type ProjectLiteratureDetailItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const LiteratureWriting: FC<any> = () => {
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const { "literature-id": literatureId } = useParams<{
    "literature-id": string;
  }>();

  const [view, setView] = useState<any>("analysisDocView");
  const [loading, setLoading] = useState(false);
  const [activeLiterature, setActiveLiterature] = useState<ProjectLiteratureDetailItem>();

  const loadDetail = async (id?: string) => {
    if (!id) {
      setActiveLiterature(undefined);
      return;
    }

    setLoading(true);
    try {
      const resp = await getLiteratureDetailApi(id);
      setActiveLiterature(resp.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail(literatureId);
  }, [literatureId]);

  const openUpdateModal = async () => {
    if (!activeLiterature) {
      message.warning("No literature loaded");
      return;
    }

    try {
      await invoke.projectLiteratureItemForm.openAsync(
        { mode: "update", literature: activeLiterature },
        {
          title: "Update Literature",
          footer: null,
          width: 560,
        }
      );
      await loadDetail(activeLiterature.id);
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
          <span>{activeLiterature?.title || "Literature"}</span> ({activeLiterature?.id})
        </Flex>
      }
      extra={
        <Flex gap="small">
          {renderViewButton(view, setView, "analysisDocView", "View")}
          {renderViewButton(view, setView, "projectLiteratureEditor", "Edit Full Text")}
          {activeLiterature && (
            <Button
              size="small"
              color="cyan"
              variant="solid"
              icon={<EditOutlined />}
              onClick={openUpdateModal}
            >
              Edit Item
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            size="small"
            color="cyan"
            variant="solid"
            onClick={() => loadDetail(literatureId)}
          />
        </Flex>
      }
    >
      <Spin spinning={loading}>
        {loading ? (
          <Skeleton active />
        ) : activeLiterature ? (
          <ComponentsDetailsRender
            view={view}
            project_id={projectId}
            literature={activeLiterature}
            content={activeLiterature?.content}
            onSaved={() => loadDetail(activeLiterature?.id)}
          />
        ) : (
          <Tag color="orange">Literature not found</Tag>
        )}
      </Spin>
    </Card>
  );
};

export default LiteratureWriting;

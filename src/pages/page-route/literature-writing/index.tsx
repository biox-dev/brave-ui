import { FC, useEffect, useState } from "react";
import { Button, Flex, Popconfirm, Skeleton, Spin, Tag } from "antd";
import { EditOutlined, LinkOutlined, ReloadOutlined } from "@ant-design/icons";
import { useParams } from "react-router";
import { useSelector } from "react-redux";
import ComponentsDetailsRender from "@/core/ui-renderer/ViewResolver";
import { renderViewButton } from "@/utils/render-view-btn";
import { invoke } from "@/core/ui-system/invokeV2";
import {
  getLiteratureDetailApi,
  unbindLiteratureApi,
  type ProjectLiteratureDetailItem,
} from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import PanelLayout from "@/components/common/panel-layout";

/**
 * 文献详情页（/literature-writing/:literature-id），也是右侧工作区的标签视图
 * （`literatureWritingDetail`）：作为标签渲染时没有路由参数，id 由 `literatureId` prop 传入。
 */
type LiteratureWritingProps = { literatureId?: string }

const LiteratureWriting: FC<LiteratureWritingProps> = ({ literatureId: literatureIdProp }) => {
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const { "literature-id": literatureIdParam } = useParams<{
    "literature-id": string;
  }>();
  const literatureId = literatureIdProp ?? literatureIdParam;

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

  // 从当前项目移除绑定（文献本身不删除）。原先在左侧列表的动作列，
  // 按「列表只保留查看 / 删除」的约定搬到详情页。
  const handleUnbind = async () => {
    if (!activeLiterature) {
      return;
    }
    await unbindLiteratureApi({ literature_id: activeLiterature.id });
    message.success("Removed from project successfully");
  };

  return (
    <PanelLayout
      className="literature-writing-page page-flat"
      bodyStyle={{ padding: 12 }}
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
          {activeLiterature && (
            <Popconfirm
              title="Remove this literature from the active project?"
              onConfirm={handleUnbind}
            >
              <Button size="small" icon={<LinkOutlined />}>
                Unbind
              </Button>
            </Popconfirm>
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
    </PanelLayout>
  );
};

export default LiteratureWriting;

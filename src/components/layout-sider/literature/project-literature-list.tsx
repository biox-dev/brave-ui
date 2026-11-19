import {
  deleteLiteratureApi,
  getLiteratureDetailApi,
  pageLiteratureApi,
  unbindLiteratureApi,
  type ProjectLiteratureItem,
} from "@/api/project";
import { LazyListFooter, LazyListSearch, LazyListSentinel, useLazyList } from "@/components/common/lazy-list";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import {
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";
import SiderPanelLayout from "../common/sider-panel-layout";

export interface ProjectLiteratureListProps {
  /** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
}

const ProjectLiteratureList: FC<ProjectLiteratureListProps> = ({ collapsed = false, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/literature-writing\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  const {
    items: data,
    loading,
    loadingMore,
    hasMore,
    total,
    keyword,
    setKeyword,
    reload,
    sentinelRef,
  } = useLazyList<ProjectLiteratureItem>({
    fetcher: (payload) => pageLiteratureApi(payload).then((response) => response.data),
    pageSize: 10,
    scopeKey: projectId,
    // 纵向堆叠折叠时只保留标题栏：停止列表请求，展开后自动恢复。
    enabled: !collapsed,
  });
  const refetch = reload;
  const isLoading = loading;
  const isFetching = loading || loadingMore;

  const openCreate = async () => {
    if (!projectId) {
      message.warning("Please select a project first");
      return;
    }

    try {
      const created = await invoke.projectLiteratureItemForm.openAsync(
        { mode: "create" },
        {
          title: "Create Literature",
          footer: null,
          width: 560,
        }
      );
      await refetch();
      if (created?.id) {
        navigate(`/literature-writing/${created.id}`);
      }
    } catch {
      // User canceled the create modal.
    }
  };

  const openUpdate = async (literature: ProjectLiteratureItem) => {
    try {
      const detailResp = await getLiteratureDetailApi(literature.id);
      await invoke.projectLiteratureItemForm.openAsync(
        { mode: "update", literature: detailResp.data },
        {
          title: "Update Literature",
          footer: null,
          width: 560,
        }
      );
      await refetch();
    } catch {
      // User canceled the update modal.
    }
  };

  const openBind = async () => {
    try {
      await invoke.projectLiteratureBindForm.openAsync(
        undefined,
        {
          title: "Bind Literature to Active Project",
          footer: null,
          width: 560,
        }
      );
      await refetch();
    } catch {
      // User canceled the bind modal.
    }
  };

  const handleDelete = async (literature: ProjectLiteratureItem) => {
    await deleteLiteratureApi({ id: literature.id });
    message.success("Deleted successfully");
    await refetch();
  };

  const handleUnbind = async (literature: ProjectLiteratureItem) => {
    await unbindLiteratureApi({ literature_id: literature.id });
    message.success("Removed from project successfully");
    await refetch();
  };

  const columns = useMemo<ColumnsType<ProjectLiteratureItem>>(
    () => [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        render: (title: string, record) => (
          <div className="project-report-item">
            <BookOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <span className="project-report-item-title">
                {title || `Untitled-${record.id}`}
              </span>
              {record.updated_at && (
                <span className="project-report-item-meta">
                  {formatRelativeTime(record.updated_at, locale)}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 112,
        align: "right",
      render: (_, record) => (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openUpdate(record)}
          />
          <Popconfirm
            title="Remove this literature from the active project?"
            onConfirm={() => handleUnbind(record)}
          >
            <Button type="text" size="small" icon={<LinkOutlined />} />
          </Popconfirm>
          <Popconfirm
            title="Delete this literature?"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ],
    [locale]
  );

  return (
    <SiderPanelLayout
      title="Literature"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      actions={
        <>
          <LazyListSearch
            value={keyword}
            onChange={setKeyword}
            placeholder="Search literature"
            className="project-report-panel-search"
          />
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={openCreate} />
          <Button type="text" size="small" icon={<LinkOutlined />} onClick={openBind} />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
        </>
      }
    >
      {data.length === 0 && !isLoading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No literature bound to the active project"
        />
      ) : (
        <Table<ProjectLiteratureItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={data}
          loading={isLoading || isFetching}
          pagination={false}
          showHeader={false}
          rowClassName={(record) =>
            record.id === selectedId ? "project-report-row-selected" : ""
          }
          onRow={(record) => ({
            onClick: () => navigate(`/literature-writing/${record.id}`),
          })}
        />
      )}
      <LazyListSentinel sentinelRef={sentinelRef} />
      <LazyListFooter
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasItems={data.length > 0}
        total={total}
        labels={{ loading: "Loading more…", noMore: "No more literature", totalPrefix: "total " }}
      />
    </SiderPanelLayout>
  );
};

export default ProjectLiteratureList;

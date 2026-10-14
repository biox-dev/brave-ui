import {
  deleteProjectReportApi,
  getProjectReportDetailApi,
  publishProjectReportToDocApi,
  type ProjectReport,
} from "@/api/project";
import ProjectReportItemsPanel from "./project-report-items-panel";
import { useProjectReportPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Empty, Pagination, Popconfirm, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";

const ProjectReportList: FC<any> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { locale } = useI18n();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [publishingReportId, setPublishingReportId] = useState<string>();

  // Derive the selected report id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    // 同时匹配 /report/:id 与 /report-file/:id，两种路由下对应行都保持高亮。
    const match = location.pathname.match(/\/(?:report-file|report)\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  const {
    data,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    isFetching,
    refetch,
  } = useProjectReportPageQuery({}, { initialPageSize: 10, scopeKey: projectId });

  const openCreate = async () => {
    if (!projectId) {
      message.warning("Please select a project first");
      return;
    }

    try {
      const created = await invoke.projectReportItemForm.openAsync(
        {
          mode: "create",
          project_id: projectId,
        },
        {
          title: "Create Project Report",
          footer: null,
          width: 560,
        }
      );
      await refetch();
      if (created?.id) {
        navigate(`/report/${created.id}`);
      }
    } catch {
      // User canceled the create modal.
    }
  };

  const openUpdate = async (report: ProjectReport) => {
    try {
      const detailResp = await getProjectReportDetailApi(report.id);
      await invoke.projectReportItemForm.openAsync(
        {
          mode: "update",
          project_id: projectId,
          report: detailResp.data,
        },
        {
          title: "Update Project Report",
          footer: null,
          width: 560,
        }
      );
      await refetch();
    } catch {
      // User canceled the update modal.
    }
  };

  const handleDelete = async (report: ProjectReport) => {
    await deleteProjectReportApi({ id: report.id });
    message.success("Deleted successfully");
    await refetch();
  };

  // handlePublishReport 一次发布报告下所有条目。
  const handlePublishReport = async (report: ProjectReport) => {
    setPublishingReportId(report.id);
    try {
      await publishProjectReportToDocApi(report.id);
      message.success("Report published to project doc");
    } finally {
      setPublishingReportId(undefined);
    }
  };

  const columns = useMemo<ColumnsType<ProjectReport>>(
    () => [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        // 与 ScriptPageList 的 Title 列一致：单元格内省略号截断，悬浮显示全称。
        ellipsis: { showTitle: false },
        render: (title: string, record) => {
          const name = title || `Untitled-${record.id}`;

          return (
            <div className="project-report-item">
              <FileTextOutlined className="project-report-item-icon" />
              <div className="project-report-item-text">
                <Tooltip placement="topLeft" title={name}>
                  <span className="project-report-item-title">{name}</span>
                </Tooltip>
                {record.updated_at && (
                  <span className="project-report-item-meta">
                    {formatRelativeTime(record.updated_at, locale)}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        title: "Actions",
        key: "actions",
        width: 148,
        align: "right",
      render: (_, record) => (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 原先由 onRow 点击触发的跳转，改为列表内显式按钮。 */}
          <Tooltip title="Open report">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/report/${record.id}`)}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<SendOutlined />}
            title="Publish to doc"
            loading={publishingReportId === record.id}
            onClick={() => handlePublishReport(record)}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openUpdate(record)}
          />
          <Popconfirm
            title="Delete selected report item?"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ],
    [locale, publishingReportId]
  );

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Project Reports</span>
        <div className="project-report-panel-actions">
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={openCreate} />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => refetch()} />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No project report item"
          />
        ) : (
          <Table<ProjectReport>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            // 点击行跳转到报告文件页面；展开图标单独阻止冒泡以免误触发跳转。
            onRow={(record) => ({
              style: { cursor: "pointer" },
              onClick: () => navigate(`/report-file/${record.id}`),
            })}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
              expandIcon: ({ expanded, onExpand, record }) => (
                <span
                  className={
                    expanded
                      ? "ant-table-row-expand-icon ant-table-row-expand-icon-expanded"
                      : "ant-table-row-expand-icon ant-table-row-expand-icon-collapsed"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(record, e);
                  }}
                />
              ),
              expandedRowRender: (record) => (
                <ProjectReportItemsPanel
                  reportId={record.id}
                  onOpenItem={(item) => navigate(`/report-item/${item.id}`)}
                  onChanged={refetch}
                />
              ),
            }}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `${t} reports`}
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>
    </div>
  );
};

export default ProjectReportList;

import { deleteProjectReportApi, getProjectReportDetailApi, listProjectReportApi, type ProjectReportItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";

const ProjectReportList: FC<any> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const [loading, setLoading] = useState(false);
  const [reportList, setReportList] = useState<ProjectReportItem[]>([]);

  // Derive the selected report id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/report-writing\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const resp = await listProjectReportApi();
      const rows = Array.isArray(resp.data) ? resp.data : [];
      setReportList(rows);
    } finally {
      setLoading(false);
    }
  };

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
          title: "Create Project Report Item",
          footer: null,
          width: 560,
        }
      );
      await loadReports();
      if (created?.id) {
        navigate(`/report-writing/${created.id}`);
      }
    } catch {
      // User canceled the create modal.
    }
  };

  const openUpdate = async (report: ProjectReportItem) => {
    try {
      const detailResp = await getProjectReportDetailApi(report.id);
      await invoke.projectReportItemForm.openAsync(
        {
          mode: "update",
          project_id: projectId,
          report: detailResp.data,
        },
        {
          title: "Update Project Report Item",
          footer: null,
          width: 560,
        }
      );
      await loadReports();
    } catch {
      // User canceled the update modal.
    }
  };

  const handleDelete = async (report: ProjectReportItem) => {
    await deleteProjectReportApi({ id: report.id });
    message.success("Deleted successfully");
    await loadReports();
  };

  const columns: ColumnsType<ProjectReportItem> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (title: string, record) => (
        <div className="project-report-item">
          <FileTextOutlined className="project-report-item-icon" />
          <div className="project-report-item-text">
            <span className="project-report-item-title">
              {title || `Untitled-${record.id}`}
            </span>
            {record.updated_at && (
              <span className="project-report-item-meta">{record.updated_at}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 56,
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
            title="Delete selected report item?"
            onConfirm={() => handleDelete(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Project Reports</span>
        <div className="project-report-panel-actions">
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={openCreate} />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={loadReports} />
        </div>
      </div>

      <div className="project-report-panel-body">
        {reportList.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No project report item"
          />
        ) : (
          <Table<ProjectReportItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={reportList}
            loading={loading}
            pagination={false}
            showHeader={false}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => navigate(`/report-writing/${record.id}`),
            })}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectReportList;

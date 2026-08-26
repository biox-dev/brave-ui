import { deleteProjectReportApi, getProjectReportDetailApi, listProjectReportApi, type ProjectReportItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Popconfirm, Space, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { invoke } from "@/core/ui-system/invokeV2";

const ProjectReportList: FC<any> = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { project } = useSelector((state: any) => state.user);
  const projectId = typeof project === "string" ? project : project?.project_id;

  const [loading, setLoading] = useState(false);
  const [reportList, setReportList] = useState<ProjectReportItem[]>([]);

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
      render: (title: string, record) => title || `Untitled-${record.id}`,
    },
    {
      title: "Updated At",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 150,
    },
    {
      title: "Actions",
      key: "actions",
      width: 96,
      render: (_, record) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Space size={0}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openUpdate(record)}
            />
            <Popconfirm
              title="Delete selected report item?"
              onConfirm={() => handleDelete(record)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        </span>
      ),
    },
  ];

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <Flex vertical gap="small" style={{ height: "100%" }}>
      <Flex justify="space-between" align="center">
        <Typography.Text strong>Project Reports</Typography.Text>
        <Space size={4}>
          <Button size="small" icon={<PlusOutlined />} onClick={openCreate}>
            Add
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadReports} />
        </Space>
      </Flex>

      {reportList.length === 0 && !loading ? (
        <Empty description="No project report item" />
      ) : (
        <Table<ProjectReportItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={reportList}
          loading={loading}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/report-writing/${record.id}`),
            style: { cursor: "pointer" },
          })}
        />
      )}
    </Flex>
  );
};

export default ProjectReportList;

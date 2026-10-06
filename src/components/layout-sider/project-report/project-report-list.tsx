import {
  addProjectReportItemApi,
  deleteProjectReportApi,
  deleteProjectReportItemApi,
  getProjectReportDetailApi,
  listProjectReportItemApi,
  publishProjectReportItemToDocApi,
  publishProjectReportToDocApi,
  type ProjectReport,
  type ProjectReportItem,
  type ProjectReportItemOwnerType,
} from "@/api/project";
import { pageAnalysisByProjectApi, pageAnalysisNodeByProjectApi } from "@/api/analysis";
import { pageAISummaryByProjectApi } from "@/api/ai-summary";
import { useProjectReportPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined, SendOutlined } from "@ant-design/icons";
import { Button, Dropdown, Empty, Modal, Pagination, Popconfirm, Select, Spin, Table, Tag } from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSelector } from "react-redux";
import { useQuery } from "react-query";
import { invoke } from "@/core/ui-system/invokeV2";

const OWNER_TYPE_COLORS: Record<ProjectReportItemOwnerType, string> = {
  analysis: "blue",
  analysis_node: "geekblue",
  ai_summary: "purple",
};

const OWNER_TYPE_OPTIONS: { key: ProjectReportItemOwnerType; label: string }[] = [
  { key: "analysis", label: "Analysis" },
  { key: "analysis_node", label: "Analysis Node" },
  { key: "ai_summary", label: "AI Summary" },
];

interface OwnerOption {
  label: string;
  value: string;
}

interface AddReportItemModalProps {
  reportId: string;
  ownerType?: ProjectReportItemOwnerType;
  sortOrder: number;
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

// AddReportItemModal 为 analysis / analysis_node / ai_summary 类型条目选择 OwnerID。
const AddReportItemModal: FC<AddReportItemModalProps> = ({
  reportId,
  ownerType,
  sortOrder,
  open,
  onClose,
  onAdded,
}) => {
  const message = useGlobalMessage();
  const [options, setOptions] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [ownerId, setOwnerId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !ownerType) {
      setOptions([]);
      setOwnerId(undefined);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let opts: OwnerOption[] = [];
        if (ownerType === "analysis") {
          const resp = await pageAnalysisByProjectApi({ page: 1, page_size: 200 });
          opts = (resp.data?.data || []).map((a) => ({ label: a.analysis_name || a.id, value: a.id }));
        } else if (ownerType === "analysis_node") {
          const resp = await pageAnalysisNodeByProjectApi({ page: 1, page_size: 200 });
          opts = (resp.data?.data || []).map((n) => ({ label: n.node_name || n.id, value: n.id }));
        } else if (ownerType === "ai_summary") {
          const resp = await pageAISummaryByProjectApi({ page: 1, page_size: 200 });
          opts = (resp.data?.data || []).map((s) => ({ label: s.title || s.id, value: s.id }));
        }
        if (!cancelled) {
          setOptions(opts);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, ownerType]);

  const handleOk = async () => {
    if (!ownerType || !ownerId) {
      message.warning("Please select an owner");
      return;
    }

    setSubmitting(true);
    try {
      await addProjectReportItemApi({
        project_report_id: reportId,
        owner_type: ownerType,
        owner_id: ownerId,
        sort_order: sortOrder,
      });
      message.success("Added successfully");
      onAdded?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Add ${ownerType ?? ""} item`}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      destroyOnClose
    >
      <Select
        style={{ width: "100%" }}
        loading={loading}
        value={ownerId}
        onChange={setOwnerId}
        options={options}
        placeholder="Select owner"
        showSearch
        optionFilterProp="label"
      />
    </Modal>
  );
};

interface ProjectReportItemsPanelProps {
  reportId: string;
  onOpenItem: (item: ProjectReportItem) => void;
  onChanged?: () => void;
}

// ProjectReportItemsPanel 在展开报告时显示其下所有 ProjectReportItem。
const ProjectReportItemsPanel: FC<ProjectReportItemsPanelProps> = ({ reportId, onOpenItem, onChanged }) => {
  const message = useGlobalMessage();
  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery(
    ["project-report-items", reportId],
    async () => (await listProjectReportItemApi(reportId)).data,
    { enabled: !!reportId }
  );
  const [addOwnerType, setAddOwnerType] = useState<ProjectReportItemOwnerType>();
  const [modalOpen, setModalOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<string>();

  const handleAddMenuClick: MenuProps["onClick"] = ({ key }) => {
    setAddOwnerType(key as ProjectReportItemOwnerType);
    setModalOpen(true);
  };

  const handleDeleteItem = async (item: ProjectReportItem) => {
    await deleteProjectReportItemApi({ id: item.id });
    message.success("Deleted successfully");
    await refetch();
    onChanged?.();
  };

  // handlePublishItem 按条目 ID 发布（后端会根据 OwnerType 解析 OwnerID）。
  const handlePublishItem = async (item: ProjectReportItem) => {
    setPublishingId(item.id);
    try {
      await publishProjectReportItemToDocApi(item.id);
      message.success("Published to project doc");
    } finally {
      setPublishingId(undefined);
    }
  };

  return (
    <div style={{ padding: "4px 8px 8px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--sharp-text-secondary, #888)" }}>Report Items</span>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: OWNER_TYPE_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
            onClick: handleAddMenuClick,
          }}
        >
          <Button type="text" size="small" icon={<PlusOutlined />} />
        </Dropdown>
      </div>

      {isLoading ? (
        <Spin size="small" />
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No report item" />
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenItem(item)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", cursor: "pointer" }}
          >
            <Tag color={OWNER_TYPE_COLORS[item.owner_type] || "default"} style={{ marginInlineEnd: 0 }}>
              {item.owner_type}
            </Tag>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title || item.id}
            </span>
            {item.owner_id && (
              <span style={{ fontSize: 12, color: "var(--sharp-text-secondary, #888)" }}>#{item.owner_id}</span>
            )}
            <Button
              type="text"
              size="small"
              icon={<SendOutlined />}
              loading={publishingId === item.id}
              title="Publish to doc"
              onClick={(e) => {
                e.stopPropagation();
                handlePublishItem(item);
              }}
            />
            <Popconfirm
              title="Delete selected report item?"
              onConfirm={() => handleDeleteItem(item)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </div>
        ))
      )}

      <AddReportItemModal
        reportId={reportId}
        ownerType={addOwnerType}
        sortOrder={items.length}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={async () => {
          await refetch();
          onChanged?.();
        }}
      />
    </div>
  );
};

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
    const match = location.pathname.match(/\/report\/([^/]+)/);
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
        render: (title: string, record) => (
          <div className="project-report-item">
            <FileTextOutlined className="project-report-item-icon" />
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
        width: 88,
        align: "right",
      render: (_, record) => (
        <span
          className="project-report-item-actions"
          onClick={(e) => e.stopPropagation()}
        >
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
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
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
            onRow={(record) => ({
              onClick: () => navigate(`/report/${record.id}`),
            })}
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

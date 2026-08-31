import { bindLiteratureApi, type ProjectLiteraturePoolItem } from "@/api/project";
import { useLiteraturePoolPageQuery } from "@/hooks/usePaginationV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { Button, Pagination, Table, Tag, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC } from "react";

interface ProjectLiteratureBindFormProps {
  onOk?: (data?: any) => void;
  onCancel?: () => void;
}

const ProjectLiteratureBindForm: FC<ProjectLiteratureBindFormProps> = ({ onOk, onCancel }) => {
  const message = useGlobalMessage();
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
  } = useLiteraturePoolPageQuery({}, { initialPageSize: 8 });

  const handleBind = async (record: ProjectLiteraturePoolItem) => {
    await bindLiteratureApi({ literature_id: record.id });
    message.success("Bound successfully");
    await refetch();
    onOk?.(record);
  };

  const columns: ColumnsType<ProjectLiteraturePoolItem> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (title: string, record) => (
        <span>{title || `Untitled-${record.id}`}</span>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      align: "right",
      render: (_, record) =>
        record.bound ? (
          <Tag color="green">Bound</Tag>
        ) : (
          <Button
            size="small"
            color="cyan"
            variant="solid"
            onClick={() => handleBind(record)}
          >
            Bind
          </Button>
        ),
    },
  ];

  return (
    <div>
      {data.length === 0 && !isLoading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No literature available"
          style={{ margin: "16px 0" }}
        />
      ) : (
        <Table<ProjectLiteraturePoolItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={data}
          loading={isLoading || isFetching}
          pagination={false}
        />
      )}

      <div style={{ padding: "10px 0 0" }}>
        <Pagination
          size="small"
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          onChange={(nextPage, nextSize) => {
            if (nextSize !== pageSize) {
              setPageSize(nextSize);
            } else {
              setPage(nextPage);
            }
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <Button onClick={() => onCancel?.()}>Close</Button>
      </div>
    </div>
  );
};

export default ProjectLiteratureBindForm;

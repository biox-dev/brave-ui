import { useScriptPageQuery } from "@/hooks/usePaginationV2";
import type { ScriptItem } from "@/api/workflow";
import { invoke } from "@/core/ui-system/invokeV2";
import { CodeOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Pagination, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

const ScriptPageList: FC<any> = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive the selected script id from the current route so the selection
  // survives a full page refresh.
  const selectedId = useMemo(() => {
    const match = location.pathname.match(/\/c\/scripts\/([^/]+)/);
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
  } = useScriptPageQuery(
    {},
    {
      initialPageSize: 20,
    }
  );

  const handleOpen = (script: ScriptItem) => {
    if (!script?.id) {
      return;
    }
    navigate(`/c/scripts/${encodeURIComponent(script.id)}`);
  };

  const columns: ColumnsType<ScriptItem> = [
    {
      title: "Script Name",
      dataIndex: "component_name",
      key: "component_name",
      render: (name: string, record) => (
        <div className="project-report-item">
          <CodeOutlined className="project-report-item-icon" />
          <div className="project-report-item-text">
            <span className="project-report-item-title">
              {name || `Script-${record.id}`}
            </span>
            {record.updated_at && (
              <span className="project-report-item-meta">{record.updated_at}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Script Type",
      dataIndex: "script_type",
      key: "script_type",
      width: 110,
      render: (value: string) =>
        value ? <Tag color="blue">{value}</Tag> : "-",
    },
  ];

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">Scripts</span>
        <div className="project-report-panel-actions">
          <Tooltip title="Install Script">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={async () => {
                await invoke.installComponentsV2.openAsync(
                  {
                    storeType: "script",
                  },
                  {
                    width: "80%",
                    title: `Install script`,
                    footer: null,
                  }
                );
              }}
            />
          </Tooltip>
          <Tooltip title="Create Script">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={async () => {
                await invoke.createOrUpdateComponent.openAsync({});
              }}
            />
          </Tooltip>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          />
        </div>
      </div>

      <div className="project-report-panel-body">
        {data.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No script"
          />
        ) : (
          <Table<ScriptItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={isLoading || isFetching}
            pagination={false}
            showHeader={false}
            rowClassName={(record) =>
              String(record.id) === selectedId ? "project-report-row-selected" : ""
            }
            onRow={(record) => ({
              onClick: () => handleOpen(record),
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
          showTotal={(t) => `${t} scripts`}
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

export default ScriptPageList;

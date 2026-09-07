import { FC, useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Flex, Skeleton, Space, Tag, Typography } from "antd";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";
import { getFileApi } from "@/api/data";
import type { DataFileItem } from "@/api/data";
import UniverView from "@/components/univer/univer-view";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const SPREADSHEET_FORMATS = new Set(["xlsx", "xls", "csv", "tsv"]);

const isSpreadsheetFile = (file?: DataFileItem) => {
  if (!file) {
    return false;
  }

  const format = String(file.format ?? "").toLowerCase();
  if (SPREADSHEET_FORMATS.has(format)) {
    return true;
  }

  const path = String(file.path ?? "").toLowerCase();
  return [".xlsx", ".xls", ".csv", ".tsv"].some((ext) => path.endsWith(ext));
};

const formatBytes = (size?: number) => {
  if (!size) {
    return "-";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const DatasetFileDetail: FC = () => {
  const navigate = useNavigate();
  const message = useGlobalMessage();
  const { id } = useParams<{ id: string }>();

  const [file, setFile] = useState<DataFileItem>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    try {
      const fileResp = await getFileApi(id);
      setFile(fileResp.data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Failed to load file");
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const spreadsheet = isSpreadsheetFile(file);

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 16 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {file?.file_name || `File ${id ?? ""}`}
          </Typography.Title>
          {file?.format ? <Tag color="cyan">{file.format}</Tag> : null}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          Refresh
        </Button>
      </Flex>

      <Skeleton loading={loading}>
        {file && (
          <Card size="small" title="File" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
              <Descriptions.Item label="File ID">{file.file_id || "-"}</Descriptions.Item>
              <Descriptions.Item label="Name">{file.file_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Format">{file.format || "-"}</Descriptions.Item>
              <Descriptions.Item label="Storage">{file.storage || "-"}</Descriptions.Item>
              <Descriptions.Item label="Size">{formatBytes(file.size)}</Descriptions.Item>
              <Descriptions.Item label="MD5">{file.md5 || "-"}</Descriptions.Item>
              <Descriptions.Item label="Path" span={3}>{file.path || "-"}</Descriptions.Item>
              <Descriptions.Item label="Description" span={3}>{file.description || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {!loading && file && spreadsheet ? (
          <Card size="small" title="Spreadsheet">
            <UniverView file_id={file.file_id} />
          </Card>
        ) : !loading && file ? (
          <Alert
            type="warning"
            showIcon
            message="Cannot open this file"
            description={`The format "${file.format || "unknown"}" is not supported for spreadsheet preview.`}
          />
        ) : null}
      </Skeleton>
    </div>
  );
};

export default DatasetFileDetail;

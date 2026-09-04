import { useCallback, useEffect, useState } from "react";
import { Button, Flex, Input, Space, Spin, Tag, Typography, message } from "antd";
import { describeContainerInstanceApi, type RuntimeDescription } from "@/api/container";

export interface ContainerInstanceDescribeDialogProps {
  instanceId?: string;
  // close is injected by UIContainer
  close?: () => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
    if (msg) {
      return msg;
    }
  }
  return fallback;
};

const ContainerInstanceDescribeDialog = ({
  instanceId,
  close,
}: ContainerInstanceDescribeDialogProps) => {
  const [id, setId] = useState(instanceId ?? "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RuntimeDescription>();
  const [messageApi, contextHolder] = message.useMessage();

  const fetchDescribe = useCallback(
    async (targetId: string) => {
      const trimmed = targetId?.trim();
      if (!trimmed) {
        return;
      }
      setLoading(true);
      setData(undefined);
      try {
        const resp = await describeContainerInstanceApi(trimmed);
        setData(resp.data);
      } catch (error) {
        messageApi.error(getErrorMessage(error, "Failed to describe container instance"));
      } finally {
        setLoading(false);
      }
    },
    [messageApi]
  );

  useEffect(() => {
    if (instanceId?.trim()) {
      fetchDescribe(instanceId);
    }
  }, [instanceId, fetchDescribe]);

  const handleDescribe = () => {
    fetchDescribe(id);
  };

  return (
    <div>
      {contextHolder}
      {/* <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
        <Input
          placeholder="Container instance ID"
          value={id}
          onChange={(e) => setId(e.target.value)}
          onPressEnter={handleDescribe}
        />
        <Button type="primary" loading={loading} onClick={handleDescribe}>
          Describe
        </Button>
      </Space.Compact> */}

      <Spin spinning={loading}>
        {data ? (
          <>
            <Flex gap={8} wrap="wrap" style={{ marginBottom: 8 }}>
              <Tag color="blue">Kind: {data.kind || "-"}</Tag>
              <Tag color="green">Name: {data.name || "-"}</Tag>
              <Tag>Format: {data.format || "-"}</Tag>
            </Flex>
            <pre
              style={{
                maxHeight: 480,
                overflow: "auto",
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.5,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {data.raw || "(empty)"}
            </pre>
          </>
        ) : (
          <Typography.Text type="secondary">
            Enter a container instance ID and click Describe to inspect its runtime details.
          </Typography.Text>
        )}
      </Spin>

      <Flex justify="end" style={{ marginTop: 12 }}>
        <Button onClick={close}>Close</Button>
      </Flex>
    </div>
  );
};

export default ContainerInstanceDescribeDialog;

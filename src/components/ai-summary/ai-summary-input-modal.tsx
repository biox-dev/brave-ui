import { Flex, Spin, Typography } from "antd";
import { useEffect, useState, type CSSProperties } from "react";
import { http } from "@/api/client/http";
import type { AISummaryOwnerType } from "./ai-summary-panel";

/** 后端 types.AISummaryInput 对应的前端模型。 */
export interface AISummaryInput {
  title: string;
  system_prompt: string;
  working_dir: string;
  text: string;
}

export interface AISummaryInputModalProps {
  ownerType: AISummaryOwnerType;
  ownerId?: string | number;
  close?: () => void;
}

const PRE_STYLE: CSSProperties = {
  margin: 0,
  padding: 8,
  background: "#f5f5f5",
  borderRadius: 4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 12,
};

const AISummaryInputModal = ({ ownerType, ownerId }: AISummaryInputModalProps) => {
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState<AISummaryInput | null>(null);

  useEffect(() => {
    if (ownerId === undefined || ownerId === null || ownerId === "") {
      return;
    }

    let cancelled = false;
    setLoading(true);
    http
      .get<AISummaryInput>("/ai-summary/input", {
        params: { owner_type: ownerType, owner_id: ownerId },
      })
      .then((res) => {
        if (!cancelled) setInput(res.data ?? null);
      })
      .catch(() => {
        // 错误提示已由 http 响应拦截器统一处理。
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId]);

  return (
    <Spin spinning={loading}>
      {input ? (
        <Flex vertical gap={16}>
          {input.title && (
            <div>
              <Typography.Text strong>Title</Typography.Text>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {input.title}
              </Typography.Paragraph>
            </div>
          )}
          <div>
            <Typography.Text strong>System Prompt</Typography.Text>
            <pre style={PRE_STYLE}>{input.system_prompt || "-"}</pre>
          </div>
          <div>
            <Typography.Text strong>Working Directory</Typography.Text>
            <pre style={PRE_STYLE}>{input.working_dir || "-"}</pre>
          </div>
          <div>
            <Typography.Text strong>User Input</Typography.Text>
            <pre style={PRE_STYLE}>{input.text || "-"}</pre>
          </div>
        </Flex>
      ) : (
        <Typography.Text type="secondary">No input available</Typography.Text>
      )}
    </Spin>
  );
};

export default AISummaryInputModal;

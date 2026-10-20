import { FC, useEffect, useState } from "react";
import { Alert, Button, Descriptions, Empty, Flex, Spin, Tag, Typography } from "antd";
import Markdown from "@/components/markdown";
import { resolveAgentSkillApi, type AgentSkillResolveResult } from "@/api/agent";

const { Text } = Typography;

export interface AgentSkillDetailModalProps {
  /** 技能名（SKILL.md frontmatter 的 name），由调用方传入。 */
  name?: string;
  /** 关闭回调（openAsync 注入）。 */
  onCancel?: () => void;
  /** UIContainer 注入的关闭函数。 */
  close?: () => void;
}

/**
 * AgentSkillDetailModal 以只读方式展示技能详情。
 *
 * 数据来自 GET /agent/skill/resolve：后端用当前用户的业务上下文（llmEnv）渲染
 * SKILL.md 正文，因此这里看到的指令与模型调用 get_skill 时拿到的内容一致。
 *
 * 通过 invoke.agentSkillDetailModal.open({ name }, { title, width, footer: null }) 打开。
 */
const AgentSkillDetailModal: FC<AgentSkillDetailModalProps> = ({ name, onCancel, close }) => {
  // 兼容两种打开方式：openAsync（注入 onCancel）与 UIContainer（注入 close）。
  const handleClose = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AgentSkillResolveResult | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const skillName = name?.trim();
    if (!skillName) {
      return;
    }
    // 防止快速切换技能时旧请求覆盖新结果。
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    resolveAgentSkillApi(skillName)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.data ?? null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load skill");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // 后端在技能不存在 / 版本不匹配时以 200 + error 字段返回业务错误。
  const skillError = detail?.error?.trim();
  const instructions = detail?.instructions?.trim();

  return (
    <Flex vertical gap={12}>
      {loading ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      ) : loadError ? (
        <Alert type="error" showIcon message="Failed to load skill" description={loadError} />
      ) : skillError ? (
        <Alert type="error" showIcon message={name} description={skillError} />
      ) : (
        <>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Name">{detail?.name || name}</Descriptions.Item>
            {detail?.description && (
              <Descriptions.Item label="Description">{detail.description}</Descriptions.Item>
            )}
            {detail?.version && (
              <Descriptions.Item label="Version">{detail.version}</Descriptions.Item>
            )}
            {detail?.skill_path && (
              <Descriptions.Item label="Path">
                <Text code>{detail.skill_path}</Text>
              </Descriptions.Item>
            )}
            {detail?.resources && detail.resources.length > 0 && (
              <Descriptions.Item label="Resources">
                <Flex gap={4} wrap>
                  {detail.resources.map((resource) => (
                    <Tag key={resource}>{resource}</Tag>
                  ))}
                </Flex>
              </Descriptions.Item>
            )}
          </Descriptions>

          {instructions ? (
            <div
              style={{
                maxHeight: "60vh",
                overflow: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <Markdown data={instructions} />
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">No instructions for this skill</Text>}
            />
          )}
        </>
      )}

      <Flex justify="end">
        <Button onClick={handleClose}>Close</Button>
      </Flex>
    </Flex>
  );
};

export default AgentSkillDetailModal;

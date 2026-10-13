import { FC, useMemo, useState } from "react";
import { Button, Checkbox, Flex, Input, Radio, Space, Tag, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import type { AgentAskUserAnswer, AgentQuestion, AgentQuestionAnswer, AgentQuestionItem } from "@/api/agent";

const { Text } = Typography;

// 问题类型 → 展示标签。
const TYPE_LABEL: Record<string, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  text: "文本",
};

// 单题答案的草稿状态：values 为已选选项值，custom 为自定义 / 文本输入。
interface AnswerDraft {
  values: string[];
  custom: string;
}

interface AgentAskUserCardProps {
  /** 后端返回的提问请求（含一个或多个 question）。 */
  question: AgentQuestionItem;
  /** 提交中（禁用交互并展示 loading）。 */
  submitting?: boolean;
  /** 提交作答；由父组件调用后端接口。 */
  onSubmit: (answer: AgentAskUserAnswer) => void;
}

// 判断一个问题是否已作答（用于必答校验）。
function isAnswered(q: AgentQuestion, draft: AnswerDraft): boolean {
  if (!q.required) return true;
  if (q.type === "text") return draft.custom.trim().length > 0;
  return draft.values.length > 0 || draft.custom.trim().length > 0;
}

// 把单个问题的草稿状态规整为后端 QuestionAnswer。
function toAnswer(q: AgentQuestion, draft: AnswerDraft): AgentQuestionAnswer {
  const custom = draft.custom.trim();
  if (q.type === "text") {
    return { id: q.id, value: custom };
  }
  if (q.type === "multiple_choice") {
    return { id: q.id, values: draft.values, custom: custom || undefined };
  }
  return { id: q.id, value: draft.values[0] || "", custom: custom || undefined };
}

/**
 * 单个 AskUser 提问卡片。
 *
 * 与权限卡片同构：LLM 通过 ask_user 工具发起提问，后端持久化 pending 提问并阻塞 Agent，
 * 本组件负责渲染问题（单选 / 多选 / 文本 + 自定义输入），提交后唤醒 Agent 继续执行。
 */
const AgentAskUserCard: FC<AgentAskUserCardProps> = ({ question, submitting, onSubmit }) => {
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});

  const draftOf = (id: string): AnswerDraft => drafts[id] ?? { values: [], custom: "" };

  const setDraft = (id: string, patch: Partial<AnswerDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...draftOf(id), ...patch } }));
  };

  // 未通过必答校验的问题标题列表。
  const missing = useMemo(
    () => question.questions.filter((q) => !isAnswered(q, draftOf(q.id))).map((q) => q.title),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question, drafts]
  );

  const handleSubmit = () => {
    if (missing.length > 0) return;
    const answers: AgentQuestionAnswer[] = question.questions.map((q) => toAnswer(q, draftOf(q.id)));
    onSubmit({ request_id: question.request_id, answers });
  };

  return (
    <Flex
      vertical
      gap={8}
      style={{
        background: "#ffffff",
        border: "1px solid #91caff",
        borderRadius: 6,
        padding: "10px 12px",
      }}
    >
      {/* 标题 / 说明 */}
      <Flex vertical gap={2}>
        <Text strong style={{ fontSize: 13 }}>
          {question.title || "需要你确认"}
        </Text>
        {question.description && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {question.description}
          </Text>
        )}
      </Flex>

      {/* 逐个问题渲染 */}
      {question.questions.map((q) => {
        const draft = draftOf(q.id);
        const isChoice = q.type === "single_choice" || q.type === "multiple_choice";
        return (
          <Flex key={q.id} vertical gap={4}>
            <Flex align="center" gap={6}>
              <Text style={{ fontSize: 13 }}>
                {q.title}
                {q.required && <Text type="danger"> *</Text>}
              </Text>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                {TYPE_LABEL[q.type] ?? q.type}
              </Tag>
            </Flex>
            {q.description && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {q.description}
              </Text>
            )}

            {q.type === "single_choice" && (
              <Radio.Group
                value={draft.values[0]}
                onChange={(e) => setDraft(q.id, { values: e.target.value ? [e.target.value] : [] })}
              >
                <Space direction="vertical" size={2}>
                  {(q.options ?? []).map((opt) => (
                    <Radio key={opt.value} value={opt.value}>
                      <Flex vertical>
                        <span>{opt.label}</span>
                        {opt.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {opt.description}
                          </Text>
                        )}
                      </Flex>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            )}

            {q.type === "multiple_choice" && (
              <Checkbox.Group
                value={draft.values}
                onChange={(values) => setDraft(q.id, { values: values as string[] })}
              >
                <Space direction="vertical" size={2}>
                  {(q.options ?? []).map((opt) => (
                    <Checkbox key={opt.value} value={opt.value}>
                      <Flex vertical>
                        <span>{opt.label}</span>
                        {opt.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {opt.description}
                          </Text>
                        )}
                      </Flex>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            )}

            {/* 文本题，或选择 + 自定义输入 */}
            {(q.type === "text" || q.allow_custom) && (
              <Input.TextArea
                value={draft.custom}
                onChange={(e) => setDraft(q.id, { custom: e.target.value })}
                placeholder={q.placeholder || (q.type === "text" ? "请输入…" : "其他（自定义输入）")}
                autoSize={{ minRows: 1, maxRows: 4 }}
              />
            )}
          </Flex>
        );
      })}

      <Flex justify="flex-end">
        <Button
          type="primary"
          size="small"
          icon={<SendOutlined />}
          loading={submitting}
          disabled={missing.length > 0}
          onClick={handleSubmit}
        >
          提交
        </Button>
      </Flex>
    </Flex>
  );
};

export default AgentAskUserCard;

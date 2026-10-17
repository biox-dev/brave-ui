import { FC, useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Flex, Input, Radio, Space, Tag, Typography } from "antd";
import { LeftOutlined, RightOutlined, SendOutlined } from "@ant-design/icons";
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

const EMPTY_DRAFT: AnswerDraft = { values: [], custom: "" };

interface AgentAskUserCardProps {
  /** 后端返回的提问请求（含一个或多个 question）。 */
  question: AgentQuestionItem;
  /** 提交中（禁用交互并展示 loading）。 */
  submitting?: boolean;
  /**
   * 提交作答；由父组件调用后端接口。
   *
   * 逐题作答时每翻页 / 提交一次都会调用（只含已作答的问题），后端把结果合并进
   * 暂存进度，待全部必答题完成后才唤醒 Agent。
   */
  onSubmit: (answer: AgentAskUserAnswer) => void;
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

// 判断一个问题是否已有内容填入。
function hasContent(draft: AnswerDraft): boolean {
  return draft.values.length > 0 || draft.custom.trim().length > 0;
}

// 必答题必须有内容才能继续 / 提交。
function isAnswered(q: AgentQuestion, draft: AnswerDraft): boolean {
  return !q.required || hasContent(draft);
}

// 从已有作答（后端暂存进度）恢复草稿。
function draftFromAnswer(q: AgentQuestion, answer?: AgentQuestionAnswer): AnswerDraft {
  if (!answer) return { ...EMPTY_DRAFT };
  const values = answer.values?.length ? answer.values : answer.value ? [answer.value] : [];
  const custom = q.type === "text" ? answer.value ?? "" : answer.custom ?? "";
  return { values, custom };
}

/**
 * 单个 AskUser 提问卡片。
 *
 * 与权限卡片同构：LLM 通过 ask_user 工具发起提问，后端持久化 pending 提问并阻塞 Agent，
 * 本组件负责渲染问题（单选 / 多选 / 文本 + 自定义输入），提交后唤醒 Agent 继续执行。
 *
 * 一次提问可包含多个问题，界面按「一题一页」逐题作答：作答当前题目后可进入下一题，
 * 也可返回上一题修改；全部必答题完成后统一提交并唤醒 Agent。
 */
const AgentAskUserCard: FC<AgentAskUserCardProps> = ({ question, submitting, onSubmit }) => {
  const questions = useMemo(() => question.questions ?? [], [question.questions]);
  const total = questions.length;

  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [index, setIndex] = useState(0);

  // 提问内容或后端暂存进度变化时恢复草稿，并定位到第一道未完成的必答题。
  useEffect(() => {
    const restored: Record<string, AnswerDraft> = {};
    (question.answer?.answers ?? []).forEach((ans) => {
      const q = questions.find((item) => item.id === ans.id);
      if (q) restored[q.id] = draftFromAnswer(q, ans);
    });
    setDrafts(restored);

    const next = questions.findIndex(
      (q) => q.required && !hasContent(restored[q.id] ?? EMPTY_DRAFT)
    );
    setIndex(next >= 0 ? next : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, question.updated_at]);

  const draftOf = (id: string): AnswerDraft => drafts[id] ?? EMPTY_DRAFT;

  const setDraft = (id: string, patch: Partial<AnswerDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_DRAFT), ...patch } }));
  };

  // 当前题（单题提问时 index 恒为 0）。
  const current = questions[index];
  const isFirst = index <= 0;
  const isLast = index >= total - 1;

  // 未完成的必答题标题列表（决定「提交」按钮是否可用）。
  const missing = useMemo(
    () => questions.filter((q) => !isAnswered(q, draftOf(q.id))).map((q) => q.title),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, drafts]
  );

  // 已填入内容的题目数量，用于进度展示。
  const doneCount = useMemo(
    () => questions.filter((q) => hasContent(draftOf(q.id))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, drafts]
  );

  if (!current) return null;

  const draft = draftOf(current.id);
  const single = total === 1;
  const canNext = isAnswered(current, draft);

  // 组装作答：只回传已填入内容的问题（选答题留空即视为不作答）。
  const buildAnswer = (): AgentAskUserAnswer => {
    const answered = questions.filter((q) => hasContent(draftOf(q.id)));
    return {
      request_id: question.request_id,
      answers: answered.map((q) => toAnswer(q, draftOf(q.id))),
      answered_ids: answered.map((q) => q.id),
    };
  };

  const goTo = (next: number) => {
    if (next < 0 || next >= total || next === index) return;
    setIndex(next);
  };

  // 翻页时把已完成题目暂存到后端（后端合并后仍保持 pending），刷新页面也不丢进度。
  const handleNavigate = (next: number) => {
    if (doneCount > 0) onSubmit(buildAnswer());
    goTo(next);
  };

  const handleNext = () => {
    if (!canNext) return;
    handleNavigate(index + 1);
  };

  const handleSubmit = () => {
    if (missing.length > 0) return;
    onSubmit(buildAnswer());
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

      {/* 进度：多个问题时展示题号与已答数量 */}
      {!single && (
        <Flex align="center" gap={8} wrap>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            第 {index + 1} / {total} 题
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已答 {doneCount} / {total}
          </Text>
        </Flex>
      )}

      {/* 当前问题（一题一页） */}
      <Flex key={current.id} vertical gap={4}>
        <Flex align="center" gap={6}>
          <Text style={{ fontSize: 13 }}>
            {current.title}
            {current.required && <Text type="danger"> *</Text>}
          </Text>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {TYPE_LABEL[current.type] ?? current.type}
          </Tag>
        </Flex>
        {current.description && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {current.description}
          </Text>
        )}

        {current.type === "single_choice" && (
          <Radio.Group
            value={draft.values[0]}
            onChange={(e) =>
              setDraft(current.id, { values: e.target.value ? [e.target.value] : [] })
            }
          >
            <Space direction="vertical" size={2}>
              {(current.options ?? []).map((opt) => (
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

        {current.type === "multiple_choice" && (
          <Checkbox.Group
            value={draft.values}
            onChange={(values) => setDraft(current.id, { values: values as string[] })}
          >
            <Space direction="vertical" size={2}>
              {(current.options ?? []).map((opt) => (
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
        {(current.type === "text" || current.allow_custom) && (
          <Input.TextArea
            value={draft.custom}
            onChange={(e) => setDraft(current.id, { custom: e.target.value })}
            placeholder={
              current.placeholder || (current.type === "text" ? "请输入…" : "其他（自定义输入）")
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        )}
      </Flex>

      {/* 未完成提示 */}
      {missing.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          还有 {missing.length} 道必答题未完成
          {!isLast && "，可先继续作答其他题目，全部完成后才能提交"}
        </Text>
      )}

      {/* 翻页 / 提交 */}
      <Flex align="center" justify="space-between" gap={8}>
        <Flex align="center" gap={6}>
          {!single && (
            <Button
              size="small"
              icon={<LeftOutlined />}
              disabled={isFirst}
              onClick={() => handleNavigate(index - 1)}
            >
              上一题
            </Button>
          )}
          {!single && !isLast && (
            <Button
              size="small"
              icon={<RightOutlined />}
              iconPosition="end"
              disabled={!canNext}
              onClick={handleNext}
            >
              下一题
            </Button>
          )}
        </Flex>
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

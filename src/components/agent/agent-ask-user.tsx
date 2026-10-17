import { FC, useEffect, useRef, useState } from "react";
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

// 「其他」自定义输入在 Radio / Checkbox 中的内部值（不会提交给后端）。
const CUSTOM_OPTION_VALUE = "__custom__";

// 单题答案的草稿状态：values 为已选选项值，custom 为自定义 / 文本输入，
// customSelected 表示选择题是否勾选了「其他」（与输入内容是否为空无关）。
interface AnswerDraft {
  values: string[];
  custom: string;
  customSelected?: boolean;
}

const EMPTY_DRAFT: AnswerDraft = { values: [], custom: "", customSelected: false };

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

// 选择题是否允许自定义输入：后端显式声明或无法穷举时一律提供「其他」输入框，
// 避免模型漏列选项导致用户无法作答。
function allowCustom(q: AgentQuestion): boolean {
  return q.type === "text" || q.allow_custom !== false;
}

// 一个选项值是否属于问题声明的选项（用于区分已选选项与自定义输入）。
function isDeclaredValue(q: AgentQuestion, value: string): boolean {
  return (q.options ?? []).some((opt) => opt.value === value);
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
  return draft.values.length > 0 || draft.custom.trim().length > 0 || !!draft.customSelected;
}

// 必答题必须有内容才能提交。
function isAnswered(q: AgentQuestion, draft: AnswerDraft): boolean {
  return !q.required || hasContent(draft);
}

// 从已有作答（后端暂存进度）恢复草稿。
function draftFromAnswer(q: AgentQuestion, answer?: AgentQuestionAnswer): AnswerDraft {
  if (!answer) return { ...EMPTY_DRAFT };
  const custom = q.type === "text" ? answer.value ?? "" : answer.custom ?? "";
  if (q.type === "text") {
    return { values: [], custom, customSelected: false };
  }
  const raw = answer.values?.length ? answer.values : answer.value ? [answer.value] : [];
  const values: string[] = [];
  let extra = custom;
  raw.forEach((value) => {
    if (!value) return;
    if (isDeclaredValue(q, value)) {
      values.push(value);
    } else if (!extra) {
      // 不在选项声明中的值（用户自定义输入）回填到输入框。
      extra = value;
    }
  });
  return { values, custom: extra, customSelected: extra.trim().length > 0 };
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
  const questions = question.questions ?? [];
  const total = questions.length;

  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({});
  const [index, setIndex] = useState(0);
  // 提问内容快照：仅当提问本身（问题列表 / 暂存进度）真正变化时才恢复草稿与页码，
  // 避免翻页或父组件重渲染把用户所在的题号重置回第一题。
  const snapshotRef = useRef("");

  useEffect(() => {
    const snapshot = JSON.stringify([
      question.id,
      question.updated_at,
      question.questions ?? [],
      question.answer?.answers ?? [],
    ]);
    if (snapshotRef.current === snapshot) return;
    const isNewQuestion = snapshotRef.current === "";
    snapshotRef.current = snapshot;

    const restored: Record<string, AnswerDraft> = {};
    (question.answer?.answers ?? []).forEach((ans) => {
      const q = (question.questions ?? []).find((item) => item.id === ans.id);
      if (q) restored[q.id] = draftFromAnswer(q, ans);
    });
    // 合并而非整体覆盖：后端暂存进度回来时，本地已填但尚未提交到后端的内容不能被清空
    // （否则用户填完一题点「上一题」，刚填的内容会消失、按钮状态也跟着回退）。
    setDrafts((prev) => {
      const mergedDrafts: Record<string, AnswerDraft> = { ...restored };
      Object.entries(prev).forEach(([id, draft]) => {
        if (!hasContent(draft)) return;
        if (!hasContent(mergedDrafts[id] ?? EMPTY_DRAFT)) {
          mergedDrafts[id] = draft;
        }
      });
      return mergedDrafts;
    });

    // 仅在首次挂载 / 切换到另一条提问时定位到第一道未完成的必答题；
    // 已在本条提问内翻页时保持当前页码。
    if (!isNewQuestion) return;
    const next = (question.questions ?? []).findIndex(
      (q) => q.required && !hasContent(restored[q.id] ?? EMPTY_DRAFT)
    );
    setIndex(next >= 0 ? next : 0);
  }, [question]);

  const draftOf = (id: string): AnswerDraft => drafts[id] ?? EMPTY_DRAFT;

  const setDraft = (id: string, patch: Partial<AnswerDraft>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_DRAFT), ...patch } }));
  };

  // 选择题的草稿：允许自定义时，「其他」作为独立选中项参与 Radio / Checkbox 的选中态，
  // 但提交时只回传真实选项值（custom 单独回传）。
  const choiceDraftOf = (q: AgentQuestion): AnswerDraft => {
    const draft = draftOf(q.id);
    if (!allowCustom(q) || !draft.customSelected) return draft;
    return { ...draft, values: [...draft.values, CUSTOM_OPTION_VALUE] };
  };

  // 单选 / 多选变化：把「其他」的选中态翻译回 values / customSelected。
  const applyChoiceValues = (q: AgentQuestion, next: string[]) => {
    const customSelected = next.includes(CUSTOM_OPTION_VALUE);
    const values = next.filter((value) => value !== CUSTOM_OPTION_VALUE);
    setDraft(q.id, { values, customSelected });
  };

  // 当前题（单题提问时 index 恒为 0）。
  const current = questions[Math.min(index, Math.max(total - 1, 0))];
  const isFirst = index <= 0;
  const isLast = index >= total - 1;

  // 未完成的必答题标题列表（决定「提交」按钮是否可用）。
  const missing = questions.filter((q) => !isAnswered(q, draftOf(q.id))).map((q) => q.title);

  // 已填入内容的题目数量，用于进度展示。
  const doneCount = questions.filter((q) => hasContent(draftOf(q.id))).length;

  if (!current) return null;

  const draft = draftOf(current.id);
  const single = total === 1;
  const canNext = isAnswered(current, draft);
  const customAllowed = allowCustom(current);

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
    if (next < 0 || next >= total) return;
    setIndex(next);
  };

  // 翻页是纯前端行为：草稿保存在组件内，不向后端提交暂存，避免后端返回的合并结果
  // 覆盖用户刚填的内容、并把页码重置回第一道未答必答题（表现为「上一题点不动 / 被退出」）。
  const handleNavigate = (next: number) => {
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

  const choiceValues = choiceDraftOf(current).values;
  const customChecked = customAllowed && choiceValues.includes(CUSTOM_OPTION_VALUE);

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
            value={choiceValues[0]}
            onChange={(e) => applyChoiceValues(current, [e.target.value])}
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
              {customAllowed && <Radio value={CUSTOM_OPTION_VALUE}>其他（自行输入）</Radio>}
            </Space>
          </Radio.Group>
        )}

        {current.type === "multiple_choice" && (
          <Checkbox.Group
            value={choiceValues}
            onChange={(values) => applyChoiceValues(current, values as string[])}
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
              {customAllowed && (
                <Checkbox value={CUSTOM_OPTION_VALUE}>其他 / 补充说明（自行输入）</Checkbox>
              )}
            </Space>
          </Checkbox.Group>
        )}

        {/* 文本题，或选择「其他」/ 补充说明时展示输入框（选中「其他」即渲染，与是否已输入无关）。 */}
        {(current.type === "text" || customChecked) && (
          <Input.TextArea
            value={draft.custom}
            onChange={(e) => setDraft(current.id, { custom: e.target.value })}
            placeholder={
              current.placeholder || (current.type === "text" ? "请输入…" : "其他（自定义输入）")
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
        )}
        {/* 允许自定义但未选「其他」时给出提示，确保用户随时可以自行输入。 */}
        {current.type !== "text" && customAllowed && !customChecked && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            选项不完整？选择「其他」可自行输入。
          </Text>
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

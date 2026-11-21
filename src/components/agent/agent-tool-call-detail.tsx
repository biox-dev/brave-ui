import { FC, useMemo, type ReactNode } from 'react';
import { Flex, Tag, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import UnifiedDiff from '@/components/common/unified-diff';

const { Text } = Typography;

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface AgentToolCallDetailProps {
  /** 工具名（与聊天里 Tool Call 行显示的一致）。 */
  name?: string;
  /** 模型给工具的入参（对象或 JSON 字符串，原样透传）。 */
  input?: unknown;
  /**
   * 工具输出（`tool_result` 的 content）。
   *
   * 为空表示这次调用还没有结果：仍在执行（`executing=true`）时显示 Executing...，
   * 否则（历史里只有调用没有结果，如权限被拒绝或任务失败）显示无输出。
   */
  output?: string;
  /** 结果是否为错误（后端 `is_error`）。 */
  isError?: boolean;
  /** 结果 metadata（opencode edit / write 会把 diff 放在这里）。 */
  metadata?: unknown;
  /** 是否仍在执行（没有结果且任务进行中）。 */
  executing?: boolean;
  /** 模型给出的调用目的（入参里的 purpose），仅作标题区的补充说明。 */
  purpose?: string;
  /** 由会话页注入：关闭承载本视图的工作区标签。 */
  onCloseTab?: () => void;
}

type DiffMetadata = { diff: string; additions?: number; removals?: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

/** 入参可能是已解析对象，也可能是后端透传的 JSON 字符串。 */
function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function pretty(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 解析 opencode edit / write 工具放在 metadata 里的 diff。 */
function parseDiffMetadata(metadata: unknown): DiffMetadata | null {
  if (typeof metadata !== 'string' || metadata.trim() === '') return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    if (typeof parsed.diff !== 'string' || parsed.diff === '') return null;
    return {
      diff: parsed.diff,
      additions: typeof parsed.additions === 'number' ? parsed.additions : undefined,
      removals: typeof parsed.removals === 'number' ? parsed.removals : undefined,
    };
  } catch {
    return null;
  }
}

const CODE_BLOCK_STYLE = {
  margin: 0,
  maxHeight: '40vh',
  overflow: 'auto',
  padding: 12,
  border: '1px solid #f0f0f0',
  borderRadius: 6,
  background: '#fafafa',
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: MONOSPACE,
} as const;

const SectionTitle: FC<{ children: ReactNode }> = ({ children }) => (
  <Text type="secondary" style={{ fontSize: 12 }}>
    {children}
  </Text>
);

/**
 * 工具调用详情（在右侧工作区 MainTabs 里打开）。
 *
 * 统一渲染一次工具调用的完整信息：上方是模型给工具的入参（Input），
 * 下方是工具输出（Output）。聊天里的 Tool Call 行只显示「工具名 + 目的」，
 * 点击后由它承接详情展示，避免结果正文把对话流撑长。
 */
const AgentToolCallDetail: FC<AgentToolCallDetailProps> = ({
  name,
  input,
  output,
  isError,
  metadata,
  executing,
  purpose,
}) => {
  const toolName = (name ?? '').trim() || 'Tool Call';
  const inputText = useMemo(() => pretty(asJsonRecord(input) ?? input), [input]);
  // metadata 里的 diff 只用于 edit / write 类结果；错误结果不再展示 diff。
  const diffMeta = useMemo(
    () => (isError ? null : parseDiffMetadata(metadata)),
    [isError, metadata],
  );
  const outputText = (output ?? '').trim();
  const hasOutput = outputText.length > 0;

  return (
    <Flex vertical gap={12} style={{ padding: 12, minHeight: 0, height: '100%', overflow: 'auto' }}>
      <Flex align="center" gap={8} wrap>
        <Text strong style={{ fontSize: 14 }}>
          Tool Call
        </Text>
        <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>
          {toolName}
        </Tag>
        {isError && (
          <Tag color="error" style={{ marginInlineEnd: 0 }}>
            Error
          </Tag>
        )}
        {purpose && (
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: purpose }}>
            {purpose}
          </Text>
        )}
      </Flex>

      <Flex vertical gap={6}>
        <SectionTitle>Input</SectionTitle>
        {inputText ? (
          <pre style={{ ...CODE_BLOCK_STYLE, color: '#595959' }}>{inputText}</pre>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No input
          </Text>
        )}
      </Flex>

      <Flex vertical gap={6}>
        <SectionTitle>Output</SectionTitle>
        {executing ? (
          <Flex align="center" gap={6} style={{ padding: '4px 0' }}>
            <LoadingOutlined style={{ color: '#1677ff' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Executing...
            </Text>
          </Flex>
        ) : diffMeta ? (
          <UnifiedDiff diff={diffMeta.diff} bordered={false} maxHeight="40vh" />
        ) : hasOutput ? (
          <pre style={{ ...CODE_BLOCK_STYLE, color: isError ? '#ff4d4f' : '#595959' }}>
            {outputText}
          </pre>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            No output
          </Text>
        )}
      </Flex>
    </Flex>
  );
};

export default AgentToolCallDetail;

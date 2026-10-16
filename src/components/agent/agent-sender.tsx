import { FC, useEffect, useRef } from "react";
import { Sender, type SenderProps } from "@ant-design/x";
import { Dropdown, Flex, GetRef, type MenuProps } from "antd";
import { ProfileOutlined } from "@ant-design/icons";

/** Sender slot 模式的 slotConfig 类型（可插入 tag 引用）。 */
type SlotConfig = NonNullable<SenderProps["slotConfig"]>;

/**
 * slot 模式开关：Sender 只有在传入 slotConfig（或 skill）时才会渲染可插入 tag 的
 * contenteditable 输入框；不需要预置任何 slot，传空数组即可。
 *
 * ⚠️ 必须是**稳定引用**：slotConfig 每次渲染都变会重新触发 Sender 内部的
 * effect，把输入内容回写成空值。
 */
const SLOT_CONFIG: SlotConfig = [];

/** 可引用的文件。 */
interface FileRefOption {
  /** 菜单项 key。 */
  key: string;
  /** 菜单与 chip 上显示的名称。 */
  label: string;
  /** 拼进消息文本里的路径。 */
  path: string;
}

// TODO: 目前是占位数据（后端还没有「列出工作目录 / 项目文件」的接口），
// 接入真实文件来源后替换这里即可。
const FILE_REF_OPTIONS: FileRefOption[] = [
  { key: "demo_file", label: "demo.ts", path: "src/demo.ts" },
  { key: "readme", label: "README.md", path: "README.md" },
];

export interface AgentSenderProps {
  /** 当前输入文本（受控）：插入的文件引用也以 `@path` 文本参与拼接。 */
  value: string;
  /** 输入变化（含插入 / 删除文件引用）。 */
  onChange: (value: string) => void;
  /** 提交（Enter 或发送按钮），参数为拼接好的纯文本。 */
  onSubmit: (value: string) => void;
  /** 是否有一轮任务进行中：显示停止按钮并锁定输入（停止按钮仍可用）。 */
  loading?: boolean;
  /** 点击停止按钮。 */
  onCancel?: () => void;
  /** 硬禁用：输入与所有按钮都不可用。 */
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Agent 输入区（独立组件）。
 *
 * 目前只实现一个功能按钮：**文件引用**（Files）—— 点击后在光标处插入一个文件
 * chip，提交时该 chip 以 `@path` 文本拼进消息文本。
 * 其余 Sender 扩展（深度思考开关 / Agent 选择 / 附件 / API 设置等）先不添加。
 */
const AgentSender: FC<AgentSenderProps> = ({
  value,
  onChange,
  onSubmit,
  loading,
  onCancel,
  disabled,
  placeholder,
}) => {
  const senderRef = useRef<GetRef<typeof Sender>>(null);
  // slot 模式下输入内容是内部 contenteditable 维护的，因此发送中 / 禁用时
  // 只能靠 readOnly 锁住编辑（disabled 只作用于操作按钮）。
  const locked = !!disabled || !!loading;

  // 外部把 value 清空（New Chat / 发送后）时同步清空 contenteditable，
  // 否则 DOM 里会残留旧文本。
  useEffect(() => {
    if (!value) senderRef.current?.clear?.();
  }, [value]);

  const fileItems: MenuProps["items"] = FILE_REF_OPTIONS.map((f) => ({
    key: f.key,
    icon: <ProfileOutlined />,
    label: f.label,
  }));

  // 插入文件引用：以 tag 形式插到光标处（定位不到光标时追加到末尾）。
  // formatResult 决定这个 tag 拼进消息文本后的纯文本形式。
  const handleFileRefClick = (key: string) => {
    const file = FILE_REF_OPTIONS.find((f) => f.key === key);
    if (!file) return;
    senderRef.current?.insert?.([
      {
        type: "tag",
        key: `${file.key}_${Date.now()}`,
        props: {
          label: (
            <Flex align="center" gap={4} style={{ display: "inline-flex" }}>
              <ProfileOutlined />
              {file.label}
            </Flex>
          ),
          value: file.path,
        },
        formatResult: () => `@${file.path}`,
      },
    ]);
  };

  return (
    <Sender
      ref={senderRef}
      value={value}
      onChange={(next) => onChange(next)}
      onSubmit={(text) => {
        const trimmed = (text || "").trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        // contenteditable 不受 value 控制，提交后需要显式清空。
        senderRef.current?.clear?.();
      }}
      loading={loading}
      onCancel={onCancel}
      readOnly={locked}
      disabled={disabled}
      placeholder={placeholder}
      slotConfig={SLOT_CONFIG}
      autoSize={{ minRows: 2, maxRows: 6 }}
      style={{ marginTop: 8 }}
      // ⚠️ Sender 默认会把 actionNode（发送 / 停止按钮）渲染在内容区的 suffix 里；
      // 这里又把它放进 footer，会出现**两个发送按钮**。传 false 关掉默认 suffix，
      // footer 成为唯一的操作按钮出口。
      suffix={false}
      footer={(actionNode) => (
        <Flex justify="space-between" align="center">
          <Flex align="center" gap="small">
            {/* 唯一的扩展功能按钮：文件引用。 */}
            <Dropdown
              menu={{ items: fileItems, onClick: ({ key }) => handleFileRefClick(key) }}
              disabled={locked}
            >
              <Sender.Switch value={false} icon={<ProfileOutlined />} disabled={locked}>
                Files
              </Sender.Switch>
            </Dropdown>
          </Flex>
          <Flex align="center">{actionNode}</Flex>
        </Flex>
      )}
    />
  );
};

export default AgentSender;

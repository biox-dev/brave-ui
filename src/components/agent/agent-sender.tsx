import { FC, useEffect, useRef, type ReactNode } from "react";
import { Sender, type SenderProps } from "@ant-design/x";
import { Button, Flex, GetRef } from "antd";
import {
  CloudServerOutlined,
  DatabaseOutlined,
  FileOutlined,
  PartitionOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { invoke } from "@/core/ui-system/invokeV2";
import type { DatasetFileItem, DatasetItem } from "@/api/data";
import type { ContainerTemplateItem } from "@/api/container";

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

export interface AgentSenderProps {
  /** 当前输入文本（受控）：插入的引用 chip 也以 `@file:<id>` / `@dataset:<id>` / `@container:<id>` 文本参与拼接。 */
  value: string;
  /** 输入变化（含插入 / 删除引用 chip）。 */
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
 * 提供四个功能按钮（通过 invoke 弹出对应页面的「选择模式」挑一个条目，
 * 选中后在光标处插入引用 chip，提交时该 chip 以 `@<kind>:<id>` 文本拼进消息文本）：
 *   - Data Files：`invoke.datasetFilePage`，数据集文件（go_dataset -> go_file），`@file:<id>`；
 *   - Node Files：`invoke.analysisNodeFilePage`，分析节点产物文件（`@file:<id>`）；
 *   - Datasets：`invoke.datasetProjectPage`，数据集（go_dataset），`@dataset:<id>`；
 *   - Containers：`invoke.containerTemplatePage`，容器模板（go_container_template_definition），`@container:<id>`。
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

  // 插入引用 chip：以 tag 形式插到光标处（定位不到光标时追加到末尾）。
  // kind 决定提交时拼进消息文本的前缀（file / dataset / container）。
  const insertRef = (kind: "file" | "dataset" | "container", value: string, label: string, icon: ReactNode) => {
    senderRef.current?.insert?.([
      {
        type: "tag",
        key: `${kind}_ref_${Date.now()}`,
        props: {
          label: (
            <Flex align="center" gap={4} style={{ display: "inline-flex" }}>
              {icon}
              {label}
            </Flex>
          ),
          value,
        },
        formatResult: () => `@${kind}:${value} `,
      },
    ]);
  };

  // 选择结果统一处理：用户取消（reject）或条目没有 id 时什么都不插入。
  const insertPickedFile = (file?: DatasetFileItem) => {
    const path = String(file?.id ?? "").trim();
    if (!path) return;
    insertRef("file", path, file?.file_name || file?.file_id || path, <FileOutlined />);
  };

  // Data Files：invoke 弹出 dataset-file-page 的选择模式（单选 + Confirm），
  // Confirm 时该页面用 onOk 回传选中的 DatasetFileItem，openDrawerAsync 据此 resolve。
  const handleSelectDatasetFile = async () => {
    try {
      const file = (await invoke.datasetFilePage.openDrawerAsync(
        {},
        { width: 1000, title: "Select Data File" }
      )) as DatasetFileItem | undefined;
      insertPickedFile(file);
    } catch {
      // 用户取消选择，无需处理。
    }
  };

  // Node Files：invoke 弹出 analysis-node-file-page 的选择模式（同上）。
  const handleSelectNodeFile = async () => {
    try {
      const file = (await invoke.analysisNodeFilePage.openDrawerAsync(
        {},
        { width: 1000, title: "Select Analysis Node File" }
      )) as DatasetFileItem | undefined;
      insertPickedFile(file);
    } catch {
      // 用户取消选择，无需处理。
    }
  };

  // Datasets：invoke 弹出 dataset-project-page 的选择模式，Confirm 时回传 DatasetItem。
  // 提交时以 `@dataset:<id>` 参与消息文本，Agent 侧用 get_dataset 解析出数据集路径。
  const handleSelectDataset = async () => {
    try {
      const dataset = (await invoke.datasetProjectPage.openDrawerAsync(
        {},
        { width: 1000, title: "Select Dataset" }
      )) as DatasetItem | undefined;
      const datasetId = String(dataset?.id ?? "").trim();
      if (!datasetId) return;
      insertRef(
        "dataset",
        datasetId,
        dataset?.dataset_name || `Dataset-${datasetId}`,
        <TableOutlined />
      );
    } catch {
      // 用户取消选择，无需处理。
    }
  };

  // Containers：invoke 弹出 container-template-page 的选择模式，Confirm 时回传 ContainerTemplateItem。
  // 提交时以 `@container:<id>` 参与消息文本，Agent 侧用 get_container_template 解析展示名与描述。
  const handleSelectContainer = async () => {
    try {
      const template = (await invoke.containerTemplatePage.openDrawerAsync(
        {},
        { width: "80%", title: "Select Container Template" }
      )) as ContainerTemplateItem | undefined;
      const templateId = String(template?.id ?? "").trim();
      if (!templateId) return;
      insertRef(
        "container",
        templateId,
        template?.display_name || template?.name || `Container-${templateId}`,
        <CloudServerOutlined />
      );
    } catch {
      // 用户取消选择，无需处理。
    }
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
            {/* 四个引用入口：数据集文件 / 分析节点产物文件 / 数据集 / 容器模板。 */}
            <Button
              size="small"
              icon={<DatabaseOutlined />}
              disabled={locked}
              onClick={() => void handleSelectDatasetFile()}
            >
              Data Files
            </Button>
            <Button
              size="small"
              icon={<PartitionOutlined />}
              disabled={locked}
              onClick={() => void handleSelectNodeFile()}
            >
              Node Files
            </Button>
            <Button
              size="small"
              icon={<TableOutlined />}
              disabled={locked}
              onClick={() => void handleSelectDataset()}
            >
              Datasets
            </Button>
            <Button
              size="small"
              icon={<CloudServerOutlined />}
              disabled={locked}
              onClick={() => void handleSelectContainer()}
            >
              Containers
            </Button>
          </Flex>
          <Flex align="center">{actionNode}</Flex>
        </Flex>
      )}
    />
  );
};

export default AgentSender;

import { FC, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Sender, type SenderProps } from "@ant-design/x";
import { Button, Dropdown, Flex, GetRef } from "antd";
import {
  CloudServerOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FileOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  PlusOutlined,
  ReadOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { invoke } from "@/core/ui-system/invokeV2";
import type { DatasetFileItem } from "@/api/data";
import type { ContainerTemplateItem } from "@/api/container";
import type { DatasetPickResult } from "@/components/layout-sider/data-dataset-page/dataset-project-page";
import { useAgentSenderStore, type AgentRefKind } from "./agent-sender.store";

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

/** 每种引用类型在 chip 上的图标（外部页面只传 kind，图标在这里统一维护）。 */
const REF_ICONS: Record<AgentRefKind, ReactNode> = {
  file: <FileOutlined />,
  dataset: <TableOutlined />,
  container: <CloudServerOutlined />,
  report: <ReadOutlined />,
  analysis_node: <NodeIndexOutlined />,
  script: <CodeOutlined />,
  workflow: <PartitionOutlined />,
  analysis: <ExperimentOutlined />,
  plan: <UnorderedListOutlined />,
};

export interface AgentSenderProps {
  /** 当前输入文本（受控）：插入的引用 chip 也以 `@file:<id>` / `@dataset:<id>` / `@container:<id>` / `@report:<id>` / `@analysis_node:<id>` / `@script:<id>` / `@workflow:<id>` / `@analysis:<id>` / `@plan:<id>` 文本参与拼接。 */
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
 * footer 左下角的「+」向上弹出三个引用入口（通过 invoke 弹出对应页面的「选择模式」挑条目，
 * 选中后在光标处插入引用 chip，提交时该 chip 以 `@<kind>:<id>` 文本拼进消息文本）：
 *   - Node Files：`invoke.analysisNodeFilePage`，分析节点产物文件，**多选**，`@file:<id>`；
 *   - Datasets：`invoke.datasetProjectPage`，数据集浏览器：可多选数据集（`@dataset:<id>`），
 *     也可点进某个数据集多选其文件（`@file:<id>`）；
 *   - Containers：`invoke.containerTemplatePage`，容器模板（go_container_template_definition），**点击条目即插入**，`@container:<id>`。
 *
 * 另外支持「外部页面把引用插进来」：任意页面调用 hooks/useInsertAgentRef
 * （如报告文件页插入 `@report:<id>`、分析节点详情页插入 `@analysis_node:<id>`、
 * 脚本面板插入 `@script:<id>`、会话结果面板按资源类型插入
 * `@plan:<id>` / `@script:<id>` / `@workflow:<id>` / `@analysis:<id>` /
 * `@analysis_node:<id>` / `@report:<id>`），
 * 请求经 agent-sender.store 落到本组件，本组件消费后插入 chip ——
 * 面板当时未打开也不会丢请求。
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

  // 批量插入引用 chip：一次 insert 插入多个 tag（多选时避免多次重排光标）。
  // kind 决定提交时拼进消息文本的前缀（file / dataset / container / report）。
  // 图标默认按 kind 取 REF_ICONS，调用方一般不用传。
  const insertRefs = useCallback(
    (
      refs: Array<{
        kind: AgentRefKind;
        value: string;
        label: string;
        icon?: ReactNode;
      }>
    ) => {
      if (refs.length === 0) return;
      const stamp = Date.now();
      senderRef.current?.insert?.(
        refs.map((ref, index) => {
          const icon = ref.icon ?? REF_ICONS[ref.kind];
          return {
            type: "tag" as const,
            // 同一个时间戳内插入多个 tag 时 key 必须唯一，因此带上序号。
            key: `${ref.kind}_ref_${stamp}_${index}`,
            props: {
              label: (
                <Flex align="center" gap={4} style={{ display: "inline-flex" }}>
                  {icon}
                  {ref.label}
                </Flex>
              ),
              value: ref.value,
            },
            formatResult: () => `@${ref.kind}:${ref.value} `,
          };
        })
      );
    },
    []
  );

  // 单个引用插入（数据集 / 容器模板 / 外部页面发起的请求走这里）。
  const insertRef = useCallback(
    (
      kind: AgentRefKind,
      value: string,
      label: string,
      icon: ReactNode = REF_ICONS[kind]
    ) => {
      insertRefs([{ kind, value, label, icon }]);
    },
    [insertRefs]
  );

  // 文件选择结果统一处理：Data Files / Node Files 支持多选，回传可能是数组。
  // 用户取消（reject）或条目没有 id 时什么都不插入。
  const insertPickedFiles = (picked?: DatasetFileItem | DatasetFileItem[]) => {
    const files = Array.isArray(picked) ? picked : picked ? [picked] : [];
    insertRefs(
      files
        .map((file) => {
          const path = String(file?.id ?? "").trim();
          return {
            kind: "file" as const,
            value: path,
            label: file?.file_name || file?.file_id || path,
          };
        })
        .filter((item) => item.value)
    );
  };

  // 选择抽屉收起后把焦点交还输入框。
  // ⚠️ 不能在 await resolve 之后立即 focus：rc-drawer 会在关闭动画结束时的
  // afterOpenChange(false) 里把焦点还给「打开前的元素」，也就是触发的那个按钮
  // （Drawer 内部 lastActiveRef），立即 focus 会被它盖掉。
  // 所以这里轮询等待 Drawer 从 DOM 上真正卸载（= 它已经还过焦点了）再抢回来。
  const focusInputAfterPicker = () => {
    const startedAt = Date.now();
    const tryFocus = () => {
      // 兜底：最多等 1s，避免页面里存在常驻 Drawer 时永远聚焦不上。
      if (document.querySelector(".ant-drawer") && Date.now() - startedAt < 1000) {
        requestAnimationFrame(tryFocus);
        return;
      }
      senderRef.current?.focus({ cursor: "end" });
    };
    requestAnimationFrame(tryFocus);
  };

  // 消费外部页面发起的「插入引用」请求（见 hooks/useInsertAgentRef）。
  // 请求先落在 store 里，因此即使 Agent 面板是刚被切出来、本组件刚挂载也能插入。
  const pendingRef = useAgentSenderStore((state) => state.pendingRef);
  const consumePendingRef = useAgentSenderStore((state) => state.consumePendingRef);
  useEffect(() => {
    if (!pendingRef) return;
    insertRef(pendingRef.kind, pendingRef.value, pendingRef.label);
    consumePendingRef();
    // 插入后把光标留在输入框末尾，方便直接继续输入。
    senderRef.current?.focus({ cursor: "end" });
  }, [pendingRef, consumePendingRef, insertRef]);

  // Node Files：invoke 弹出 analysis-node-file-page 的选择模式（多选 + Confirm），
  // Confirm 时该页面用 onOk 回传选中的 DatasetFileItem[]，openDrawerAsync 据此 resolve。
  const handleSelectNodeFile = async () => {
    try {
      const picked = (await invoke.analysisNodeFilePage.openDrawerAsync(
        { multiple: true },
        { width: 1000, title: "Select Analysis Node Files" }
      )) as DatasetFileItem | DatasetFileItem[] | undefined;
      insertPickedFiles(picked);
    } catch {
      // 用户取消选择，无需处理。
    } finally {
      // 无论选中还是取消，都把焦点交还输入框。
      focusInputAfterPicker();
    }
  };

  // Datasets：invoke 弹出 dataset-project-page 的多选模式（Confirm 回传）：
  // 可直接勾选多个数据集（`@dataset:<id>`），也可点进某个数据集继续勾选其文件
  // （`@file:<id>`），Agent 侧分别用 get_dataset / get_file 解析。
  const handleSelectDataset = async () => {
    try {
      const picked = (await invoke.datasetProjectPage.openDrawerAsync(
        { multiple: true },
        { width: 1000, title: "Select Datasets / Files" }
      )) as DatasetPickResult | undefined;
      if (!picked) return;
      insertRefs([
        ...picked.datasets.map((dataset) => ({
          kind: "dataset" as const,
          value: String(dataset.id),
          label: dataset.dataset_name || `Dataset-${dataset.id}`,
        })),
        ...picked.files.map((file) => ({
          kind: "file" as const,
          value: String(file.id),
          label: file.file_name || file.file_id || String(file.id),
        })),
      ]);
    } catch {
      // 用户取消选择，无需处理。
    } finally {
      // 无论选中还是取消，都把焦点交还输入框。
      focusInputAfterPicker();
    }
  };

  // Containers：invoke 弹出 container-template-page 的选择模式（点击条目即回传，无 Confirm 按钮）。
  // 提交时以 `@container:<id>` 参与消息文本，Agent 侧用 get_container_template 解析展示名与描述。
  const handleSelectContainer = async () => {
    try {
      const template = (await invoke.containerTemplatePage.openDrawerAsync(
        { selectOnClick: true },
        { width: 1000, title: "Select Container Template" }
      )) as ContainerTemplateItem | undefined;
      const templateId = String(template?.id ?? "").trim();
      if (!templateId) return;
      insertRef(
        "container",
        templateId,
        template?.display_name || template?.name || `Container-${templateId}`
      );
    } catch {
      // 用户取消选择，无需处理。
    } finally {
      // 无论选中还是取消，都把焦点交还输入框。
      focusInputAfterPicker();
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
        <Flex justify="space-between" align="center" gap="small">
          {/* 引用入口收进左下角的「+」里，点击向上弹出列表：
              分析节点产物文件 / 数据集（可进数据集挑文件）/ 容器模板。 */}
          <Dropdown
            trigger={["click"]}
            placement="topLeft"
            disabled={locked}
            menu={{
              items: [
                {
                  key: "node-files",
                  icon: <PartitionOutlined />,
                  label: "Node Files",
                  onClick: () => void handleSelectNodeFile(),
                },
                {
                  key: "datasets",
                  icon: <TableOutlined />,
                  label: "Datasets",
                  onClick: () => void handleSelectDataset(),
                },
                {
                  key: "containers",
                  icon: <CloudServerOutlined />,
                  label: "Containers",
                  onClick: () => void handleSelectContainer(),
                },
              ],
            }}
          >
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              disabled={locked}
              aria-label="Insert reference"
            />
          </Dropdown>
          <Flex align="center">{actionNode}</Flex>
        </Flex>
      )}
    />
  );
};

export default AgentSender;

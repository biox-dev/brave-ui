// src/components/script/io-schema-editor/editors/schema-item-card.tsx
// One form-json entry. The card is *type aware*: it asks the registry which
// property groups the item's `type` supports and renders only those, which is
// what makes a `BaseInput` card look nothing like a
// `CollectedSampleSelect` card.
import { Alert, Button, Card, Collapse, Flex, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { FC, memo, useCallback, useMemo, useRef } from "react";
import { getComponentMeta } from "@/components/form-components/registry";
import { isRequired, setKey } from "../normalize";
import { AdvancedEditor } from "../prop-editors/advanced";
import { DependsEditor } from "../prop-editors/depends";
import { InlinePropGroups, itemPropGroups } from "../prop-editors";
import type { JSONMap } from "../types";

type SchemaItemActions = {
  onPatch: (index: number, next: JSONMap) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
};

const SchemaItemCardInner: FC<
  { listKey: string; item: JSONMap; index: number; total: number } & SchemaItemActions
> = ({ listKey, item, index, total, onPatch, onRemove, onMove }) => {
  const isOutput = listKey === "outputs";
  const type: string = typeof item?.type === "string" ? item.type : "";
  const meta = getComponentMeta(type);
  const groups = useMemo(() => itemPropGroups(listKey, type), [listKey, type]);
  const required = isRequired(item);

  // Mirror the newest item in a ref so the property editors can receive
  // callbacks with a stable identity — otherwise every keystroke would create
  // new props and defeat React.memo on the children.
  const itemRef = useRef(item);
  itemRef.current = item;

  const set = useCallback(
    (key: string, value: any) => onPatch(index, setKey(itemRef.current, key, value)),
    [index, onPatch]
  );

  const patch = useCallback(
    (next: JSONMap) => onPatch(index, next),
    [index, onPatch]
  );

  const editorProps = { item, listKey, index, set, patch };

  return (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
      title={
        <Flex gap={8} align="center" wrap>
          <Tag color="blue">#{index + 1}</Tag>
          <Typography.Text strong>{item.name || item.label || "(unnamed)"}</Typography.Text>
          {type && <Tag>{type}</Tag>}
          {meta?.category && <Tag color="geekblue">{meta.category}</Tag>}
          {required && <Tag color="red">required</Tag>}
        </Flex>
      }
      extra={
        <Space size={4}>
          <Tooltip title="Move up">
            <Button
              size="small"
              type="text"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
            />
          </Tooltip>
          <Tooltip title="Move down">
            <Button
              size="small"
              type="text"
              icon={<ArrowDownOutlined />}
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
            />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={() => onRemove(index)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      {!isOutput && !meta && type && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message={`未知类型 ${type}`}
          description="该 type 不在组件目录（form-components/registry/meta.ts）中，渲染时不会显示任何控件。"
        />
      )}
      {!isOutput && !type && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="请先选择 type"
        />
      )}

      <InlinePropGroups {...editorProps} groups={groups} />

      <Collapse
        ghost
        size="small"
        items={[
          ...(groups.includes("depends")
            ? [
                {
                  key: "depends",
                  label: "Condition (depends)",
                  children: <DependsEditor {...editorProps} />,
                },
              ]
            : []),
          ...(groups.includes("advanced")
            ? [
                {
                  key: "advanced",
                  label: "Advanced JSON",
                  children: <AdvancedEditor {...editorProps} />,
                },
              ]
            : []),
        ]}
      />
    </Card>
  );
};

export const SchemaItemCard = memo(SchemaItemCardInner);

export default SchemaItemCard;

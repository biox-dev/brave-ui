// src/components/script/io-schema-editor/editors/append-editor.tsx
// Editor for the `append` array — the nested sub-fields of a repeatable
// component. The selectable child types are restricted to what the parent
// implementation actually knows how to render (see `meta.ts → appendTypes`).
import { Button, Card, Collapse, Flex, Input, Row, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { FC, memo, useCallback, useRef } from "react";
import { createAppendItem } from "@/components/form-components/registry";
import { Field } from "../shared/field";
import { ComponentTypeSelect } from "../shared/component-type-select";
import { AdvancedJSONEditor } from "../shared/json-editor";
import { setKey } from "../normalize";
import type { JSONList, JSONMap } from "../types";

const AppendItemEditorInner: FC<{
  parentType?: string;
  sub: JSONMap;
  index: number;
  allowedTypes?: readonly string[];
  onChange: (index: number, next: JSONMap) => void;
  onRemove: (index: number) => void;
}> = ({ sub, index, allowedTypes, onChange, onRemove }) => {
  // Keep the newest `sub` in a ref so the nested raw-JSON editor gets a stable
  // callback identity (otherwise React.memo on the child is defeated).
  const subRef = useRef(sub);
  subRef.current = sub;

  const set = (key: string, value: any) => onChange(index, setKey(subRef.current, key, value));

  const commitJson = useCallback(
    (next: JSONMap) => onChange(index, next),
    [index, onChange]
  );

  return (
    <Card size="small" styles={{ body: { padding: 8 } }}>
      <Row gutter={8}>
        <Field label="name" span={6}>
          <Input size="small" value={sub.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="label" span={6}>
          <Input size="small" value={sub.label ?? ""} onChange={(e) => set("label", e.target.value)} />
        </Field>
        <Field label="type" span={6}>
          <ComponentTypeSelect
            value={sub.type}
            allowedTypes={allowedTypes}
            onChange={(v) => set("type", v)}
          />
        </Field>
        <Field label="initialValue" span={6}>
          <Input
            size="small"
            value={sub.initialValue ?? ""}
            onChange={(e) => set("initialValue", e.target.value)}
          />
        </Field>
      </Row>
      <Row gutter={8}>
        <Field label="tooltip" span={24}>
          <Input size="small" value={sub.tooltip ?? ""} onChange={(e) => set("tooltip", e.target.value)} />
        </Field>
      </Row>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "Advanced JSON",
            children: <AdvancedJSONEditor value={sub} onCommit={commitJson} rows={5} />,
          },
        ]}
      />
      <Flex justify="flex-end">
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(index)}>
          Remove
        </Button>
      </Flex>
    </Card>
  );
};

const AppendItemEditor = memo(AppendItemEditorInner);

const AppendEditorInner: FC<{
  parentType?: string;
  list: JSONList;
  allowedTypes?: readonly string[];
  onChange: (list: JSONList) => void;
}> = ({ parentType, list, allowedTypes, onChange }) => {
  const listRef = useRef(list);
  listRef.current = list;

  const handleItemChange = useCallback(
    (index: number, next: JSONMap) => {
      const copy = [...listRef.current];
      copy[index] = next;
      onChange(copy);
    },
    [onChange]
  );

  const handleRemove = useCallback(
    (index: number) => onChange(listRef.current.filter((_, i) => i !== index)),
    [onChange]
  );

  const handleAdd = useCallback(
    () => onChange([...listRef.current, createAppendItem(allowedTypes?.[0])]),
    [allowedTypes, onChange]
  );

  return (
    <Flex vertical gap={6}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          append （{parentType ?? "Nest*"} 的嵌套子字段）
        </Typography.Text>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
          Add
        </Button>
      </Flex>
      {list.map((sub, index) => (
        <AppendItemEditor
          key={index}
          parentType={parentType}
          sub={sub}
          index={index}
          allowedTypes={allowedTypes}
          onChange={handleItemChange}
          onRemove={handleRemove}
        />
      ))}
    </Flex>
  );
};

export const AppendEditor = memo(AppendEditorInner);

export default AppendEditor;

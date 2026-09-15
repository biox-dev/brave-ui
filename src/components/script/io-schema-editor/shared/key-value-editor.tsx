// src/components/script/io-schema-editor/shared/key-value-editor.tsx
import { Collapse, Input, InputNumber, Row } from "antd";
import { FC, memo } from "react";
import { Field } from "./field";
import { AdvancedJSONEditor } from "./json-editor";
import { setKey } from "../normalize";
import type { JSONMap } from "../types";

export type KVField = {
  key: string;
  label: string;
  span?: number;
  number?: boolean;
  placeholder?: string;
};

const KeyValueEditorInner: FC<{
  value: JSONMap;
  onChange: (value: JSONMap) => void;
  fields: KVField[];
}> = ({ value, onChange, fields }) => (
  <>
    <Row gutter={12}>
      {fields.map((field) => (
        <Field key={field.key} label={field.label} span={field.span ?? 8}>
          {field.number ? (
            <InputNumber
              size="small"
              min={0}
              style={{ width: "100%" }}
              value={value[field.key]}
              onChange={(v) => onChange(setKey(value, field.key, v))}
            />
          ) : (
            <Input
              size="small"
              value={value[field.key] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => onChange(setKey(value, field.key, e.target.value))}
            />
          )}
        </Field>
      ))}
    </Row>
    <Collapse
      ghost
      size="small"
      items={[
        {
          key: "adv",
          label: "Advanced JSON",
          children: <AdvancedJSONEditor value={value} onCommit={onChange} rows={5} />,
        },
      ]}
    />
  </>
);

export const KeyValueEditor = memo(KeyValueEditorInner);

/** `resources` block of an io_schema. */
export const RESOURCE_FIELDS: KVField[] = [
  { key: "cpu", label: "cpu", number: true },
  { key: "memory", label: "memory", placeholder: "6GB" },
  { key: "gpu", label: "gpu", number: true },
  { key: "docker", label: "docker", span: 12, placeholder: "quay.io/..." },
  { key: "queue", label: "queue", span: 12 },
];

/** `ui` block of an io_schema (consumed by `buildScriptVisItem`). */
export const UI_FIELDS: KVField[] = [
  { key: "icon", label: "icon", placeholder: "scissors" },
  { key: "color", label: "color", placeholder: "green" },
];

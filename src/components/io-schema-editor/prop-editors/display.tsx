// src/components/script/io-schema-editor/prop-editors/display.tsx
// What the user sees: `text` (divider), `tooltip`, `extra` and `initialValue`.
//
// `initialValue` is deliberately type aware — a `BaseSwitch` wants a boolean, a
// `BaseInputNumber` a number, a `ThreeColorPicker` three colours and everything
// else a free text/JSON value.
import { Col, ColorPicker, Input, InputNumber, Row, Select } from "antd";
import { FC } from "react";
import { Field } from "../shared/field";
import { AdvancedJSONEditor } from "../shared/json-editor";
import { hasDisplayField } from "@/components/form-components/registry";
import { isPlainObject } from "../normalize";
import type { DisplayFieldKey } from "@/components/form-components/registry";
import type { PropEditor, PropEditorProps } from "../types";

const BOOL_OPTIONS = [
  { label: "true", value: true },
  { label: "false", value: false },
];

const ThreeColorInitialValue: FC<PropEditorProps> = ({ item, set }) => {
  const colors: any[] = Array.isArray(item.initialValue) ? item.initialValue : [];
  return (
    <Field label="initialValue (low → high)" span={24}>
      <Row gutter={8}>
        {[0, 1, 2].map((index) => (
          <Col span={8} key={index}>
            <ColorPicker
              style={{ width: "100%" }}
              value={colors[index]}
              allowClear
              onChange={(color: any) => {
                const next = [...colors];
                next[index] = color ? color.toHexString() : undefined;
                set("initialValue", next);
              }}
            />
          </Col>
        ))}
      </Row>
    </Field>
  );
};

const InitialValueEditor: FC<PropEditorProps> = (props) => {
  const { item, set } = props;
  const value = item.initialValue;

  if (item?.type === "ThreeColorPicker") {
    return <ThreeColorInitialValue {...props} />;
  }

  if (item?.type === "BaseSwitch") {
    return (
      <Field label="initialValue">
        <Select
          size="small"
          allowClear
          style={{ width: "100%" }}
          placeholder="true / false"
          value={typeof value === "boolean" ? value : undefined}
          options={BOOL_OPTIONS}
          onChange={(v) => set("initialValue", v)}
        />
      </Field>
    );
  }

  if (item?.type === "BaseInputNumber") {
    return (
      <Field label="initialValue">
        <InputNumber
          size="small"
          style={{ width: "100%" }}
          value={typeof value === "number" ? value : undefined}
          onChange={(v) => set("initialValue", v)}
        />
      </Field>
    );
  }

  // Objects / arrays (e.g. custom presets) cannot be typed into a one line
  // input without destroying them — fall back to a small JSON editor.
  if (isPlainObject(value) || Array.isArray(value)) {
    return (
      <Field label="initialValue (JSON)" span={24}>
        <AdvancedJSONEditor value={value} onCommit={(v) => set("initialValue", v)} rows={4} />
      </Field>
    );
  }

  return (
    <Field label="initialValue">
      <Input
        size="small"
        value={value ?? ""}
        onChange={(e) => set("initialValue", e.target.value)}
      />
    </Field>
  );
};

export const DisplayEditor: PropEditor = ({ item, listKey, index, set, patch }) => {
  const allowed = (field: DisplayFieldKey) => hasDisplayField(item?.type, field);

  return (
    <>
      {allowed("text") && (
        <Row gutter={12}>
          <Field label="text" span={24}>
            <Input
              size="small"
              value={item.text ?? ""}
              placeholder="section title"
              onChange={(e) => set("text", e.target.value)}
            />
          </Field>
        </Row>
      )}

      {(allowed("tooltip") || allowed("extra")) && (
        <Row gutter={12}>
          {allowed("tooltip") && (
            <Field label="tooltip" span={allowed("extra") ? 12 : 24}>
              <Input
                size="small"
                value={item.tooltip ?? ""}
                onChange={(e) => set("tooltip", e.target.value)}
              />
            </Field>
          )}
          {allowed("extra") && (
            <Field label="extra" span={12}>
              <Input
                size="small"
                value={item.extra ?? ""}
                placeholder="说明文字（显示在控件下方）"
                onChange={(e) => set("extra", e.target.value)}
              />
            </Field>
          )}
        </Row>
      )}

      {allowed("initialValue") && (
        <Row gutter={12}>
          <InitialValueEditor item={item} listKey={listKey} index={index} set={set} patch={patch} />
        </Row>
      )}
    </>
  );
};

export default DisplayEditor;

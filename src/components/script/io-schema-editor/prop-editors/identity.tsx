// src/components/script/io-schema-editor/prop-editors/identity.tsx
// `type` / `name` / `label` / `col` — the fields every item has.
import { Input, InputNumber, Row } from "antd";
import { Field } from "../shared/field";
import { ComponentTypeSelect } from "../shared/component-type-select";
import { getComponentMeta } from "@/components/form-components/registry";
import type { PropEditor } from "../types";

export const IdentityEditor: PropEditor = ({ item, listKey, set }) => {
  const isOutput = listKey === "outputs";
  const isLayout = !!getComponentMeta(item?.type)?.layout;

  return (
    <Row gutter={12}>
      <Field label="type">
        {isOutput ? (
          <Input
            size="small"
            value={item.type ?? ""}
            placeholder="file / dir / table"
            onChange={(e) => set("type", e.target.value)}
          />
        ) : (
          <ComponentTypeSelect value={item.type} onChange={(v) => set("type", v)} />
        )}
      </Field>

      <Field label="name">
        <Input
          size="small"
          value={item.name ?? ""}
          placeholder="form field name (unique)"
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>

      {!isOutput && !isLayout && (
        <Field label="label">
          <Input
            size="small"
            value={item.label ?? ""}
            onChange={(e) => set("label", e.target.value)}
          />
        </Field>
      )}

      {!isOutput && (
        <Field label="col" >
          <InputNumber
            size="small"
            min={1}
            max={24}
            style={{ width: "100%" }}
            placeholder="24"
            value={item.col}
            onChange={(v) => set("col", v)}
          />
        </Field>
      )}
    </Row>
  );
};

export default IdentityEditor;

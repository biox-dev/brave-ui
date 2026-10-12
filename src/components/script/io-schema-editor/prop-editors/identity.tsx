// src/components/script/io-schema-editor/prop-editors/identity.tsx
// `type` / `name` / `label` / `col` — the fields every item has.
//
// Outputs are the exception: they are plain output descriptors
// (`{ name, type, role }`) rather than form components, so they get their own
// field set — `type` and `role` are free-form AutoCompletes because the backend
// reads both as raw strings (`role` is the analysis_result key a produced file
// is published under, see backend `nodeOutputRole`).
import { AutoComplete, Input, InputNumber, Row } from "antd";
import { Field } from "../shared/field";
import { ComponentTypeSelect } from "../shared/component-type-select";
import { getComponentMeta } from "@/components/form-components/registry";
import { OUTPUT_ROLE_OPTIONS, OUTPUT_TYPE_OPTIONS } from "./constants";
import type { PropEditor } from "../types";

export const IdentityEditor: PropEditor = ({ item, listKey, set }) => {
  const isOutput = listKey === "outputs";
  const isLayout = !!getComponentMeta(item?.type)?.layout;

  return (
    <Row gutter={12}>
      <Field label="type">
        {isOutput ? (
          <AutoComplete
            size="small"
            style={{ width: "100%" }}
            value={item.type}
            placeholder="file / dir / table"
            options={OUTPUT_TYPE_OPTIONS}
            onChange={(v) => set("type", v)}
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

      {/* `role` only applies to outputs: the analysis_result key the produced
          file is published under (backend defaults it to "DEFAULT"). */}
      {isOutput && (
        <Field label="role">
          <AutoComplete
            size="small"
            style={{ width: "100%" }}
            value={item.role}
            placeholder="DEFAULT / TABLE"
            options={OUTPUT_ROLE_OPTIONS}
            onChange={(v) => set("role", v)}
          />
        </Field>
      )}

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

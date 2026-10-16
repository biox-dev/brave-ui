// src/components/script/io-schema-editor/prop-editors/columns.tsx
// How collected columns are projected onto the form. The arrays are positional:
// `columns[i]` / `modes[i]` / `columns_rules[i]` / `groups[i]` describe the same
// column.
import { Alert, Row, Select } from "antd";
import { Field } from "../shared/field";
import { FLAG_OPTIONS } from "./constants";
import { hasColumnField } from "@/components/form-components/registry";
import type { ColumnFieldKey } from "@/components/form-components/registry";
import type { PropEditor } from "../types";

export const ColumnsEditor: PropEditor = ({ item, set }) => {
  const allowed = (field: ColumnFieldKey) => hasColumnField(item?.type, field);

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        message="以下数组按列顺序一一对应（columns[i] / modes[i] / columns_rules[i]）"
      />
      <Row gutter={12}>
        {allowed("columns") && (
          <Field label="columns">
            <Select
              size="small"
              mode="tags"
              style={{ width: "100%" }}
              placeholder="上游结果中的列名"
              value={item.columns ?? []}
              onChange={(v) => set("columns", v)}
            />
          </Field>
        )}
        {allowed("modes") && (
          <Field label="modes">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="0 = 单选, 1 = 多选"
              value={item.modes ?? []}
              options={FLAG_OPTIONS}
              onChange={(v) => set("modes", v)}
            />
          </Field>
        )}
        {allowed("columns_rules") && (
          <Field label="columns_rules">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="0 = 可选, 1 = 必填"
              value={item.columns_rules ?? []}
              options={FLAG_OPTIONS}
              onChange={(v) => set("columns_rules", v)}
            />
          </Field>
        )}
      </Row>
      {allowed("groups") && (
        <Row gutter={12}>
          <Field label="groups">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="0 = 不显示分组名, 1 = 显示；并据此生成 node_name"
              value={item.groups ?? []}
              options={FLAG_OPTIONS}
              onChange={(v) => set("groups", v)}
            />
          </Field>
        </Row>
      )}
    </>
  );
};

export default ColumnsEditor;

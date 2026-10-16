// src/components/script/io-schema-editor/prop-editors/datasource.tsx
// Where the component gets its options from.
//
// Which inputs are shown is driven by `meta.dataFields`, because not every
// component reads every field — e.g. `dataKey` only matters for the generic
// selects, and `field` only exists on `FilterFieldSelect`.
import { AutoComplete, Input, Row, Tag, Tooltip, Typography } from "antd";
import type { FC } from "react";
import { Field } from "../shared/field";
import { GROUP_FIELD_OPTIONS, GROUP_OPTIONS } from "./constants";
import { hasDataField } from "@/components/form-components/registry";
import type { PropEditorProps } from "../types";
import type { DataFieldKey } from "@/components/form-components/registry";

/**
 * `filter` is an array of `{ name, method }` entries whose `method` is invoked
 * as a function at render time, so it cannot be expressed in JSON. It is
 * therefore display-only here — editing it requires the raw-JSON tab.
 */
const FilterSummary: FC<{ item: PropEditorProps["item"] }> = ({ item }) => {
  const filter = Array.isArray(item.filter) ? item.filter : [];
  return (
    <Field label="filter" span={24}>
      <Tooltip title="filter 里的 method 是函数，无法用 JSON 表达；请用 Advanced JSON 编辑">
        <div style={{ minHeight: 24 }}>
          {filter.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              (none)
            </Typography.Text>
          ) : (
            filter.map((entry: any, i: number) => (
              <Tag key={i} color="blue" style={{ marginInlineEnd: 4 }}>
                {entry?.name ?? "?"}
              </Tag>
            ))
          )}
        </div>
      </Tooltip>
    </Field>
  );
};

export const DatasourceEditor: FC<PropEditorProps> = ({ item, set }) => {
  const allowed = (field: DataFieldKey) => hasDataField(item?.type, field);

  const showDataKey = allowed("dataKey");
  const showGroup = allowed("group") || allowed("groupField");

  return (
    <>
      <Row gutter={12}>
        {showDataKey && (
          <Field label="dataKey" span={showGroup ? 8 : 24}>
            <AutoComplete
              size="small"
              value={item.dataKey}
              style={{ width: "100%" }}
              placeholder="sample_group_list / rank / group_field"
              onChange={(v) => set("dataKey", v)}
            />
          </Field>
        )}

        {allowed("group") && (
          <Field label="group" span={8}>
            <AutoComplete
              size="small"
              value={item.group}
              style={{ width: "100%" }}
              placeholder="group_field"
              options={GROUP_OPTIONS}
              onChange={(v) => set("group", v)}
            />
          </Field>
        )}

        {allowed("groupField") && (
          <Field label="groupField" span={8}>
            <AutoComplete
              size="small"
              value={item.groupField}
              style={{ width: "100%" }}
              placeholder="group_field"
              options={GROUP_FIELD_OPTIONS}
              onChange={(v) => set("groupField", v)}
            />
          </Field>
        )}

        {allowed("field") && (
          <Field label="field" span={showDataKey ? 16 : 24}>
            <Input
              size="small"
              value={item.field ?? ""}
              placeholder="row key used to build the options"
              onChange={(e) => set("field", e.target.value)}
            />
          </Field>
        )}
      </Row>

      {allowed("filter") && (
        <Row gutter={12}>
          <FilterSummary item={item} />
        </Row>
      )}
    </>
  );
};

export default DatasourceEditor;

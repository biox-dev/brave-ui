// src/components/script/io-schema-editor/prop-editors/io.tsx
// How an item binds to an analysis input: `input_type`, `component_id`, `mode`,
// `db` and `resolver.accept_formats`.
import { AutoComplete, Flex, Input, Row, Select, Switch } from "antd";
import { Field } from "../shared/field";
import { FORMAT_OPTIONS, INPUT_TYPE_OPTIONS, MODE_OPTIONS } from "./constants";
import { isPlainObject } from "../normalize";
import type { PropEditor } from "../types";

export const IoEditor: PropEditor = ({ item, set, patch }) => {
  /** `resolver` is nested — rebuild it so we never leave an empty object behind. */
  const setAcceptFormats = (formats: string[]) => {
    const current = isPlainObject(item.resolver) ? item.resolver : {};
    const resolver: Record<string, any> = { ...current };
    if (formats.length) resolver.accept_formats = formats;
    else delete resolver.accept_formats;

    const next = { ...item };
    if (Object.keys(resolver).length) next.resolver = resolver;
    else delete next.resolver;
    patch(next);
  };

  return (
    <>
      <Row gutter={12}>
        <Field label="input_type">
          <AutoComplete
            size="small"
            value={item.input_type}
            style={{ width: "100%" }}
            placeholder="file / sample / dir ..."
            options={INPUT_TYPE_OPTIONS}
            onChange={(v) => set("input_type", v)}
          />
        </Field>
        <Field label="component_id">
          <Input
            size="small"
            value={item.component_id ?? ""}
            placeholder="DEFAULT / TABLE / uuid"
            onChange={(e) => set("component_id", e.target.value)}
          />
        </Field>
        <Field label="mode">
          <AutoComplete
            size="small"
            value={item.mode}
            style={{ width: "100%" }}
            placeholder="none / multiple"
            options={MODE_OPTIONS}
            onChange={(v) => set("mode", v)}
          />
        </Field>
      </Row>

      <Row gutter={12}>
        <Field label="db" span={6}>
          <Flex align="center" gap={8}>
            <Switch size="small" checked={!!item.db} onChange={(v) => set("db", v)} />
          </Flex>
        </Field>
        <Field label="resolver.accept_formats" span={18}>
          <Select
            size="small"
            mode="tags"
            style={{ width: "100%" }}
            tokenSeparators={[","]}
            placeholder="DEFAULT / TABLE"
            value={item?.resolver?.accept_formats ?? []}
            options={FORMAT_OPTIONS}
            onChange={setAcceptFormats}
          />
        </Field>
      </Row>
    </>
  );
};

export default IoEditor;

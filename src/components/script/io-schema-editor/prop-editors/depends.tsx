// src/components/script/io-schema-editor/prop-editors/depends.tsx
// Conditional visibility. The renderer (`form-components/core/depends.ts`)
// accepts three shapes, and this editor round-trips all of them:
//
//   [{ name, value }]      → every condition must match (legacy AND)
//   { and: [ … ] }         → every condition must match (explicit)
//   { or:  [ … ] }         → any condition matches
//   { name, value }        → a single condition
//
// Anything else (deeply nested and/or trees) is handed back to the raw JSON
// editor instead of being silently rewritten.
import { Button, Flex, Input, Popconfirm, Row, Select, Space, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import { Field } from "../shared/field";
import { AdvancedJSONEditor } from "../shared/json-editor";
import type { PropEditor } from "../types";

type DependsMode = "all" | "any" | "and" | "single";

interface DependsRow {
  name: string;
  value: any;
}

const MODE_OPTIONS: { label: string; value: DependsMode }[] = [
  { label: "all of (array, AND)", value: "all" },
  { label: "all of ({ and })", value: "and" },
  { label: "any of ({ or })", value: "any" },
  { label: "single condition", value: "single" },
];

const toRows = (entries: any[]): { rows: DependsRow[]; complex: boolean } => {
  const rows: DependsRow[] = [];
  let complex = false;
  for (const entry of entries) {
    if (entry && typeof entry === "object" && typeof entry.name === "string") {
      rows.push({ name: entry.name, value: entry.value ?? "" });
    } else {
      complex = true;
    }
  }
  return { rows, complex };
};

const parseDepends = (depends: any): { mode: DependsMode; rows: DependsRow[]; complex: boolean } => {
  if (!depends) return { mode: "all", rows: [], complex: false };
  if (Array.isArray(depends)) {
    return { mode: "all", ...toRows(depends) };
  }
  if (Array.isArray(depends.or)) return { mode: "any", ...toRows(depends.or) };
  if (Array.isArray(depends.and)) return { mode: "and", ...toRows(depends.and) };
  if (typeof depends.name === "string") {
    return { mode: "single", rows: [{ name: depends.name, value: depends.value ?? "" }], complex: false };
  }
  return { mode: "all", rows: [], complex: true };
};

const serialize = (mode: DependsMode, rows: DependsRow[]): any => {
  const clean = rows.filter((row) => row.name.trim() !== "");
  if (clean.length === 0) return undefined;
  switch (mode) {
    case "any":
      return { or: clean };
    case "and":
      return { and: clean };
    case "single":
      return clean.length === 1 ? { name: clean[0].name, value: clean[0].value } : clean;
    default:
      return clean;
  }
};

export const DependsEditor: PropEditor = ({ item, set }) => {
  const depends = item.depends;
  const parsed = useMemo(() => parseDepends(depends), [depends]);

  // Nested and/or trees are not representable row-by-row — don't pretend they
  // are, just expose the JSON.
  if (parsed.complex) {
    return (
      <div>
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          条件结构较复杂（嵌套 and/or），请直接编辑 JSON
        </Typography.Text>
        <AdvancedJSONEditor value={depends} onCommit={(v) => set("depends", v)} rows={6} />
      </div>
    );
  }

  const write = (mode: DependsMode, rows: DependsRow[]) =>
    set("depends", serialize(mode, rows));

  return (
    <>
      <Row gutter={12}>
        <Field label="match" span={8}>
          <Select
            size="small"
            style={{ width: "100%" }}
            value={parsed.mode}
            options={MODE_OPTIONS}
            onChange={(mode: DependsMode) => write(mode, parsed.rows)}
          />
        </Field>
        <Field label="conditions" span={16}>
          <Flex vertical gap={6}>
            {parsed.rows.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                无条件 —— 该组件始终显示
              </Typography.Text>
            )}
            {parsed.rows.map((row, i) => (
              <Space.Compact key={i} style={{ width: "100%" }}>
                <Input
                  size="small"
                  style={{ width: "45%" }}
                  placeholder="字段名 (name)"
                  value={row.name}
                  onChange={(e) => {
                    const rows = [...parsed.rows];
                    rows[i] = { ...row, name: e.target.value };
                    write(parsed.mode, rows);
                  }}
                />
                <Input
                  size="small"
                  style={{ width: "45%" }}
                  placeholder="期望值 (value)"
                  value={row.value ?? ""}
                  onChange={(e) => {
                    const rows = [...parsed.rows];
                    rows[i] = { ...row, value: e.target.value };
                    write(parsed.mode, rows);
                  }}
                />
                <Tooltip title="删除该条件">
                  <Popconfirm
                    title="Remove this condition?"
                    onConfirm={() =>
                      write(parsed.mode, parsed.rows.filter((_, index) => index !== i))
                    }
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>
              </Space.Compact>
            ))}
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => write(parsed.mode, [...parsed.rows, { name: "", value: "" }])}
            >
              Add condition
            </Button>
          </Flex>
        </Field>
      </Row>
      <AdvancedJSONEditor value={depends ?? []} onCommit={(v) => set("depends", v)} rows={3} />
    </>
  );
};

export default DependsEditor;

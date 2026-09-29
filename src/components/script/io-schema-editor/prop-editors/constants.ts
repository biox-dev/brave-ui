// src/components/script/io-schema-editor/prop-editors/constants.ts
// Option lists for the structured property editors. Hoisted to module scope so
// memoized rows keep referential equality and antd never re-diffs its dropdowns
// just because a parent re-rendered.
import { ASSAY_ROLE_OPTIONS } from "@/utils/assay-roles";

/** `input_type` values understood by the backend / resolvers. */
export const INPUT_TYPE_OPTIONS = [
  "file",
  "assay",
  "sample",
//   "dir",
//   "value",
//   "string",
//   "number",
//   "bool",
].map((value) => ({ value }));

/** `mode` of a select component. */
export const MODE_OPTIONS = [{ value: "none" }, { value: "multiple" }];

/**
 * `resolver.accept_formats`: the shared assay roles (an assay's role is matched
 * against these) plus the generic DEFAULT / TABLE roles.
 */
export const FORMAT_OPTIONS = [
  ...ASSAY_ROLE_OPTIONS,
  { value: "DEFAULT" },
  { value: "TABLE" },
];

/** `group` — name of the form field holding the selected metadata field. */
export const GROUP_OPTIONS = [
  { value: "group_field" },
  { value: "sites1" },
  { value: "sites2" },
];

/** `groupField` — the metadata column used to group (or compare) samples. */
export const GROUP_FIELD_OPTIONS = [
  { value: "group_field" },
  { value: "sites1" },
  { value: "sites2" },
];

/** 0 / 1 flags used by `modes`, `columns_rules` and `groups`. */
export const FLAG_OPTIONS = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
];

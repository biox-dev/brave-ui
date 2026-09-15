// src/components/form-components/registry/meta.ts
// The catalogue of every selectable form component.
//
// This file intentionally imports **nothing** (no React, no antd, no component
// implementations) so it can be consumed by the lightweight visual editor
// without dragging the whole renderer into the bundle. The component
// implementations are wired to these descriptors in
// `../core/component-map.tsx`.
//
// ⚠️ Keep this table in sync with the `componentMap` keys: a `type` missing here
// is not offered in the editor, and a `type` missing in the map renders as
// "未知类型 xxx".
import type { ComponentMeta } from "./types";

// ---------------------------------------------------------------------------
// Group templates
// ---------------------------------------------------------------------------

/** Plain value input: text / number / switch / color. */
const INPUT_GROUPS = [
  "identity",
//   "io",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Option list / project aware selector (rank, group field, ...). */
const SELECT_GROUPS = [
  "identity",
  "io",
  "datasource",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Sample (or analysis-result) picker that feeds a downstream analysis. */
const SAMPLE_GROUPS = [
  "identity",
  "io",
  "datasource",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Picker whose value comes from a collected analysis result. */
const COLLECTED_GROUPS = [
  "identity",
  "io",
  "datasource",
  "columns",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Repeatable component (`Form.List`) — may nest sub-fields through `append`. */
const NEST_GROUPS = [
  "identity",
  "io",
  "datasource",
  "nest",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Pure parameter block: no file/sample binding, no data source. */
const PARAM_GROUPS = [
  "identity",
  "display",
  "validation",
  "depends",
  "advanced",
] as const;

/** Divider / label only. */
const LAYOUT_GROUPS = ["identity", "display", "advanced"] as const;

/** Child types supported by `append` (everything `Base*` the renderer knows). */
const APPEND_BASIC_FIELDS = [
  "BaseInput",
  "BaseInputNumber",
  "BaseTextAreaNum",
  "BaseSelect",
] as const;

/** Children accepted inside a `NestSelectSampleV2` row. */
const APPEND_V2_FIELDS = [
  "CollectedSampleSelectV2",
  ...APPEND_BASIC_FIELDS,
] as const;

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const COMPONENT_META: readonly ComponentMeta[] = [
  // ------------------------------------------------------------------ basic
  {
    type: "Input",
    label: "Input (text area)",
    category: "basic",
    description: "Multi-line text bound to an input name.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseInput",
    label: "BaseInput (single line)",
    category: "basic",
    description: "Single line text input.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseTextArea",
    label: "BaseTextArea",
    category: "basic",
    description: "Fixed multi-line text area.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseTextAreaNum",
    label: "BaseTextAreaNum (feature list)",
    category: "basic",
    description:
      "Comma separated feature list; shows how many features were entered.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseInputNumber",
    label: "BaseInputNumber",
    category: "basic",
    description: "Numeric input.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseSwitch",
    label: "BaseSwitch",
    category: "basic",
    description: "Boolean switch (true / false).",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "BaseColorPicker",
    label: "BaseColorPicker",
    category: "basic",
    description: "Single colour picker fed by the project palette.",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "ThreeColorPicker",
    label: "ThreeColorPicker (low → high)",
    category: "basic",
    description: "Three colours: low, middle, high. `initialValue` = [c1, c2, c3].",
    groups: INPUT_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },

  // ----------------------------------------------------------------- layout
  {
    type: "Divider",
    label: "Divider (section title)",
    category: "layout",
    description: "Visual section separator, `text` is the title.",
    groups: LAYOUT_GROUPS,
    layout: true,
    defaults: { text: "" },
    displayFields: ["text"],
  },

  // ----------------------------------------------------------------- select
  {
    type: "BaseSelect",
    label: "BaseSelect",
    category: "select",
    description:
      "Generic select. Options come from `dataMap[dataKey]` (or the upstream role in `resolver.accept_formats`).",
    groups: SELECT_GROUPS,
    defaults: { label: "" },
    dataFields: ["dataKey"],
    displayFields: ["tooltip", "initialValue", "extra"],
  },
  {
    type: "GroupSelect",
    label: "GroupSelect (sample groups)",
    category: "select",
    description: "Select over the project's sample group list.",
    groups: SELECT_GROUPS,
    defaults: { label: "" },
    renderProps: { dataKey: "sample_group_list" },
    dataFields: ["dataKey"],
    displayFields: ["tooltip", "initialValue", "extra"],
  },
  {
    type: "SelectAll",
    label: "SelectAll",
    category: "select",
    description:
      "Sample group list with a “Select All” helper when `mode` is `multiple`.",
    groups: SELECT_GROUPS,
    defaults: { label: "" },
    renderProps: { dataKey: "sample_group_list" },
    dataFields: ["dataKey"],
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "RankSelect",
    label: "RankSelect (taxonomy rank)",
    category: "select",
    description: "SGB / SPECIES / GENUS / ... Defaults to `SPECIES`.",
    groups: PARAM_GROUPS,
    defaults: { label: "", initialValue: "SPECIES" },
    renderProps: { dataKey: "rank", mode: undefined, initialValue: "SPECIES" },
    dataFields: ["dataKey"],
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "GroupFieldSelect",
    label: "GroupFieldSelect (metadata field)",
    category: "select",
    description: "Project metadata field used to group samples.",
    groups: PARAM_GROUPS,
    defaults: { label: "", groupField: "group_field" },
    renderProps: { dataKey: "group_field", mode: undefined, initialValue: "group" },
    dataFields: ["dataKey"],
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "FilterFieldSelect",
    label: "FilterFieldSelect",
    category: "select",
    description:
      "Select built from one field of the sample group list; `field` is the row key.",
    groups: PARAM_GROUPS,
    defaults: { label: "", field: "" },
    renderProps: { dataKey: "sample_group_list", mode: undefined },
    dataFields: ["field"],
    displayFields: ["tooltip"],
  },
  {
    type: "MetaphlanCladeSelect",
    label: "MetaphlanCladeSelect",
    category: "select",
    description: "Clade picker loaded from the metaPhlAn clade API.",
    groups: PARAM_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },
  {
    type: "GroupCompareSelect",
    label: "GroupCompareSelect",
    category: "select",
    description:
      "Prevalence comparison between sites1 / sites2 groups (watches `sites1.group` / `sites2.group`).",
    groups: PARAM_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip", "initialValue"],
  },

  // ----------------------------------------------------------------- sample
  {
    type: "SelectSample",
    label: "SelectSample",
    category: "sample",
    description: "Sample picker, optionally grouped by a metadata field.",
    groups: SAMPLE_GROUPS,
    defaults: { label: "" },
    dataFields: ["dataKey", "filter", "group", "groupField"],
    displayFields: ["tooltip"],
  },
  {
    type: "GroupSelectSampleButton",
    label: "GroupSelectSampleButton",
    category: "sample",
    description: "Sample picker plus group shortcut buttons and a group name.",
    groups: SAMPLE_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    displayFields: ["tooltip"],
  },
  {
    type: "NestSelectSample",
    label: "NestSelectSample",
    category: "sample",
    description:
      "Repeatable (`Form.List`) sample picker. Sub-fields are declared in `append`.",
    groups: NEST_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    appendTypes: APPEND_BASIC_FIELDS,
    displayFields: ["tooltip"],
  },
  {
    type: "NestSelectSampleV2",
    label: "NestSelectSampleV2",
    category: "sample",
    description:
      "Repeatable sample picker whose rows hold other collected selectors.",
    groups: NEST_GROUPS,
    defaults: { label: "" },
    appendTypes: APPEND_V2_FIELDS,
    displayFields: ["tooltip"],
  },

  // -------------------------------------------------------------- collected
  {
    type: "CollectedSampleSelect",
    label: "CollectedSampleSelect",
    category: "collected",
    description:
      "Table picker over upstream results, projecting one form field per collected column.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    columnFields: ["columns", "modes", "columns_rules", "groups"],
    appendTypes: APPEND_BASIC_FIELDS,
    displayFields: ["tooltip"],
  },
  {
    type: "CollectedSampleSelectV2",
    label: "CollectedSampleSelectV2",
    category: "collected",
    description:
      "Like CollectedSampleSelect but reading `abundances_meta` and hiding `node_name`.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    columnFields: ["columns", "modes", "columns_rules", "groups"],
    displayFields: ["tooltip"],
  },
  {
    type: "CollectedColumnsSelect",
    label: "CollectedColumnsSelect",
    category: "collected",
    description: "Column picker for collected columns already registered upstream.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: [],
    columnFields: ["columns", "modes", "columns_rules"],
    displayFields: ["tooltip"],
  },
  {
    type: "NestCollectedSampleSelect",
    label: "NestCollectedSampleSelect",
    category: "collected",
    description: "Repeatable CollectedSampleSelect.",
    groups: NEST_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    columnFields: ["columns", "modes", "columns_rules", "groups"],
    appendTypes: APPEND_BASIC_FIELDS,
    displayFields: ["tooltip"],
  },
  {
    type: "NestCollectedColumnsSelect",
    label: "NestCollectedColumnsSelect",
    category: "collected",
    description:
      "Repeatable `{ column, value }` rows over the columns collected upstream.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    displayFields: ["tooltip"],
  },
  {
    type: "CollectedGroupSelectSampleButton",
    label: "CollectedGroupSelectSampleButton",
    category: "collected",
    description:
      "Collected table picker with per-column group buttons + group name/colour.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    columnFields: ["columns", "modes"],
    displayFields: ["tooltip"],
  },
  {
    type: "CollectedGroupSelectSampleButton2",
    label: "CollectedGroupSelectSampleButton2",
    category: "collected",
    description: "Collected column picker bound to the analysis result id.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: ["filter", "group", "groupField"],
    displayFields: ["tooltip"],
  },
  {
    type: "CollectedSimplpeGroupSelect",
    label: "CollectedSimplpeGroupSelect",
    category: "collected",
    description: "Group name + colour for every collected column.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: [],
    columnFields: ["columns"],
    displayFields: ["tooltip"],
  },
  {
    type: "SimplpeGroupSelect",
    label: "SimplpeGroupSelect",
    category: "collected",
    description: "Single group name + colour pair.",
    groups: COLLECTED_GROUPS,
    defaults: { label: "" },
    dataFields: [],
    displayFields: ["tooltip"],
  },

  // ----------------------------------------------------------------- params
  {
    type: "DifferenceAnalysisConditions",
    label: "DifferenceAnalysisConditions",
    category: "params",
    description:
      "Diff-analysis parameters block (sig type / sig threshold / effect threshold).",
    groups: PARAM_GROUPS,
    defaults: { label: "" },
    dataFields: [],
    displayFields: [],
  },
  {
    type: "HeatmapParams",
    label: "HeatmapParams",
    category: "params",
    description:
      "Heatmap output parameters block (title / size / clustering / labels).",
    groups: PARAM_GROUPS,
    defaults: { label: "" },
    dataFields: [],
    displayFields: [],
  },
];

/** `type` → descriptor. */
export const COMPONENT_META_BY_TYPE: Record<string, ComponentMeta> =
  Object.fromEntries(COMPONENT_META.map((meta) => [meta.type, meta]));

/** Category display order + labels for the type picker. */
export const COMPONENT_CATEGORY_LABELS: Record<
  ComponentMeta["category"],
  string
> = {
  basic: "Basic",
  layout: "Layout",
  select: "Select",
  sample: "Sample",
  collected: "Collected",
  params: "Params",
};

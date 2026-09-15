// src/components/form-components/registry/types.ts
// Shared contract between the *renderer* (`form-components`) and the *editor*
// (`script/io-schema-editor`).
//
// A form-json item is a loose JSON object. Different `type`s accept completely
// different properties (a `BaseInput` has no `columns`, a
// `CollectedSampleSelect` has no `text`, ...). `ComponentMeta` is the single
// place where that knowledge lives: the renderer uses it to pick the component
// implementation, the editor uses it to decide *which property groups* to show.

export type JSONMap = Record<string, any>;
export type JSONList = JSONMap[];

/** Grouping used by the component-type picker. */
export type ComponentCategory =
  | "basic"
  | "layout"
  | "select"
  | "sample"
  | "collected"
  | "params";

/**
 * A logical block of properties. `ComponentMeta.groups` lists the blocks an item
 * of that type supports; the editor renders exactly those, in this order.
 *
 * - `identity`   type / name / label / col
 * - `io`         input_type / component_id / mode / db / accept_formats
 * - `datasource` dataKey / filter / group / groupField / analysisResultId / field
 * - `columns`    columns / modes / columns_rules / groups
 * - `nest`       append (nested sub-fields, used by `Nest*` components)
 * - `display`    tooltip / initialValue / extra / text
 * - `validation` required (+ message)
 * - `depends`    conditional visibility
 * - `advanced`   raw JSON escape hatch
 */
export type PropGroupKey =
  | "identity"
  | "io"
  | "datasource"
  | "columns"
  | "nest"
  | "display"
  | "validation"
  | "depends"
  | "advanced";

/** Rendering order of the property groups. */
export const PROP_GROUP_ORDER: readonly PropGroupKey[] = [
  "identity",
  "io",
  "datasource",
  "columns",
  "nest",
  "display",
  "validation",
  "depends",
  "advanced",
];

export const PROP_GROUP_LABELS: Record<PropGroupKey, string> = {
  identity: "Basic",
  io: "Input binding",
  datasource: "Data source",
  columns: "Collected columns",
  nest: "Nested fields (append)",
  display: "Display",
  validation: "Validation",
  depends: "Condition (depends)",
  advanced: "Raw JSON",
};

/**
 * Fields of the `datasource` group. Which ones a component actually honours
 * depends on its implementation, hence the per-type `dataFields` list.
 */
export type DataFieldKey =
  | "dataKey"
  | "field"
  | "filter"
  | "group"
  | "groupField";

/** Fields of the `display` group. */
export type DisplayFieldKey = "text" | "tooltip" | "initialValue" | "extra";

/**
 * Fields of the `columns` group — the flags describing how each collected
 * column is projected onto the form.
 */
export type ColumnFieldKey = "columns" | "modes" | "columns_rules" | "groups";

export interface ComponentMeta {
  /** Key used in `componentMap` and in an io_schema item's `type`. */
  readonly type: string;
  /** Human readable name used in tooltips / option lists. */
  readonly label: string;
  readonly category: ComponentCategory;
  /** One line explanation shown in the type picker. */
  readonly description?: string;
  /** Property groups rendered by `IOSchemaEditor` for this type. */
  readonly groups: readonly PropGroupKey[];
  /** Fields applied when the editor creates a brand new item. */
  readonly defaults?: JSONMap;
  /**
   * Extra props handed to the component by `ComponentsRender` on top of the
   * item itself (the item always wins, see `ComponentsRender`).
   * e.g. `{ dataKey: "rank", initialValue: "SPECIES" }`.
   */
  readonly renderProps?: JSONMap;
  /** `datasource` fields this component reads. Empty → no data source block. */
  readonly dataFields?: readonly DataFieldKey[];
  /** `display` fields this component reads. */
  readonly displayFields?: readonly DisplayFieldKey[];
  /** `columns` fields this component reads (per collected column). */
  readonly columnFields?: readonly ColumnFieldKey[];
  /** Allowed `type`s for an `append` child. Empty = nesting not supported. */
  readonly appendTypes?: readonly string[];
  /** Layout-only component (no `name` / form binding). */
  readonly layout?: boolean;
}

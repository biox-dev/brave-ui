// src/components/form-components/registry/index.ts
// Public (dependency-free) API of the form-component catalogue.
//
// Consumed by
//   • `form-components/core/component-map.tsx`  (type → implementation)
//   • `script/io-schema-editor`                 (type → editable properties)
import type { JSONList, JSONMap } from "./types";
import {
  COMPONENT_CATEGORY_LABELS,
  COMPONENT_META,
  COMPONENT_META_BY_TYPE,
} from "./meta";
import { PROP_GROUP_ORDER } from "./types";
import type { ComponentMeta, PropGroupKey } from "./types";

export * from "./types";
export { COMPONENT_CATEGORY_LABELS, COMPONENT_META, COMPONENT_META_BY_TYPE };

/** Every known `type`, in catalogue order. */
export const FORM_COMPONENT_TYPES: string[] = COMPONENT_META.map(
  (meta) => meta.type
);

/** Default `type` used when a list gets its first item. */
export const DEFAULT_COMPONENT_TYPE = "BaseInput";

export const getComponentMeta = (type?: string): ComponentMeta | undefined =>
  type ? COMPONENT_META_BY_TYPE[type] : undefined;

/** Property groups of `type`, in render order. */
export const getPropGroups = (type?: string): PropGroupKey[] => {
  const groups = getComponentMeta(type)?.groups ?? [];
  return PROP_GROUP_ORDER.filter((group) => groups.includes(group));
};

export const hasPropGroup = (type: string | undefined, group: PropGroupKey) =>
  (getComponentMeta(type)?.groups ?? []).includes(group);

export const hasDataField = (
  type: string | undefined,
  field: NonNullable<ComponentMeta["dataFields"]>[number]
) => (getComponentMeta(type)?.dataFields ?? []).includes(field);

export const hasDisplayField = (
  type: string | undefined,
  field: NonNullable<ComponentMeta["displayFields"]>[number]
) => (getComponentMeta(type)?.displayFields ?? []).includes(field);

export const hasColumnField = (
  type: string | undefined,
  field: NonNullable<ComponentMeta["columnFields"]>[number]
) => (getComponentMeta(type)?.columnFields ?? []).includes(field);

/** Flat antd options, e.g. `[{ label: "BaseInput", value: "BaseInput" }]`. */
export const componentTypeOptions = COMPONENT_META.map((meta) => ({
  label: meta.type,
  value: meta.type,
  // antd renders this as secondary text inside the dropdown.
  title: meta.description,
}));

/** Grouped antd options, used by the component-type picker. */
export const groupedComponentTypeOptions = (
  Object.keys(COMPONENT_CATEGORY_LABELS) as ComponentMeta["category"][]
).map((category) => ({
  label: COMPONENT_CATEGORY_LABELS[category],
  options: COMPONENT_META.filter((meta) => meta.category === category).map(
    (meta) => ({
      label: meta.type,
      value: meta.type,
      title: meta.description,
    })
  ),
}));

/** Restrict the picker to the children a parent accepts. */
export const componentTypeOptionsFor = (
  allowed?: readonly string[]
): { label: string; value: string }[] =>
  (allowed && allowed.length
    ? allowed.map((type) => getComponentMeta(type)).filter(Boolean)
    : COMPONENT_META
  ).map((meta) => ({
    label: meta!.type,
    value: meta!.type,
    title: meta!.description,
  }));

/** `type` → the component that renders it (wired up in `core/component-map`). */

/**
 * Build a fresh item. `listKey === "outputs"` produces an output descriptor
 * (`{ name, type: "file" }`) instead of a form component.
 */
export const createSchemaItem = (
  type: string = DEFAULT_COMPONENT_TYPE,
  listKey: string = "inputs"
): JSONMap => {
  if (listKey === "outputs") return { name: "", type: "file" };
  const meta = getComponentMeta(type) ?? getComponentMeta(DEFAULT_COMPONENT_TYPE)!;
  const base: JSONMap = { name: "" };
  if (!meta.layout) base.label = "";
  return { ...base, ...meta.defaults, type: meta.type };
};

/** Fresh `append` child. */
export const createAppendItem = (type: string = DEFAULT_COMPONENT_TYPE): JSONMap =>
  createSchemaItem(type, "inputs");

/** `true` when the item may declare nested `append` sub-fields. */
export const supportsAppend = (type?: string) =>
  hasPropGroup(type, "nest");

/** Types offered as `append` children of `type` (falls back to all `Base*`). */
export const appendTypeOptions = (type?: string) =>
  componentTypeOptionsFor(getComponentMeta(type)?.appendTypes);

/** Every name declared by a list — handy for duplicate detection. */
export const collectItemNames = (list: JSONList): string[] =>
  list.map((item) => item?.name).filter((name): name is string => !!name);

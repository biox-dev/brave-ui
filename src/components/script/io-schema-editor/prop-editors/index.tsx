// src/components/script/io-schema-editor/prop-editors/index.tsx
// Property-group registry: `PropGroupKey` → editor component.
//
// Add a property to a component type in three steps:
//   1. declare the group (+ field) in `form-components/registry/meta.ts`
//   2. render it here (or extend the group editor)
//   3. consume it in `form-components` — nothing else in the editor changes.
import { FC } from "react";
import { getPropGroups } from "@/components/form-components/registry";
import type { PropGroupKey } from "@/components/form-components/registry";
import { IdentityEditor } from "./identity";
import { IoEditor } from "./io";
import { DatasourceEditor } from "./datasource";
import { ColumnsEditor } from "./columns";
import { NestEditor } from "./nest";
import { DisplayEditor } from "./display";
import { ValidationEditor } from "./validation";
import { DependsEditor } from "./depends";
import { AdvancedEditor } from "./advanced";
import type { PropEditor, PropEditorProps } from "../types";

export const PROP_EDITORS: Record<PropGroupKey, PropEditor> = {
  identity: IdentityEditor,
  io: IoEditor,
  datasource: DatasourceEditor,
  columns: ColumnsEditor,
  nest: NestEditor,
  display: DisplayEditor,
  validation: ValidationEditor,
  depends: DependsEditor,
  advanced: AdvancedEditor,
};

/** Groups that live in a collapsible panel instead of inline. */
export const COLLAPSED_GROUPS: readonly PropGroupKey[] = ["depends", "advanced"];

/**
 * Fallback for a `type` that is not (yet) in the catalogue — e.g. a component
 * added by a newer backend. Show the generic property set so the item stays
 * editable instead of rendering an empty card.
 */
const FALLBACK_GROUPS: readonly PropGroupKey[] = [
  "identity",
  "io",
  "datasource",
  "display",
  "validation",
  "depends",
  "advanced",
];

/** Property groups that apply to a given list entry. */
export const itemPropGroups = (
  listKey: string,
  type: string | undefined
): PropGroupKey[] => {
  // Outputs are plain `{ name, type }` descriptors, not form components.
  if (listKey === "outputs") return ["identity", "advanced"];
  const groups = getPropGroups(type);
  return groups.length ? groups : [...FALLBACK_GROUPS];
};

export const PropGroupSection: FC<PropEditorProps & { group: PropGroupKey }> = ({
  group,
  ...rest
}) => {
  const Editor = PROP_EDITORS[group];
  return <Editor {...rest} />;
};

/** Renders every inline (non-collapsed) group of an item. */
export const InlinePropGroups: FC<PropEditorProps & { groups: PropGroupKey[] }> = ({
  groups,
  ...rest
}) => (
  <>
    {groups
      .filter((group) => !COLLAPSED_GROUPS.includes(group))
      .map((group) => (
        <PropGroupSection key={group} group={group} {...rest} />
      ))}
  </>
);

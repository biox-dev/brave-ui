// src/components/script/io-schema-editor/prop-editors/nest.tsx
// `append` — the nested sub-fields of a repeatable (`Nest*`) component. The
// selectable child types come from `meta.appendTypes`, because a parent only
// knows how to render the component types hard-coded in its implementation.
import { AppendEditor } from "../editors/append-editor";
import { getComponentMeta } from "@/components/form-components/registry";
import type { PropEditor } from "../types";

const NO_APPEND: never[] = [];

export const NestEditor: PropEditor = ({ item, set }) => {
  const meta = getComponentMeta(item?.type);
  return (
    <AppendEditor
      parentType={item?.type}
      allowedTypes={meta?.appendTypes}
      list={Array.isArray(item?.append) ? item.append : NO_APPEND}
      onChange={(next) => set("append", next)}
    />
  );
};

export default NestEditor;

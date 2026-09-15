// src/components/script/io-schema-editor/types.ts
import type { FC } from "react";
import type {
  JSONList,
  JSONMap,
  PropGroupKey,
} from "@/components/form-components/registry";

export type { JSONList, JSONMap, PropGroupKey };

/** Lists an io_schema is made of (`scatter` / `gather` are edited as raw JSON). */
export const LIST_KEYS = ["inputs", "params", "outputs"] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export const isListKey = (value: string): value is ListKey =>
  (LIST_KEYS as readonly string[]).includes(value);

export interface IOSchemaEditorProps {
  value?: any;
  onChange?: (value: JSONMap) => void;
}

/**
 * Everything a property-group editor needs. Handlers are intentionally narrow:
 * `set` removes a key when the value is empty so the emitted JSON stays clean.
 */
export interface PropEditorProps {
  /** The form-json item being edited. */
  item: JSONMap;
  /** `inputs` | `params` | `outputs` — behaviour differs for outputs. */
  listKey: string;
  /** Position inside the list (used for React keys / disabled arrows). */
  index: number;
  /** Write a single top-level key; empty values delete the key. */
  set: (key: string, value: any) => void;
  /** Replace the whole item (used by rules / depends / raw JSON editors). */
  patch: (next: JSONMap) => void;
}

export type PropEditor = FC<PropEditorProps>;

/** One rendered block of the item card. */
export interface PropGroupDescriptor {
  key: PropGroupKey;
  label: string;
  editor: PropEditor;
}

// src/components/script/io-schema-editor/normalize.ts
// Coercion helpers for `io_schema`. Pure functions, no React — kept separate so
// both the editor and its callers (`create-or-update-script.tsx`) can use them.
import type { JSONMap } from "./types";

export const DEFAULT_RULE_MESSAGE = "This field cannot be empty!";

export const isPlainObject = (value: any): value is JSONMap =>
  value != null && typeof value === "object" && !Array.isArray(value);

export const isEmptyValue = (value: any) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** Accepts an object, a JSON string, or garbage; always returns an object. */
export const safeParse = (raw: any): JSONMap => {
  if (isPlainObject(raw)) return raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

/** Coerce an io_schema (object OR legacy JSON string) into a complete shape. */
export const normalizeIOSchema = (raw: any): JSONMap => {
  const parsed = safeParse(raw);
  return {
    ...parsed,
    inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
    params: Array.isArray(parsed.params) ? parsed.params : [],
    outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
    resources: isPlainObject(parsed.resources) ? parsed.resources : {},
    ui: isPlainObject(parsed.ui) ? parsed.ui : {},
  };
};

export const isRequired = (item: JSONMap) =>
  Array.isArray(item?.rules) && item.rules.some((rule: any) => rule?.required);

export const requiredMessage = (item: JSONMap): string =>
  (Array.isArray(item?.rules)
    ? item.rules.find((rule: any) => rule?.required)?.message
    : "") ?? "";

/** Toggle the `required` rule while preserving every other rule. */
export const withRequired = (item: JSONMap, required: boolean): JSONMap => {
  const rules = Array.isArray(item.rules) ? [...item.rules] : [];
  const cleaned = rules.filter((rule: any) => !rule?.required);
  if (required) {
    cleaned.unshift({ required: true, message: DEFAULT_RULE_MESSAGE });
  }
  const next: JSONMap = { ...item };
  if (cleaned.length) next.rules = cleaned;
  else delete next.rules;
  return next;
};

/** Shallow `set` that deletes the key for empty values. */
export const setKey = (
  item: JSONMap,
  key: string,
  value: any
): JSONMap => {
  const next: JSONMap = { ...item };
  if (isEmptyValue(value)) delete next[key];
  else next[key] = value;
  return next;
};

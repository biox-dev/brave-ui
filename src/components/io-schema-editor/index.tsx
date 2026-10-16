// src/components/script/io-schema-editor/index.tsx
// Visual builder for a script's `io_schema`.
//
// `io_schema` is what the backend (WorkflowService.GetScriptFormJSONByID /
// GetFormJSONByWorkflowID) reads to generate the analysis `formJson`:
//
//   { "inputs": [...], "params": [...], "outputs": [...], "resources": {...}, "ui": {...} }
//
// The interesting part is that *different component types accept different
// properties*. That knowledge lives in `form-components/registry/meta.ts`; this
// component only picks the property groups of the selected `type` and renders
// them (`prop-editors/`).
//
// This component is a controlled antd Form field (value/onChange) and always
// emits a plain object. Pair it with `normalizeIOSchema` on load so both object
// and legacy JSON-string values are accepted.
import { Button, Tabs, Tooltip } from "antd";
import { UndoOutlined } from "@ant-design/icons";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListEditor } from "./editors/list-editor";
import { AdvancedJSONEditor } from "./shared/json-editor";
import {
  KeyValueEditor,
  RESOURCE_FIELDS,
  UI_FIELDS,
} from "./shared/key-value-editor";
import { normalizeIOSchema } from "./normalize";
import { LIST_KEYS } from "./types";
import type { IOSchemaEditorProps, JSONList, JSONMap } from "./types";

/**
 * Keystrokes only mutate a local draft; the value is pushed back to the
 * surrounding antd Form on a short debounce. Without this, every character
 * re-rendered the whole form (including any `shouldUpdate` JSON preview) and
 * re-serialized the entire schema.
 */
const COMMIT_DEBOUNCE_MS = 250;

const IOSchemaEditor: FC<IOSchemaEditorProps> = ({ value, onChange }) => {
  const [schema, setSchema] = useState<JSONMap>(() => normalizeIOSchema(value));
  const [activeTab, setActiveTab] = useState("inputs");

  // The schema as it was last handed to us from the outside (form load /
  // external reset). "Restore" puts the draft back to this snapshot, i.e.
  // discards every local edit made since the schema was loaded.
  const originalRef = useRef<JSONMap | undefined>(undefined);
  if (!originalRef.current) originalRef.current = normalizeIOSchema(value);

  // Drives the Restore button's enabled state. Kept as its own flag instead of a
  // deep compare against `originalRef`, so we never serialize the schema to know
  // whether there is anything to undo.
  const [dirty, setDirty] = useState(false);

  // Mirrors `schema` so debounced/stable callbacks always read the latest draft
  // without being re-created on every keystroke.
  const schemaRef = useRef(schema);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The exact object we last pushed upstream: when the same reference comes back
  // through `value` we must not re-seed the draft (that would drop in-flight
  // keystrokes and remount every row).
  const emittedRef = useRef<any>(undefined);
  const timerRef = useRef<number | undefined>(undefined);

  const commitNow = useCallback(() => {
    const next = schemaRef.current;
    emittedRef.current = next;
    onChangeRef.current?.(next);
  }, []);

  const flush = useCallback(() => {
    // Nothing pending → do not push a value on unmount, or merely opening and
    // closing the form would mark the field as changed.
    if (timerRef.current === undefined) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    commitNow();
  }, [commitNow]);

  const scheduleCommit = useCallback(() => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      commitNow();
    }, COMMIT_DEBOUNCE_MS);
  }, [commitNow]);

  // Push the last pending edit before unmounting so nothing is lost.
  useEffect(() => () => flush(), [flush]);

  // Adopt genuinely external values only (initial load / reset). A plain
  // reference check replaces the `JSON.stringify(value)` dependency that used to
  // run — and serialize the whole schema — on every single render.
  useEffect(() => {
    if (value === emittedRef.current) return;
    emittedRef.current = undefined;
    const next = normalizeIOSchema(value);
    // A genuinely external value becomes the new restore point.
    originalRef.current = next;
    schemaRef.current = next;
    setSchema(next);
    setDirty(false);
  }, [value]);

  const update = useCallback(
    (patch: (current: JSONMap) => JSONMap) => {
      const next = patch(schemaRef.current);
      schemaRef.current = next;
      setSchema(next);
      setDirty(true);
      scheduleCommit();
    },
    [scheduleCommit]
  );

  const setList = useCallback(
    (listKey: string, list: JSONList) =>
      update((current) => ({ ...current, [listKey]: list })),
    [update]
  );

  // One stable handler per list: unchanged lists keep their array reference, so
  // their memoized <ListEditor> is skipped entirely.
  const listHandlers = useMemo(
    () =>
      Object.fromEntries(
        LIST_KEYS.map((key) => [key, (list: JSONList) => setList(key, list)])
      ) as Record<(typeof LIST_KEYS)[number], (list: JSONList) => void>,
    [setList]
  );

  const handleResourcesChange = useCallback(
    (resources: JSONMap) => update((current) => ({ ...current, resources })),
    [update]
  );

  const handleUiChange = useCallback(
    (ui: JSONMap) => update((current) => ({ ...current, ui })),
    [update]
  );

  const handleJsonCommit = useCallback(
    (raw: any) => update(() => normalizeIOSchema(raw)),
    [update]
  );

  // Cancel every pending/local change: drop the debounce, re-seed the draft from
  // the last externally-supplied schema and push that same object upstream so the
  // surrounding form is restored too (otherwise submitting would still save the
  // edited value).
  const handleRestore = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const next = normalizeIOSchema(originalRef.current);
    schemaRef.current = next;
    setSchema(next);
    setDirty(false);
    emittedRef.current = next;
    onChangeRef.current?.(next);
  }, []);

  const items = useMemo(
    () => [
      ...LIST_KEYS.map((key) => ({
        key,
        label: `${key[0].toUpperCase()}${key.slice(1)} (${schema[key].length})`,
        children: (
          <ListEditor listKey={key} list={schema[key]} onChange={listHandlers[key]} />
        ),
      })),
      {
        key: "resources",
        label: "Resources",
        children: (
          <KeyValueEditor
            value={schema.resources}
            onChange={handleResourcesChange}
            fields={RESOURCE_FIELDS}
          />
        ),
      },
      {
        key: "ui",
        label: "UI",
        children: (
          <KeyValueEditor value={schema.ui} onChange={handleUiChange} fields={UI_FIELDS} />
        ),
      },
      {
        key: "json",
        label: "JSON",
        children: <AdvancedJSONEditor value={schema} rows={18} onCommit={handleJsonCommit} />,
      },
    ],
    [schema, listHandlers, handleResourcesChange, handleUiChange, handleJsonCommit]
  );

  return (
    <Tabs
      size="small"
      activeKey={activeTab}
      onChange={setActiveTab}
      items={items}
      tabBarExtraContent={
        <Tooltip title="取消修改：丢弃本地编辑，恢复到加载时的 io_schema">
          <Button
            size="small"
            color="cyan"
            variant="solid"
            icon={<UndoOutlined />}
            disabled={!dirty}
            onClick={handleRestore}
          >
            恢复
          </Button>
        </Tooltip>
      }
    />
  );
};

export default IOSchemaEditor;

// --------------------------------------------------------------------------
// Backwards compatible re-exports: `create-or-update-script.tsx` imports
// `normalizeIOSchema` from "./io-schema-editor".
// --------------------------------------------------------------------------
export { normalizeIOSchema } from "./normalize";
export { FORM_COMPONENT_TYPES } from "@/components/form-components/registry";
export { LIST_KEYS } from "./types";
export { getPropGroups, getComponentMeta } from "@/components/form-components/registry";

// src/components/script/io-schema-editor.tsx
// Visual builder for a script's `io_schema`.
//
// `io_schema` is what the backend (WorkflowService.GetScriptFormJSONByID /
// GetFormJSONByWorkflowID) reads to generate the analysis `formJson`:
//
//   { "inputs": [...], "params": [...], "outputs": [...], "resources": {...}, "ui": {...} }
//
// Every entry in `inputs`/`params` is itself a form-json item, e.g.
//
//   {
//     "name": "x_input", "label": "X input", "type": "CollectedSampleSelect",
//     "input_type": "file", "db": true, "component_id": "TABLE",
//     "resolver": { "accept_formats": ["TABLE"] },
//     "columns": ["sample_vars"], "modes": [0], "columns_rules": [0],
//     "rules": [{ "required": true, "message": "This field cannot be empty!" }]
//   }
//
// This component is a controlled antd Form field (value/onChange) and always
// emits a plain object. Pair it with `normalizeIOSchema` on load so both object
// and legacy JSON-string values are accepted.
import {
  AutoComplete,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Flex,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  FC,
  Fragment,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Keep in sync with the `componentMap` in ../form-components/index.tsx.
// A `type` that is not present there renders as "未知类型 xxx".
export const FORM_COMPONENT_TYPES = [
  // basic
  "Input",
  "BaseInput",
  "BaseInputNumber",
  "BaseSwitch",
  "BaseTextArea",
  "BaseTextAreaNum",
  "BaseSelect",
  "BaseColorPicker",
  "ThreeColorPicker",
  "Divider",
  // sample / file pickers
  "SelectSample",
  "SelectAll",
  "NestSelectSample",
  "NestSelectSampleV2",
  "GroupSelect",
  "GroupSelectSampleButton",
  "GroupCompareSelect",
  "FilterFieldSelect",
  // collected (analysis-result driven)
  "CollectedSampleSelect",
  "CollectedSampleSelectV2",
  "CollectedColumnsSelect",
  "NestCollectedSampleSelect",
  "NestCollectedColumnsSelect",
  "CollectedGroupSelectSampleButton",
  "CollectedGroupSelectSampleButton2",
  "CollectedSimplpeGroupSelect",
  "SimplpeGroupSelect",
  // project aware
  "RankSelect",
  "GroupFieldSelect",
  "MetaphlanCladeSelect",
  "DifferenceAnalysisConditions",
  "HeatmapParams",
];

const INPUT_TYPES = ["file", "sample", "dir", "value", "string", "number", "bool"];
const MODE_OPTIONS = [{ value: "none" }, { value: "multiple" }];
const DEFAULT_RULE_MESSAGE = "This field cannot be empty!";

type JSONMap = Record<string, any>;
type JSONList = JSONMap[];

type KVField = {
  key: string;
  label: string;
  span?: number;
  number?: boolean;
  placeholder?: string;
};

// Stable option/field arrays. Hoisted to module scope so memoized rows keep
// referential equality and antd never has to re-diff its dropdowns on render.
const COMPONENT_TYPE_OPTIONS = FORM_COMPONENT_TYPES.map((type) => ({
  label: type,
  value: type,
}));
const INPUT_TYPE_OPTIONS = INPUT_TYPES.map((value) => ({ value }));
const FORMAT_OPTIONS = [{ value: "DEFAULT" }, { value: "TABLE" }];
const GROUP_OPTIONS = [{ value: "group_field" }, { value: "sites1" }, { value: "sites2" }];
const GROUP_FIELD_OPTIONS = [{ value: "group_field" }];
const FLAG_OPTIONS = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
];
const RESOURCE_FIELDS: KVField[] = [
  { key: "cpu", label: "cpu", number: true },
  { key: "memory", label: "memory", placeholder: "6GB" },
  { key: "gpu", label: "gpu", number: true },
  { key: "docker", label: "docker", span: 12, placeholder: "quay.io/..." },
  { key: "queue", label: "queue", span: 12 },
];
const UI_FIELDS: KVField[] = [
  { key: "icon", label: "icon", placeholder: "scissors" },
  { key: "color", label: "color", placeholder: "green" },
];
const NO_APPEND: JSONList = [];

const isPlainObject = (value: any): value is JSONMap =>
  value != null && typeof value === "object" && !Array.isArray(value);

const safeParse = (raw: any): JSONMap => {
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
    resources:
      parsed.resources && typeof parsed.resources === "object" ? parsed.resources : {},
    ui: parsed.ui && typeof parsed.ui === "object" ? parsed.ui : {},
  };
};

const isEmptyValue = (value: any) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const isRequired = (item: JSONMap) =>
  Array.isArray(item?.rules) && item.rules.some((rule: any) => rule?.required);

const withRequired = (item: JSONMap, required: boolean): JSONMap => {
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

// ---------- presentational helpers ----------

const Field: FC<{ label: string; span?: number; children: ReactNode }> = ({
  label,
  span = 8,
  children,
}) => (
  <Col span={span}>
    <div style={{ marginBottom: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  </Col>
);

const ComponentTypeSelect: FC<{
  value?: string;
  onChange?: (value: any) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <Select
    size="small"
    showSearch
    allowClear
    value={value}
    placeholder={placeholder ?? "Select component type"}
    style={{ width: "100%" }}
    options={COMPONENT_TYPE_OPTIONS}
    onChange={onChange}
  />
);

// Raw JSON editor used for "advanced" escape hatches (whole item / resources / ui).
const AdvancedJSONEditor: FC<{
  value: any;
  onCommit: (value: any) => void;
  rows?: number;
}> = ({ value, onCommit, rows = 8 }) => {
  // Local text is the source of truth while focused, so an upstream re-render
  // can never clobber what the user is typing. It also removes the per-render
  // JSON.stringify(value) that used to run on every keystroke.
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string>();
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(JSON.stringify(value ?? {}, null, 2));
    setError(undefined);
  }, [value]);

  return (
    <>
      <Input.TextArea
        value={text}
        rows={rows}
        spellCheck={false}
        status={error ? "error" : undefined}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          try {
            const parsed = text.trim() ? JSON.parse(text) : {};
            setError(undefined);
            onCommit(parsed);
          } catch (e: any) {
            setError(e?.message);
          }
        }}
      />
      {error && (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          {error}
        </Typography.Text>
      )}
    </>
  );
};

// ---------- append (nested sub-fields of Nest* components) ----------

const AppendItemEditorInner: FC<{
  sub: JSONMap;
  index: number;
  onChange: (index: number, next: JSONMap) => void;
  onRemove: (index: number) => void;
}> = ({ sub, index, onChange, onRemove }) => {
  const subRef = useRef(sub);
  subRef.current = sub;

  const set = (key: string, value: any) => {
    const next: JSONMap = { ...subRef.current };
    if (isEmptyValue(value)) delete next[key];
    else next[key] = value;
    onChange(index, next);
  };

  const commitJson = useCallback(
    (next: JSONMap) => onChange(index, next),
    [index, onChange]
  );

  return (
    <Card size="small" styles={{ body: { padding: 8 } }}>
      <Row gutter={8}>
        <Field label="name" span={6}>
          <Input size="small" value={sub.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="label" span={6}>
          <Input size="small" value={sub.label ?? ""} onChange={(e) => set("label", e.target.value)} />
        </Field>
        <Field label="type" span={6}>
          <ComponentTypeSelect value={sub.type} onChange={(v) => set("type", v)} />
        </Field>
        <Field label="initialValue" span={6}>
          <Input
            size="small"
            value={sub.initialValue ?? ""}
            onChange={(e) => set("initialValue", e.target.value)}
          />
        </Field>
      </Row>
      <Row gutter={8}>
        <Field label="tooltip" span={24}>
          <Input size="small" value={sub.tooltip ?? ""} onChange={(e) => set("tooltip", e.target.value)} />
        </Field>
      </Row>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "Advanced JSON",
            children: <AdvancedJSONEditor value={sub} onCommit={commitJson} rows={5} />,
          },
        ]}
      />
      <Flex justify="flex-end">
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(index)}>
          Remove
        </Button>
      </Flex>
    </Card>
  );
};

const AppendItemEditor = memo(AppendItemEditorInner);

const AppendEditorInner: FC<{ list: JSONList; onChange: (list: JSONList) => void }> = ({
  list,
  onChange,
}) => {
  const listRef = useRef(list);
  listRef.current = list;

  const handleItemChange = useCallback(
    (index: number, next: JSONMap) => {
      const copy = [...listRef.current];
      copy[index] = next;
      onChange(copy);
    },
    [onChange]
  );

  const handleRemove = useCallback(
    (index: number) => onChange(listRef.current.filter((_, i) => i !== index)),
    [onChange]
  );

  const handleAdd = useCallback(
    () => onChange([...listRef.current, { name: "", label: "", type: "BaseInput" }]),
    [onChange]
  );

  return (
    <Flex vertical gap={6}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          append （嵌套子字段）
        </Typography.Text>
        <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
          Add
        </Button>
      </Flex>
      {list.map((sub, index) => (
        <AppendItemEditor
          key={index}
          sub={sub}
          index={index}
          onChange={handleItemChange}
          onRemove={handleRemove}
        />
      ))}
    </Flex>
  );
};

const AppendEditor = memo(AppendEditorInner);

// ---------- one form-json item ----------

type SchemaItemActions = {
  onPatch: (index: number, next: JSONMap) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
};

const SchemaItemCardInner: FC<
  {
    listKey: string;
    item: JSONMap;
    index: number;
    total: number;
  } & SchemaItemActions
> = ({ listKey, item, index, total, onPatch, onRemove, onMove }) => {
  const isOutput = listKey === "outputs";
  const type = typeof item?.type === "string" ? item.type : "";
  const showsTypeOptions = !isOutput;
  const isCollected = !isOutput && /Collected|GroupSelect|SelectAll|Nest/.test(type);
  const append = Array.isArray(item?.append) ? item.append : undefined;

  // Mirror the newest item in a ref so nested editors can receive callbacks
  // with a stable identity (otherwise they change on every keystroke and
  // defeat React.memo on the children).
  const itemRef = useRef(item);
  itemRef.current = item;

  const set = (key: string, value: any) => {
    const next: JSONMap = { ...item };
    if (isEmptyValue(value)) delete next[key];
    else next[key] = value;
    onPatch(index, next);
  };

  const handleAppendChange = useCallback(
    (nextAppend: JSONList) => {
      const next: JSONMap = { ...itemRef.current };
      if (nextAppend.length) next.append = nextAppend;
      else delete next.append;
      onPatch(index, next);
    },
    [index, onPatch]
  );

  const handleJsonCommit = useCallback(
    (next: JSONMap) => onPatch(index, next),
    [index, onPatch]
  );

  const setResolverFormats = (formats: string[]) => {
    const next: JSONMap = { ...item };
    const resolver: JSONMap = {
      ...(item.resolver && typeof item.resolver === "object" ? item.resolver : {}),
    };
    if (formats.length) resolver.accept_formats = formats;
    else delete resolver.accept_formats;
    if (Object.keys(resolver).length) next.resolver = resolver;
    else delete next.resolver;
    onPatch(index, next);
  };

  const setRequired = (required: boolean) => onPatch(index, withRequired(item, required));

  const setRequiredMessage = (messageText: string) => {
    const rules = Array.isArray(item.rules)
      ? item.rules.map((rule: any) =>
          rule?.required ? { ...rule, message: messageText } : rule
        )
      : [];
    onPatch(index, { ...item, rules });
  };

  const required = isRequired(item);

  return (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
      title={
        <Flex gap={8} align="center">
          <Tag color="blue">#{index + 1}</Tag>
          <Typography.Text strong>{item.name || item.label || "(unnamed)"}</Typography.Text>
          {type && <Tag>{type}</Tag>}
          {required && <Tag color="red">required</Tag>}
        </Flex>
      }
      extra={
        <Space size={4}>
          <Tooltip title="Move up">
            <Button
              size="small"
              type="text"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
            />
          </Tooltip>
          <Tooltip title="Move down">
            <Button
              size="small"
              type="text"
              icon={<ArrowDownOutlined />}
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
            />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={() => onRemove(index)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      <Row gutter={12}>
         <Field label="type">
          {showsTypeOptions ? (
            <ComponentTypeSelect value={item.type} onChange={(v) => set("type", v)} />
          ) : (
            <Input
              size="small"
              value={item.type ?? ""}
              placeholder="file / dir / table"
              onChange={(e) => set("type", e.target.value)}
            />
          )}
        </Field>
        <Field label="name">
          <Input size="small" value={item.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        {!isOutput && (
          <Field label="label">
            <Input size="small" value={item.label ?? ""} onChange={(e) => set("label", e.target.value)} />
          </Field>
        )}
       
      </Row>

      {!isOutput && (
        <Row gutter={12}>
          <Field label="input_type">
            <AutoComplete
              size="small"
              value={item.input_type}
              style={{ width: "100%" }}
              placeholder="file / sample / ..."
              options={INPUT_TYPE_OPTIONS}
              onChange={(v) => set("input_type", v)}
            />
          </Field>
          <Field label="component_id">
            <Input
              size="small"
              value={item.component_id ?? ""}
              placeholder="DEFAULT / TABLE / uuid"
              onChange={(e) => set("component_id", e.target.value)}
            />
          </Field>
          <Field label="mode">
            <AutoComplete
              size="small"
              value={item.mode}
              style={{ width: "100%" }}
              options={MODE_OPTIONS}
              onChange={(v) => set("mode", v)}
            />
          </Field>
        </Row>
      )}

      <Row gutter={12}>
        <Field label="initialValue">
          <Input
            size="small"
            value={item.initialValue ?? ""}
            onChange={(e) => set("initialValue", e.target.value)}
          />
        </Field>
        {!isOutput && (
          <Field label="tooltip">
            <Input size="small" value={item.tooltip ?? ""} onChange={(e) => set("tooltip", e.target.value)} />
          </Field>
        )}
        <Field label="col">
          <InputNumber
            size="small"
            min={1}
            max={24}
            style={{ width: "100%" }}
            value={item.col}
            onChange={(v) => set("col", v)}
          />
        </Field>
      </Row>

      {!isOutput && (
        <Row gutter={12}>
          <Field label="required">
            <Flex gap={8} align="center" wrap>
              <Switch size="small" checked={required} onChange={setRequired} />
              {required && (
                <Input
                  size="small"
                  style={{ width: 240 }}
                  value={
                    Array.isArray(item.rules)
                      ? item.rules.find((rule: any) => rule?.required)?.message ?? ""
                      : ""
                  }
                  onChange={(e) => setRequiredMessage(e.target.value)}
                />
              )}
            </Flex>
          </Field>
          <Field label="db">
            <Switch size="small" checked={!!item.db} onChange={(v) => set("db", v)} />
          </Field>
          <Field label="accept_formats">
            <Select
              size="small"
              mode="tags"
              style={{ width: "100%" }}
              tokenSeparators={[","]}
              value={item?.resolver?.accept_formats ?? []}
              options={FORMAT_OPTIONS}
              onChange={setResolverFormats}
            />
          </Field>
        </Row>
      )}

      {isCollected && (
        <Row gutter={12}>
          <Field label="columns">
            <Select
              size="small"
              mode="tags"
              style={{ width: "100%" }}
              value={item.columns ?? []}
              onChange={(v) => set("columns", v)}
            />
          </Field>
          <Field label="modes">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              value={item.modes ?? []}
              options={FLAG_OPTIONS}
              onChange={(v) => set("modes", v)}
            />
          </Field>
          <Field label="columns_rules">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              value={item.columns_rules ?? []}
              options={FLAG_OPTIONS}
              onChange={(v) => set("columns_rules", v)}
            />
          </Field>
        </Row>
      )}

      {!isOutput && (
        <Row gutter={12}>
          <Field label="group">
            <AutoComplete
              size="small"
              value={item.group}
              style={{ width: "100%" }}
              placeholder="group_field"
              options={GROUP_OPTIONS}
              onChange={(v) => set("group", v)}
            />
          </Field>
          <Field label="groupField">
            <AutoComplete
              size="small"
              value={item.groupField}
              style={{ width: "100%" }}
              placeholder="group_field"
              options={GROUP_FIELD_OPTIONS}
              onChange={(v) => set("groupField", v)}
            />
          </Field>
        </Row>
      )}

      {(append || /^Nest/.test(type)) && (
        <div style={{ marginTop: 4 }}>
          <AppendEditor list={append ?? NO_APPEND} onChange={handleAppendChange} />
        </div>
      )}

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "Advanced JSON",
            children: <AdvancedJSONEditor value={item} onCommit={handleJsonCommit} rows={6} />,
          },
        ]}
      />
    </Card>
  );
};

const SchemaItemCard = memo(SchemaItemCardInner);

// ---------- list editor (inputs / params / outputs) ----------

const ListEditorInner: FC<{
  listKey: string;
  list: JSONList;
  onChange: (list: JSONList) => void;
}> = ({ listKey, list, onChange }) => {
  // `list` changes identity on every edit, but the handlers below must not, or
  // every memoized row would re-render on each keystroke.
  const listRef = useRef(list);
  listRef.current = list;

  const onPatch = useCallback(
    (index: number, next: JSONMap) => {
      const copy = [...listRef.current];
      copy[index] = next;
      onChange(copy);
    },
    [onChange]
  );

  const onRemove = useCallback(
    (index: number) => onChange(listRef.current.filter((_, i) => i !== index)),
    [onChange]
  );

  const onMove = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir;
      const source = listRef.current;
      if (target < 0 || target >= source.length) return;
      const copy = [...source];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      onChange(copy);
    },
    [onChange]
  );

  const createItem = useCallback(
    (): JSONMap =>
      listKey === "outputs"
        ? { name: "", type: "file" }
        : { name: "", label: "", type: "BaseInput" },
    [listKey]
  );

  const addItem = useCallback(
    () => onChange([...listRef.current, createItem()]),
    [createItem, onChange]
  );

  // Insert a fresh item right below the card at `index`. Without this a new
  // component could only ever be appended to the end of the list.
  const insertAfter = useCallback(
    (index: number) => {
      const copy = [...listRef.current];
      copy.splice(index + 1, 0, createItem());
      onChange(copy);
    },
    [createItem, onChange]
  );

  const singular = listKey.slice(0, -1);

  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary">{list.length} item(s)</Typography.Text>
        <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={addItem}>
          Add {singular}
        </Button>
      </Flex>

      {list.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No ${listKey} yet`} />
      )}

      {list.map((item, index) => (
        <Fragment key={index}>
          <SchemaItemCard
            listKey={listKey}
            item={item}
            index={index}
            total={list.length}
            onPatch={onPatch}
            onRemove={onRemove}
            onMove={onMove}
          />
          <Tooltip title={`Insert a new ${singular} below this component`}>
            <Button
              size="small"
              type="dashed"
              block
              icon={<PlusOutlined />}
              style={{ color: "rgba(0, 0, 0, 0.45)" }}
              onClick={() => insertAfter(index)}
            >
              Add {singular} below
            </Button>
          </Tooltip>
        </Fragment>
      ))}
    </Flex>
  );
};

const ListEditor = memo(ListEditorInner);

// ---------- resources / ui ----------

const KeyValueEditorInner: FC<{
  value: JSONMap;
  onChange: (value: JSONMap) => void;
  fields: KVField[];
}> = ({ value, onChange, fields }) => {
  const set = (key: string, v: any) => {
    const next: JSONMap = { ...value };
    if (isEmptyValue(v)) delete next[key];
    else next[key] = v;
    onChange(next);
  };

  return (
    <>
      <Row gutter={12}>
        {fields.map((field) => (
          <Field key={field.key} label={field.label} span={field.span ?? 8}>
            {field.number ? (
              <InputNumber
                size="small"
                min={0}
                style={{ width: "100%" }}
                value={value[field.key]}
                onChange={(v) => set(field.key, v)}
              />
            ) : (
              <Input
                size="small"
                value={value[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => set(field.key, e.target.value)}
              />
            )}
          </Field>
        ))}
      </Row>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "Advanced JSON",
            children: <AdvancedJSONEditor value={value} onCommit={onChange} rows={5} />,
          },
        ]}
      />
    </>
  );
};

const KeyValueEditor = memo(KeyValueEditorInner);

// ---------- main editor ----------

export interface IOSchemaEditorProps {
  value?: any;
  onChange?: (value: JSONMap) => void;
}

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

  // The schema as it was last handed to us from the outside (form load / external
  // reset). "Restore" puts the draft back to this snapshot, i.e. discards every
  // local edit made since the schema was loaded.
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
    () => ({
      inputs: (list: JSONList) => setList("inputs", list),
      params: (list: JSONList) => setList("params", list),
      outputs: (list: JSONList) => setList("outputs", list),
    }),
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
      ...(["inputs", "params", "outputs"] as const).map((key) => ({
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

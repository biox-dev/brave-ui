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
} from "@ant-design/icons";
import { FC, ReactNode, useEffect, useMemo, useState } from "react";

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

const EMPTY_SCHEMA: JSONMap = {
  inputs: [],
  params: [],
  outputs: [],
  resources: {},
  ui: {},
};

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
    options={FORM_COMPONENT_TYPES.map((type) => ({ label: type, value: type }))}
    onChange={onChange}
  />
);

// Raw JSON editor used for "advanced" escape hatches (whole item / resources / ui).
const AdvancedJSONEditor: FC<{
  value: any;
  onCommit: (value: any) => void;
  rows?: number;
}> = ({ value, onCommit, rows = 8 }) => {
  const serialized = JSON.stringify(value ?? {}, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setText(serialized);
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return (
    <>
      <Input.TextArea
        value={text}
        rows={rows}
        spellCheck={false}
        status={error ? "error" : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
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

const AppendItemEditor: FC<{
  sub: JSONMap;
  onChange: (next: JSONMap) => void;
  onRemove: () => void;
}> = ({ sub, onChange, onRemove }) => {
  const set = (key: string, value: any) => {
    const next: JSONMap = { ...sub };
    if (isEmptyValue(value)) delete next[key];
    else next[key] = value;
    onChange(next);
  };

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
            children: <AdvancedJSONEditor value={sub} onCommit={onChange} rows={5} />,
          },
        ]}
      />
      <Flex justify="flex-end">
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove}>
          Remove
        </Button>
      </Flex>
    </Card>
  );
};

const AppendEditor: FC<{ list: JSONList; onChange: (list: JSONList) => void }> = ({
  list,
  onChange,
}) => (
  <Flex vertical gap={6}>
    <Flex justify="space-between" align="center">
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        append （嵌套子字段）
      </Typography.Text>
      <Button
        size="small"
        type="dashed"
        icon={<PlusOutlined />}
        onClick={() => onChange([...list, { name: "", label: "", type: "BaseInput" }])}
      >
        Add
      </Button>
    </Flex>
    {list.map((sub, index) => (
      <AppendItemEditor
        key={index}
        sub={sub}
        onChange={(next) => {
          const copy = [...list];
          copy[index] = next;
          onChange(copy);
        }}
        onRemove={() => onChange(list.filter((_, i) => i !== index))}
      />
    ))}
  </Flex>
);

// ---------- one form-json item ----------

const SchemaItemCard: FC<{
  listKey: string;
  item: JSONMap;
  index: number;
  total: number;
  onChange: (next: JSONMap) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}> = ({ listKey, item, index, total, onChange, onRemove, onMove }) => {
  const isOutput = listKey === "outputs";
  const type = typeof item?.type === "string" ? item.type : "";
  const showsTypeOptions = !isOutput;
  const isCollected = !isOutput && /Collected|GroupSelect|SelectAll|Nest/.test(type);
  const append = Array.isArray(item?.append) ? item.append : undefined;

  const set = (key: string, value: any) => {
    const next: JSONMap = { ...item };
    if (isEmptyValue(value)) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const setResolverFormats = (formats: string[]) => {
    const next: JSONMap = { ...item };
    const resolver: JSONMap = {
      ...(item.resolver && typeof item.resolver === "object" ? item.resolver : {}),
    };
    if (formats.length) resolver.accept_formats = formats;
    else delete resolver.accept_formats;
    if (Object.keys(resolver).length) next.resolver = resolver;
    else delete next.resolver;
    onChange(next);
  };

  const setRequired = (required: boolean) => onChange(withRequired(item, required));

  const setRequiredMessage = (messageText: string) => {
    const rules = Array.isArray(item.rules)
      ? item.rules.map((rule: any) =>
          rule?.required ? { ...rule, message: messageText } : rule
        )
      : [];
    onChange({ ...item, rules });
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
              onClick={() => onMove(-1)}
            />
          </Tooltip>
          <Tooltip title="Move down">
            <Button
              size="small"
              type="text"
              icon={<ArrowDownOutlined />}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={onRemove}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
    >
      <Row gutter={12}>
        <Field label="name">
          <Input size="small" value={item.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        {!isOutput && (
          <Field label="label">
            <Input size="small" value={item.label ?? ""} onChange={(e) => set("label", e.target.value)} />
          </Field>
        )}
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
      </Row>

      {!isOutput && (
        <Row gutter={12}>
          <Field label="input_type">
            <AutoComplete
              size="small"
              value={item.input_type}
              style={{ width: "100%" }}
              placeholder="file / sample / ..."
              options={INPUT_TYPES.map((value) => ({ value }))}
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
              options={[{ value: "DEFAULT" }, { value: "TABLE" }]}
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
              options={[
                { label: "0", value: 0 },
                { label: "1", value: 1 },
              ]}
              onChange={(v) => set("modes", v)}
            />
          </Field>
          <Field label="columns_rules">
            <Select
              size="small"
              mode="multiple"
              style={{ width: "100%" }}
              value={item.columns_rules ?? []}
              options={[
                { label: "0", value: 0 },
                { label: "1", value: 1 },
              ]}
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
              options={[{ value: "group_field" }, { value: "sites1" }, { value: "sites2" }]}
              onChange={(v) => set("group", v)}
            />
          </Field>
          <Field label="groupField">
            <AutoComplete
              size="small"
              value={item.groupField}
              style={{ width: "100%" }}
              placeholder="group_field"
              options={[{ value: "group_field" }]}
              onChange={(v) => set("groupField", v)}
            />
          </Field>
        </Row>
      )}

      {(append || /^Nest/.test(type)) && (
        <div style={{ marginTop: 4 }}>
          <AppendEditor list={append ?? []} onChange={(v) => set("append", v)} />
        </div>
      )}

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "adv",
            label: "Advanced JSON",
            children: <AdvancedJSONEditor value={item} onCommit={(v) => onChange(v)} rows={6} />,
          },
        ]}
      />
    </Card>
  );
};

// ---------- list editor (inputs / params / outputs) ----------

const ListEditor: FC<{
  listKey: string;
  list: JSONList;
  onChange: (list: JSONList) => void;
}> = ({ listKey, list, onChange }) => {
  const update = (index: number, next: JSONMap) => {
    const copy = [...list];
    copy[index] = next;
    onChange(copy);
  };
  const remove = (index: number) => onChange(list.filter((_, i) => i !== index));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const copy = [...list];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };

  const addItem = () =>
    onChange([
      ...list,
      listKey === "outputs"
        ? { name: "", type: "file" }
        : { name: "", label: "", type: "BaseInput" },
    ]);

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
        <SchemaItemCard
          key={index}
          listKey={listKey}
          item={item}
          index={index}
          total={list.length}
          onChange={(next) => update(index, next)}
          onRemove={() => remove(index)}
          onMove={(dir) => move(index, dir)}
        />
      ))}
    </Flex>
  );
};

// ---------- resources / ui ----------

const KeyValueEditor: FC<{
  value: JSONMap;
  onChange: (value: JSONMap) => void;
  fields: Array<{ key: string; label: string; span?: number; number?: boolean; placeholder?: string }>;
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

// ---------- main editor ----------

export interface IOSchemaEditorProps {
  value?: any;
  onChange?: (value: JSONMap) => void;
}

const IOSchemaEditor: FC<IOSchemaEditorProps> = ({ value, onChange }) => {
  const schema = useMemo(
    () => normalizeIOSchema(value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(value)]
  );
  const [activeTab, setActiveTab] = useState("inputs");

  const emit = (next: JSONMap) => onChange?.(next);

  const items = [
    ...(["inputs", "params", "outputs"] as const).map((key) => ({
      key,
      label: `${key[0].toUpperCase()}${key.slice(1)} (${schema[key].length})`,
      children: (
        <ListEditor
          listKey={key}
          list={schema[key]}
          onChange={(list) => emit({ ...schema, [key]: list })}
        />
      ),
    })),
    {
      key: "resources",
      label: "Resources",
      children: (
        <KeyValueEditor
          value={schema.resources}
          onChange={(v) => emit({ ...schema, resources: v })}
          fields={[
            { key: "cpu", label: "cpu", number: true },
            { key: "memory", label: "memory", placeholder: "6GB" },
            { key: "gpu", label: "gpu", number: true },
            { key: "docker", label: "docker", span: 12, placeholder: "quay.io/..." },
            { key: "queue", label: "queue", span: 12 },
          ]}
        />
      ),
    },
    {
      key: "ui",
      label: "UI",
      children: (
        <KeyValueEditor
          value={schema.ui}
          onChange={(v) => emit({ ...schema, ui: v })}
          fields={[
            { key: "icon", label: "icon", placeholder: "scissors" },
            { key: "color", label: "color", placeholder: "green" },
          ]}
        />
      ),
    },
    {
      key: "json",
      label: "JSON",
      children: (
        <AdvancedJSONEditor
          value={schema}
          rows={18}
          onCommit={(v) => emit(normalizeIOSchema(v))}
        />
      ),
    },
  ];

  return <Tabs size="small" activeKey={activeTab} onChange={setActiveTab} items={items} />;
};

export default IOSchemaEditor;

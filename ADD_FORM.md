# 如何添加一个新的表单组件（formJson 组件类型）

> 适用范围：`src/components/form-components`（渲染器）与 `src/components/script/io-schema-editor`（io_schema 可视化编辑器）。
> 2026-09 重构后，**组件类型与“它能编辑哪些属性”由同一份注册表驱动**，所以新增一个类型只改 3 个文件。

---

## 1. 三条链路（先建立心智模型）

| 关注点 | 决定它的地方 |
| --- | --- |
| 某个 `type` 渲染成什么 | `registry/meta.ts`（有哪些 type）+ `components/index.ts`（实现）→ `core/component-map.tsx` 派生 `componentMap` |
| 组件的 `data` 从哪来 | `core/components-render.tsx`：`data` prop → `inputAnalysisMethod` → `dataKey` → `resolver.accept_formats` → `first_data_key` |
| 编辑器显示哪些属性输入框 | `registry/meta.ts` 的 `groups` / `dataFields` / `displayFields` / `columnFields` |

目录：

```
form-components/
├── registry/     # ★ 类型目录，零依赖（编辑器也 import 它）
│   ├── types.ts  #   ComponentMeta / PropGroupKey / DataFieldKey / DisplayFieldKey / ColumnFieldKey
│   ├── meta.ts   #   COMPONENT_META：31 个类型的描述表
│   └── index.ts  #   getComponentMeta / createSchemaItem / groupedComponentTypeOptions ...
├── components/   # 实现，按领域分目录 + index.ts(COMPONENT_IMPLEMENTATIONS)
└── core/         # depends / components-render / component-map / form-json-comp
script/io-schema-editor/
├── prop-editors/ # 属性组编辑器 + PROP_EDITORS 注册表
├── editors/      # list-editor / schema-item-card / append-editor
└── shared/       # Field / AdvancedJSONEditor / ComponentTypeSelect / KeyValueEditor
```

---

## 2. 最短路径：3 步新增一个类型

### 步骤 1 — 实现组件

`src/components/form-components/components/<domain>/<my-component>.tsx`

```tsx
// src/components/form-components/components/base/base-slider.tsx
import { Form, Slider } from "antd";
import { FC } from "react";

export const BaseSlider: FC<any> = ({ label, name, tooltip, data, initialValue, rules, ...rest }) => (
  <Form.Item initialValue={initialValue} label={label} name={name} rules={rules} tooltip={tooltip}>
    <Slider {...rest} />
  </Form.Item>
);

export default BaseSlider;
```

约定：**props 就是 form-json item 的字段**，由 `ComponentsRender` 直接注入。
`data`（选项数组）、`analysisResultId`、`projParameter` 等是渲染器额外塞进来的，不需要在 meta 里声明。

### 步骤 2 — 注册实现

`src/components/form-components/components/index.ts`

```ts
import { BaseSlider } from "./base/base-slider";   // ① 加 import
// ② 加入文件顶部那个 export { ... } 汇总块（或单独 export { BaseSlider };）

export const COMPONENT_IMPLEMENTATIONS: Record<string, FC<any>> = {
  // ...
  BaseSlider,   // ③ key 必须与 meta.ts 的 type 完全一致
};
```

### 步骤 3 — 登记类型元数据

`src/components/form-components/registry/meta.ts` → `COMPONENT_META` 数组

```ts
{
  type: "BaseSlider",
  label: "BaseSlider（0–1 滑块）",
  category: "basic",
  description: "数值滑块，常用于比例 / 阈值参数。",
  groups: INPUT_GROUPS,                // 复用现成的分组模板
  defaults: { label: "" },             // 新建 item 时的默认字段
  displayFields: ["tooltip", "initialValue"],
},
```

**完成。** 此时：

- `formJson` 里 `{ "type": "BaseSlider", "name": "cutoff" }` 能正常渲染；
- io_schema 编辑器的类型下拉里出现 `BaseSlider`，并按 `groups` 渲染属性面板；
- 不需要改 `componentMap`、不需要改编辑器。

> 三个步骤缺一不可：`componentMap` 是由 meta 派生的，所以**漏了 meta 或漏了实现，运行时都会显示 `未知类型 xxx`**
> （顺带一提，编辑器的列表头部也会用橙色标签提示 `unknown type`）。

---

## 3. `ComponentMeta` 字段速查

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `type` | ✅ | 与 `COMPONENT_IMPLEMENTATIONS` 的 key 一致；写进 io_schema 的 `type` |
| `label` | ✅ | 下拉/提示里显示的名字（推荐和 `type` 保持一致，便于检索） |
| `category` | ✅ | `basic` / `layout` / `select` / `sample` / `collected` / `params`，决定下拉分组 |
| `description` | | 类型下拉里的说明文字 |
| `groups` | ✅ | **编辑器渲染哪些属性组**（见 §4），一般直接复用分组模板 |
| `defaults` | | 编辑器新建该类型 item 时的初始字段 |
| `renderProps` | | 渲染时额外注入组件的默认 props，**item 自身同名字段会覆盖它**（如 `{ dataKey: "rank", initialValue: "SPECIES" }`） |
| `dataFields` | | 该组件真正读取的数据源字段：`dataKey` / `field` / `filter` / `group` / `groupField` |
| `displayFields` | | 该组件真正读取的展示字段：`text` / `tooltip` / `initialValue` / `extra` |
| `columnFields` | | 只有 collected 组件用：`columns` / `modes` / `columns_rules` / `groups` |
| `appendTypes` | | 支持 `append` 嵌套时，允许的子类型白名单 |
| `layout` | | `true` 表示纯布局组件（如 `Divider`）：新建 item 时不写入 `label`，编辑器也隐藏 label 输入框 |

---

## 4. 属性组（`PropGroupKey`）

`groups` 里的顺序无所谓，实际按 `PROP_GROUP_ORDER` 渲染：
`identity → io → datasource → columns → nest → display → validation → depends → advanced`

| 组 | 内容 | 现成模板 |
| --- | --- | --- |
| `identity` | `type` / `name` / `label` / `col` | 所有类型 |
| `io` | `input_type` / `mode` / `db` / `resolver.accept_formats` | `INPUT_GROUPS` |
| `datasource` | `dataKey` / `field` / `filter` / `group` / `groupField`（按 `dataFields` 过滤） | `SELECT_GROUPS` / `SAMPLE_GROUPS` |
| `columns` | `columns` / `modes` / `columns_rules` / `groups`（按 `columnFields` 过滤） | `COLLECTED_GROUPS` |
| `nest` | `append` 子字段编辑器（按 `appendTypes` 过滤可选类型） | `NEST_GROUPS` |
| `display` | `text` / `tooltip` / `initialValue` / `extra`（按 `displayFields` 过滤） | 全部 |
| `validation` | `required` + rule message（保留其它 rules） | 全部 |
| `depends` | 条件显示（`{and}` / `{or}` / 数组 / 单条件 四种形态互转） | 全部 |
| `advanced` | 整项 Raw JSON（兜底逃生口） | 全部 |

现成分组模板：
`INPUT_GROUPS`、`SELECT_GROUPS`、`SAMPLE_GROUPS`、`COLLECTED_GROUPS`、`NEST_GROUPS`、`PARAM_GROUPS`、`LAYOUT_GROUPS`。

> `depends` 与 `advanced` 会自动收进卡片底部的 Collapse（`COLLAPSED_GROUPS`），其余组内联展示。

---

## 5. 需要“新属性组 / 新字段”时

场景：组件有 `min` / `max` 这类结构化属性，想让它们在面板里可编辑，而不是丢给 Advanced JSON。

1. 若是**已有组的新字段**（例如给 `display` 加 `placeholder`）：
   `registry/types.ts` 的 `DisplayFieldKey` 加 `"placeholder"` → `prop-editors/display.tsx` 增加输入框
   → 在 meta 里 `displayFields: [..., "placeholder"]`。
2. 若是**全新的组**：
   - `registry/types.ts`：`PropGroupKey` 加键、`PROP_GROUP_ORDER` 加位置、`PROP_GROUP_LABELS` 加标题；
   - 新建 `io-schema-editor/prop-editors/<group>.tsx`（用 `shared/field.tsx` 的 `Field` 排版）；
   - `io-schema-editor/prop-editors/index.tsx`：加入 `PROP_EDITORS`（`Record<PropGroupKey, PropEditor>`，漏一个会编译报错）；
   - meta 里按需把新键写进 `groups`。

`PropEditor` 的契约（`io-schema-editor/types.ts`）：

```ts
interface PropEditorProps {
  item: JSONMap;                              // 当前 form-json item
  listKey: "inputs" | "params" | "outputs";
  index: number;
  set: (key: string, value: any) => void;     // 写一个顶层键；空值会删除该键
  patch: (next: JSONMap) => void;             // 整体替换（rules / depends / JSON 用）
}
```

---

## 6. 嵌套子字段（`append`）

只有 `Form.List` 类组件（`Nest*`）以及 `CollectedSampleSelect` 支持：

1. 组件里渲染子字段 —— 标准做法是复用 `components/append/append-fields.tsx`：

```tsx
<AppendFields append={append} prefix={[listIndex]} />            // 基础变体
<AppendFields append={append} prefix={[listIndex]} variant="v2" inherited={grest} />  // 允许 CollectedSampleSelectV2 子项
```

2. meta 里声明白名单，编辑器才会限制可选类型：

```ts
{ type: "MyNestSelect", /* ... */ groups: NEST_GROUPS, appendTypes: APPEND_BASIC_FIELDS }
```

若父组件要支持新的子类型，需同时改 `append-fields.tsx` 的分支 + `appendTypes`。

---

## 7. 组件实现约定（踩坑点）

1. **`name` 可能是数组**。在 `Form.List` 里父组件会用 `name={[outer, listIndex, child]}` 传下来，
   所以内部拼路径请用 `name={[name, "sample"]}` 这种形式（antd 会自动展平）。
2. **不要把未知 props 透传给 antd / DOM**。`{...rest}` 里如果混入 `label`、`filter` 之类的字段，
   React 会报 “does not recognize the prop”。不需要的字段请在解构时显式摘掉：
   `({ label, name, data, filter, /** 摘掉不传 */ ...rest })`。
3. **保持回调稳定**。列表里每一行都是 `memo` 的，父级用 ref 缓存最新值来提供稳定回调。
   如果组件内 `useCallback` 依赖了每次变化的对象，会导致整列重渲染。
4. **`data` 由渲染器解析**：要么在 meta 里给 `dataKey`（或 `renderProps.dataKey`），
   要么在 item 里写 `dataKey`，要么靠 `resolver.accept_formats` 命中上游角色
   （多个角色是"任选其一"的候选格式，会按 `id` 去重合并成一个候选列表）；
   否则拿到的可能是 `dataMap.first_data_key` 对应的值。
   项目级常量在 `core/form-json-comp.tsx` 的 `constDataMap`（`rank`、`group_field`）。
5. **`depends` 不用在组件里处理**，`FormJsonComp` 已按字段级 `shouldUpdate` 统一控制显隐。
6. **`col`** 由 `FormJsonComp` 转成 `<Col span>`，组件本身不用管栅格。
7. **`name` 必须唯一且非空**：后端 `formatIOSchemaItems` 按 `name` 生成 map，重名会互相覆盖
   （编辑器会在列表头部提示 `duplicate name`）。

---

## 8. 验证清单

```bash
cd go-brave-ui
npx tsc -p tsconfig.app.json --noEmit     # 基线：0 error
npx vite build                            # 确认 import 解析、可正常打包
```

- [ ] `COMPONENT_META` 里的 `type` 与 `COMPONENT_IMPLEMENTATIONS` 的 key 完全一致
- [ ] 类型下拉里出现新类型，且描述/分组正确
- [ ] 选中该类型后，属性面板只显示该组件支持的字段
- [ ] 新建 item 后切到 `JSON` tab，输出的 item 字段符合预期（没有多余空值）
- [ ] 在分析表单里实测：能填写、能提交、后端 `GetScriptFormJSONByID` 能返回该 item

> 备注：本仓库 eslint 未强制（存量大量 `no-explicit-any` / `no-unused-vars`），
> 所以**以 `tsc` 与 `vite build` 为准**，不要被 `npx eslint` 的历史告警带偏。

---

## 9. 快速参考

```ts
// 查询
import { getComponentMeta, getPropGroups, hasDataField, hasDisplayField } from "@/components/form-components/registry";

// 新建 item（编辑器内部使用）
import { createSchemaItem, createAppendItem } from "@/components/form-components/registry";
createSchemaItem("BaseSlider", "params");   // → { name: "", label: "", type: "BaseSlider" }
createSchemaItem(undefined, "outputs");     // → { name: "", type: "file" }
```

- 渲染器对外出口：`@/components/form-components`（默认导出 `FormJsonComp`，并 re-export 全部组件与 registry）
- 编辑器出口：`@/components/script/io-schema-editor`（默认 `IOSchemaEditor`，另导出 `normalizeIOSchema` / `FORM_COMPONENT_TYPES`）

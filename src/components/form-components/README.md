# form-components

渲染 `formJson` 的模块，同时为可视化编辑器（`src/components/script/io-schema-editor`）提供
“每种组件类型支持哪些属性”的元数据。

## 目录结构

```
form-components/
├── index.ts                 # 对外出口（默认导出 FormJsonComp）
├── render-from-json.tsx     # lazy 包装器
├── registry/                # ★ 组件类型目录（无任何依赖，编辑器也会 import）
│   ├── types.ts             #   ComponentMeta / PropGroupKey / DataFieldKey ...
│   ├── meta.ts              #   type → 描述（分组、默认值、可编辑字段、append 子类型）
│   └── index.ts             #   查询辅助函数（getComponentMeta / createSchemaItem ...）
├── components/              # 组件实现，按领域分目录
│   ├── index.ts             #   COMPONENT_IMPLEMENTATIONS: type → 组件
│   ├── append/              #   append 子字段渲染
│   ├── base/                #   Input / Select / Switch / ColorPicker / Divider ...
│   ├── select/              #   FilterSelect / MetaphlanCladeSelect / GroupCompareSelect
│   ├── sample/              #   SelectSample / Nest* / GroupSelectSampleButton
│   ├── collected/           #   Collected*（依赖上游分析结果列）
│   ├── params/              #   DifferenceAnalysisConditions / HeatmapParams
│   └── shared/              #   BasicSelect / ColorPickerComp / GroupSelect(Sample|Button)
└── core/
    ├── depends.ts           # checkDepends / extractDependsNames
    ├── components-render.tsx# 解析 data 并渲染单个 item
    ├── component-map.tsx    # registry.meta + components → componentMap
    └── form-json-comp.tsx   # 顶层 Row/Col 布局 + depends 订阅
```

## 三条链路

| 关注点 | 数据来源 |
| --- | --- |
| 渲染哪个组件 | `registry/meta.ts` 的 `type` + `components/index.ts` 的实现 → `core/component-map.tsx` |
| 组件数据从哪来 | `core/components-render.tsx`（`dataMap` / `dataKey` / `component_id` / `first_data_key`） |
| 编辑器显示哪些属性 | `registry/meta.ts` 的 `groups` / `dataFields` / `displayFields` / `columnFields` |

## 新增一个组件类型

1. `components/<domain>/my-component.tsx` 实现组件（props 由 form-json item 直接注入）。
2. `components/index.ts`：import + 加入 `COMPONENT_IMPLEMENTATIONS`。
3. `registry/meta.ts`：新增一条 `ComponentMeta`（`type` / `category` / `groups` /
   `dataFields` / `defaults` / `renderProps`）。
4. 完成。`FormJsonComp` 与 `IOSchemaEditor` 都会自动识别；如果这个类型需要新的属性组，
   再到 `script/io-schema-editor/prop-editors/` 里加一个 `PropGroupKey` 编辑器。

> ⚠️ `registry/meta.ts` 的 `type` 必须与 `COMPONENT_IMPLEMENTATIONS` 的 key 一致；
> 编辑器会提示 “unknown type”，运行时则显示 “未知类型 xxx”。

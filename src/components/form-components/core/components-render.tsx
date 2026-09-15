// src/components/form-components/core/components-render.tsx
// Resolves a form-json item to a concrete component and feeds it its data.
//
// `data` resolution, in order of precedence:
//   1. `data` passed straight through (already resolved upstream)
//   2. `dataMap[inputAnalysisMethod]`
//   3. `dataMap[dataKey]` — the item's own `dataKey` wins over the map entry's
//   4. every `resolver.accept_formats` role present in `dataMap`, merged into a
//      single option list — the backend keys `analysis_result` by these roles
//      ("TABLE", "DEFAULT", ...) and they are alternatives, not all-required
//   5. `dataMap[dataMap.first_data_key]`

/** `resolver.accept_formats` roles that exist in `dataMap`, in declared order. */
const acceptedFormatKeys = (resolver: any, dataMap: any): string[] => {
  const formats = resolver?.accept_formats;
  if (!Array.isArray(formats)) return [];
  return formats.filter(
    (format: any) => typeof format === "string" && format in dataMap
  );
};

/**
 * Data for `resolver.accept_formats`: the roles are alternatives ("this input
 * accepts TABLE or DEFAULT"), so every role that has data is merged into one
 * list, de-duplicated by `id` because the same file can be listed under two
 * roles. Returns `undefined` when no role has data (→ `first_data_key`), and
 * falls back to the first role when the values are not lists (objects/scalars
 * cannot be merged).
 */
const collectAcceptedFormatsData = (resolver: any, dataMap: any): any => {
  const values = acceptedFormatKeys(resolver, dataMap).map((key) => dataMap[key]);

  if (values.length === 0) return undefined;
  if (values.length === 1 || !values.every((value) => Array.isArray(value))) {
    return values[0];
  }

  const seen = new Set<any>();
  const merged: any[] = [];
  for (const value of values) {
    for (const item of value) {
      const id = item?.id ?? item?.value;
      if (id !== undefined) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      merged.push(item);
    }
  }
  return merged;
};

export const ComponentsRender = ({
  type,
  dataMap,
  constDataMap,
  componentMap,
  inputAnalysisMethod,
  dataKey: dataKey_,
  data: data_,
  name,
  resolver,
  inputKey,
  ...rest
}: any) => {
  if (!dataMap) return <div></div>;

  dataMap = { ...dataMap, ...constDataMap };
  const componentObj = componentMap[type];

  if (!componentObj) {
    return <div>未知类型 {type}</div>;
  }

  const { Component, dataKey, ...crest } = componentObj;

  let data: any = [];
  if (data_) {
    data = data_;
    // 下游分析从数据库加载其它数据
  } else if (inputAnalysisMethod) {
    data = dataMap[inputAnalysisMethod];
  } else if (dataKey_) {
    if (dataKey_ in dataMap) {
      data = dataMap[dataKey_];
    }
  } else if (dataKey) {
    if (dataKey in dataMap) {
      data = dataMap[dataKey];
    }
  } else {
    // 上游分析结果的 key：后端 build*FormData 就是按 resolver.accept_formats
    // 里的角色名（TABLE / DEFAULT ...）分组 analysis_result 的。多个角色是
    // “任选其一”的候选格式，所以全部命中的角色合并成一个候选列表。
    const collected = collectAcceptedFormatsData(resolver, dataMap);
    if (collected !== undefined) {
      data = collected;
    } else if ("first_data_key" in dataMap) {
      data = dataMap[dataMap["first_data_key"]];
    }
  }

  return <Component {...crest} {...rest} data={data} name={name} />;
};

export default ComponentsRender;

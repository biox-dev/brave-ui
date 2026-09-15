// src/components/form-components/core/components-render.tsx
// Resolves a form-json item to a concrete component and feeds it its data.
//
// `data` resolution, in order of precedence:
//   1. `data` passed straight through (already resolved upstream)
//   2. `dataMap[inputAnalysisMethod]`
//   3. `dataMap[dataKey]` — the item's own `dataKey` wins over the map entry's
//   4. `dataMap[component_id]`
//   5. `dataMap[dataMap.first_data_key]`
export const ComponentsRender = ({
  type,
  dataMap,
  constDataMap,
  componentMap,
  inputAnalysisMethod,
  dataKey: dataKey_,
  data: data_,
  name,
  component_id,
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
  } else if (component_id in dataMap) {
    // 上游分析的 key
    data = dataMap[component_id];
  } else if ("first_data_key" in dataMap) {
    data = dataMap[dataMap["first_data_key"]];
  }

  return <Component {...crest} {...rest} data={data} name={name} />;
};

export default ComponentsRender;

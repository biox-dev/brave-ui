// src/components/form-components/components/collected/collected-group-select-sample-button2.tsx
// Collected column picker bound to a specific `analysis_result_id` (instead of a
// user-chosen file): the columns are read from `data[analysisResultId]`.
import { Flex, Form, Input } from "antd";
import { FC, useEffect, useState } from "react";
import { ColorPickerComp } from "../shared/color-picker";
import { GroupSelectButton } from "../shared/group-select-button";
import { GroupSelectSample } from "../shared/group-select-sample";

export const CollectedGroupSelectSampleButton2: FC<any> = ({
  label,
  name,
  rules,
  data,
  filter,
  group,
  groupField: groupField_,
  analysisResultId,
}) => {
  const [sampleGrouped, setSampleGrouped] = useState<any>();
  const [options, setOptions] = useState<any>([]);
  const [analysisResult, setAnalysisResult] = useState<any>([]);

  const form = Form.useFormInstance();
  let filterName: any = [];
  if (filter) {
    filterName = filter.map((it: any) => it.name);
  }
  const customFilterValue = Form.useWatch((values) => {
    const data = Object.entries(values).filter(([key]) => filterName.includes(key));
    return Object.fromEntries(data);
  }, form);

  const groupField = Form.useWatch(group, form);

  const calculateGroup = (sampleGroup: any, groupField: any) => {
    const grouped = sampleGroup.reduce((acc: any, item: any) => {
      const key = item[groupField];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item.value);
      return acc;
    }, {});
    setSampleGrouped(grouped);
  };

  useEffect(() => {
    if (data && Array.isArray(data)) {
      const analysisResult = data.find((it: any) => it.analysis_result_id == analysisResultId);
      setAnalysisResult(analysisResult);
    }
  }, [data, analysisResultId]);

  useEffect(() => {
    if (analysisResult) {
      if (Array.isArray(analysisResult.columns)) {
        let columnsData = analysisResult.columns.map((it: any) => ({
          label: it.columns_name,
          value: it.columns_name,
          ...it,
        }));
        if (filter && customFilterValue) {
          columnsData = filter.reduce((result: any, filterHandle: any) => {
            return result.filter((item: any) => {
              return filterHandle.method(item) === customFilterValue[filterHandle.name];
            });
          }, columnsData);

          columnsData = columnsData.map((it: any) => {
            const { label, id, value, ...rest } = it;
            return {
              label: `${it.label}(${filter[0].method(it)})`,
              value: it.value,
              ...rest,
            };
          });
        }

        if (columnsData && groupField_) {
          calculateGroup(columnsData, groupField_);
        } else {
          if (columnsData && groupField) {
            calculateGroup(columnsData, groupField);
          }
        }
        setOptions(columnsData);
      }
    }
  }, [data, analysisResult, groupField, customFilterValue]);

  return (
    <>
      <Form.Item label={`${label} Columns`} name={[name, "columns"]} rules={rules}>
        <GroupSelectSample
          sampleGrouped={sampleGrouped}
          sampleGroup={options}
          watch={[name, "group"]}
        ></GroupSelectSample>
      </Form.Item>
      <Flex gap="small">
        <Form.Item label={label} name={[name, "group"]} noStyle>
          <GroupSelectButton sampleGrouped={sampleGrouped}></GroupSelectButton>
        </Form.Item>
        <Form.Item name={[name, "group_name"]}>
          <Input size="small" placeholder="Optional group name"></Input>
        </Form.Item>
        <Form.Item name={[name, "color"]}>
          <ColorPickerComp />
        </Form.Item>
      </Flex>
    </>
  );
};

export default CollectedGroupSelectSampleButton2;

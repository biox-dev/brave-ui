// src/components/form-components/components/collected/collected-group-select-sample-button.tsx
// Collected table picker with a group shortcut button, group name and colour for
// every collected column.
import { Flex, Form, Input, Select } from "antd";
import { FC, useEffect, useState } from "react";
import { ColorPickerComp } from "../shared/color-picker";
import { GroupSelectButton } from "../shared/group-select-button";
import { GroupSelectSample } from "../shared/group-select-sample";

export const CollectedGroupSelectSampleButton: FC<any> = ({
  label,
  modes = [],
  projParameter,
  columns,
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
  const [collectFiles, setCollectFiles] = useState<any>([]);

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
  const selectCollectFile = Form.useWatch([name, "file"], form);

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
      const collectedFiles = data.map((it: any) => ({
        label: `${it.file_name}`,
        value: it.id,
      }));
      setCollectFiles(collectedFiles);
    }
  }, [data]);

  useEffect(() => {
    if (selectCollectFile) {
      let columnsData = data.find((it: any) => it.id == selectCollectFile);
      if (columnsData) {
        // 后端只给 EXP / TABLE 角色的文件生成 `columns`（buildCompatFileItem），
        // 多个 accept_formats 合并成候选列表后可能选到没有 `columns` 的文件。
        const columnList = Array.isArray(columnsData.columns) ? columnsData.columns : [];
        columnsData = columnList.map((it: any) => ({
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
  }, [data, selectCollectFile, groupField, customFilterValue]);

  return (
    <>
      <Form.Item label={`${label} File`} name={[name, "file"]} rules={rules}>
        <Select options={collectFiles}></Select>
      </Form.Item>

      {columns &&
        Array.isArray(columns) &&
        columns.map((item: any, index: any) => (
          <div key={index}>
            <Form.Item label={`${item} Columns`} name={[name, item]} rules={rules}>
              <GroupSelectSample
                mode={modes[index] ? "multiple" : undefined}
                sampleGrouped={sampleGrouped}
                sampleGroup={options}
              ></GroupSelectSample>
            </Form.Item>
            {modes[index] != 0 && (
              <Flex gap="small">
                {item}
                <Form.Item label={item} name={[name, "group", `${item}`]} noStyle>
                  <GroupSelectButton
                    sampleGrouped={sampleGrouped}
                    field={[name, item]}
                  ></GroupSelectButton>
                </Form.Item>
                <Form.Item name={[name, "group_name", `${item}`]}>
                  <Input size="small" placeholder="Optional group name"></Input>
                </Form.Item>
                <Form.Item name={[name, "color", `${item}`]}>
                  <ColorPickerComp projParameter={projParameter} />
                </Form.Item>
              </Flex>
            )}
          </div>
        ))}
    </>
  );
};

export default CollectedGroupSelectSampleButton;

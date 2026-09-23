// src/components/form-components/components/assay/group-select-assay-button.tsx
// Assay picker + group shortcut buttons + optional group name / colour.
import { Flex, Form, Input } from "antd";
import { FC, useEffect, useState } from "react";
import { ColorPickerComp } from "../shared/color-picker";
import { GroupSelectButton } from "../shared/group-select-button";
import { GroupSelectAssay } from "../shared/group-select-assay";

export const GroupSelectAssayButton: FC<any> = ({
  label,
  projParameter,
  name,
  rules,
  data,
  filter,
  group,
  groupField: groupField_,
}) => {
  const [sampleGrouped, setSampleGrouped] = useState<any>();
  const [options, setOptions] = useState<any>([]);

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
    if (filter && customFilterValue) {
      data = filter.reduce((result: any, filterHandle: any) => {
        return result.filter((item: any) => {
          return filterHandle.method(item) === customFilterValue[filterHandle.name];
        });
      }, data);

      data = data.map((it: any) => {
        const { label, id, value, ...rest } = it;
        return {
          label: `${it.label}(${filter[0].method(it)})`,
          value: it.value,
          ...rest,
        };
      });
    }

    if (data && groupField_) {
      calculateGroup(data, groupField_);
    } else {
      if (data && groupField) {
        calculateGroup(data, groupField);
      }
    }

    setOptions(data);
  }, [data, groupField, customFilterValue]);

  return (
    <>
      <Form.Item label={label} name={[name, "assay"]} rules={rules}>
        <GroupSelectAssay
          mode="multiple"
          sampleGrouped={sampleGrouped}
          sampleGroup={options}
          watch={[name, "group"]}
        ></GroupSelectAssay>
      </Form.Item>
      <Flex gap="small">
        <Form.Item label={label} name={[name, "group"]} noStyle>
          <GroupSelectButton
            sampleGrouped={sampleGrouped}
            field={[name, "assay"]}
          ></GroupSelectButton>
        </Form.Item>
        <Form.Item name={[name, "group_name"]}>
          <Input size="small" placeholder="Optional group name"></Input>
        </Form.Item>
        <Form.Item name={[name, "color"]}>
          <ColorPickerComp projParameter={projParameter} />
        </Form.Item>
      </Flex>
    </>
  );
};

export default GroupSelectAssayButton;

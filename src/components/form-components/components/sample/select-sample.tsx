// src/components/form-components/components/sample/select-sample.tsx
// Sample picker. The value is written to `<name>.sample`; the sibling
// `<name>.group` field (if any) decides how the options are grouped.
import { Form } from "antd";
import { FC, useEffect, useState } from "react";
import { GroupSelectSample } from "../shared/group-select-sample";

export const SelectSample: FC<any> = ({
  label,
  mode,
  name: name_,
  rules,
  data,
  filter,
  group,
  groupField: groupField_,
}) => {
  const [sampleGrouped, setSampleGrouped] = useState<any>();
  const [options, setOptions] = useState<any>([]);
  let name = name_;
  if (name_ instanceof Array && name_.length > 1) {
    name = name_[1];
  } else {
    name_ = [name_];
  }

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
    <Form.Item label={label} name={[name, "sample"]} rules={rules}>
      <GroupSelectSample
        mode={mode}
        sampleGrouped={sampleGrouped}
        sampleGroup={options}
        watch={[name, "group"]}
      ></GroupSelectSample>
    </Form.Item>
  );
};

export default SelectSample;

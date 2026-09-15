// src/components/form-components/components/select/filter-select.tsx
// Builds its option list from one field of the incoming `data` rows and presets
// the field to the first option.
import { Form } from "antd";
import { FC, useEffect, useState } from "react";
import { BasicSelect } from "../shared/basic-select";

export const FilterSelect: FC<any> = ({ label, name, data, rules, field, ...rest }) => {
  const [options, setOptions] = useState<any>();
  const form = Form.useFormInstance();

  useEffect(() => {
    if (data && field) {
      const filterField: any = [...new Set(data.map(field))];
      setOptions(filterField.map((it: any) => ({ label: it, value: it })));
      form.setFieldValue(name, filterField[0]);
    }
  }, [data]);

  return (
    <Form.Item label={label} name={name} rules={rules}>
      <BasicSelect {...rest} options={options}></BasicSelect>
    </Form.Item>
  );
};

export default FilterSelect;

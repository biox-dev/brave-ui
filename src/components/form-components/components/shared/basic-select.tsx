// src/components/form-components/components/shared/basic-select.tsx
// The select used by every "Base*"-select style component. Adds two behaviours
// on top of antd's `Select`:
//   • case-insensitive search over `label`
//   • `clear` — field names to reset when the value changes
import { Form, Select } from "antd";
import { FC } from "react";

export const BasicSelect: FC<any> = ({
  options,
  clear,
  value,
  onChange,
  projParameter,
  analysisResultId,
  ...rest
}) => {
  const form = Form.useFormInstance();

  const selectChange = (value: any) => {
    onChange(value);
    if (clear) {
      form.resetFields(clear);
    }
  };

  return (
    <Select
      allowClear
      showSearch
      filterOption={(input: any, option: any) =>
        (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
      }
      {...rest}
      options={options}
      value={value}
      onChange={selectChange}
    ></Select>
  );
};

export default BasicSelect;

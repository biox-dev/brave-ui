// src/components/form-components/components/select/group-compare-select.tsx
// Prevalence comparison between the two groups the form already holds
// (`sites1.group` vs `sites2.group`) — the option labels embed the group names.
import { Form, Select } from "antd";
import { FC, useEffect, useState } from "react";

export const GroupCompareSelect: FC<any> = ({
  label,
  name,
  data,
  initialValue,
  rules,
  ...rest
}) => {
  const form = Form.useFormInstance();
  const treatment_group = Form.useWatch(["sites1", "group"], form);
  const control_group = Form.useWatch(["sites2", "group"], form);
  const [query, setQuery] = useState<any>();

  useEffect(() => {
    if (treatment_group && control_group) {
      setQuery([
        { label: `Prevalent in both sites`, value: `Prevalent in both sites` },
        {
          label: `Prevalent in ${control_group.join("-")}`,
          value: `Prevalent in ${control_group.join("-")}`,
        },
        {
          label: `Prevalent in ${treatment_group.join("-")}`,
          value: `Prevalent in ${treatment_group.join("-")}`,
        },
        {
          label: `Not prevalent in either sites`,
          value: `Not prevalent in either sites`,
        },
      ]);
    }
  }, [treatment_group, control_group]);

  return (
    <Form.Item initialValue={initialValue} label={label} name={name} rules={rules}>
      <Select
        showSearch
        filterOption={(input: any, option: any) =>
          (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
        }
        {...rest}
        options={query}
      ></Select>
    </Form.Item>
  );
};

export default GroupCompareSelect;

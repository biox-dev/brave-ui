// src/components/form-components/components/select/metaphlan-clade-select.tsx
// Clade picker whose options are loaded from the metaPhlAn clade API.
import { Form, Select } from "antd";
import axios from "axios";
import { FC, useEffect, useState } from "react";

export const MetaphlanCladeSelect: FC<any> = ({
  label,
  name,
  data,
  initialValue,
  rules,
  ...rest
}) => {
  const [options, setOptions] = useState<any>();

  const loadData = async () => {
    const resp: any = await axios.get(`/fast-api/get_metaphlan_clade`);
    setOptions(
      resp.data.map((it: any) => ({
        label: `${it.taxon.replaceAll(" ", "_")}_${it.clade}`,
        value: it.clade,
      }))
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Form.Item initialValue={initialValue} label={label} name={name} rules={rules}>
      <Select
        {...rest}
        options={options}
        showSearch
        filterOption={(input: any, option: any) =>
          (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
        }
      ></Select>
    </Form.Item>
  );
};

export default MetaphlanCladeSelect;

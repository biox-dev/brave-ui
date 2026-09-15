// src/components/form-components/components/base/select-all.tsx
// Select over the sample group list. In `multiple` mode it adds a button that
// selects every option at once and shows the current selection count.
import { Button, Form, Select } from "antd";
import { FC, useState } from "react";

const SelectAllComp: FC<any> = ({ data, value, onChange, mode, ...rest }) => {
  const [selectedItems, setSelectedItems] = useState<any>(value);

  const onChangeSelct = (value: any) => {
    onChange(value);
    setSelectedItems(value);
  };

  return (
    <>
      <Select
        {...rest}
        mode={mode}
        value={selectedItems}
        onChange={onChangeSelct}
        allowClear
        options={data}
      ></Select>
      {mode == "multiple" && (
        <Button
          onClick={() => {
            const values = data.map((it: any) => it.value);
            setSelectedItems(values);
            onChange(values);
          }}
        >
          Select All{selectedItems && <>({selectedItems.length})</>}
        </Button>
      )}
    </>
  );
};

export const SelectAll: FC<any> = ({ label, name, data, initialValue, rules, ...rest }) => (
  <Form.Item initialValue={initialValue} label={label} name={name} rules={rules}>
    <SelectAllComp data={data} {...rest}></SelectAllComp>
  </Form.Item>
);

export default SelectAll;

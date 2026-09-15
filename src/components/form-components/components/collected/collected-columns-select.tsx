// src/components/form-components/components/collected/collected-columns-select.tsx
// Column picker for the columns collected by an upstream analysis. The options
// come from the FormProvider's `columnsMap`.
import { Form, Select } from "antd";
import { FC } from "react";
import { useStoreForm } from "@/context/form/FormProvider";

export const CollectedColumnsSelect: FC<any> = ({
  label,
  modes = [],
  columns,
  name,
  columns_rules = [],
  rules,
  data,
  filter,
  group,
  groupField: groupField_,
  analysisResultId,
}) => {
  const { columnsMap } = useStoreForm();
  const options = columnsMap[name] ?? [];

  return (
    <>
      {columns &&
        Array.isArray(columns) &&
        columns.map((item: any, index: any) => (
          <div key={index}>
            <Form.Item
              label={`${item} Columns`}
              name={[name, item]}
              rules={[
                {
                  required: columns_rules[index] ? true : false,
                  message: "This field cannot be empty!",
                },
              ]}
            >
              <Select
                showSearch
                allowClear
                mode={modes[index] ? "multiple" : undefined}
                filterOption={(input: any, option: any) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={options}
              ></Select>
            </Form.Item>
          </div>
        ))}
    </>
  );
};

export default CollectedColumnsSelect;

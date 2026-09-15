// src/components/form-components/components/collected/nest-collected-columns-select.tsx
// Repeatable `{ column, value }` rows over the columns collected upstream.
import { Button, Form, Input, Select } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { FC } from "react";
import { useStoreForm } from "@/context/form/FormProvider";

export const NestCollectedColumnsSelect: FC<any> = ({ label, name }) => {
  const { columnsMap } = useStoreForm();
  const options = columnsMap[name] ?? [];

  return (
    <>
      <div style={{ marginBottom: 8 }}>{label}</div>
      <Form.List name={[name, "columns_attribute"]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} style={{ display: "flex", marginBottom: 4, width: "100%" }}>
                <Form.Item
                  {...restField}
                  name={[name, "column"]}
                  style={{ flex: 1, marginBottom: 0, marginRight: 8 }}
                  rules={[{ required: true, message: "Missing column" }]}
                >
                  <Select
                    showSearch
                    allowClear
                    filterOption={(input: any, option: any) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={options}
                  ></Select>
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, "value"]}
                  style={{ flex: 1, marginBottom: 0, marginRight: 8 }}
                  rules={[{ required: true, message: "Missing column" }]}
                >
                  <Input></Input>
                </Form.Item>

                <MinusCircleOutlined onClick={() => remove(name)} />
              </div>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add field
              </Button>
            </Form.Item>
          </>
        )}
      </Form.List>
    </>
  );
};

export default NestCollectedColumnsSelect;

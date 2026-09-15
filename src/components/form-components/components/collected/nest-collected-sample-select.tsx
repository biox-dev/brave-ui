// src/components/form-components/components/collected/nest-collected-sample-select.tsx
// Repeatable CollectedSampleSelect, one card per row.
import { Button, Card, Form } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { FC } from "react";
import { CollectedSampleSelect } from "./collected-sample-select";

export const NestCollectedSampleSelect: FC<any> = ({ name, ...rest }) => (
  <>
    {rest?.label}
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name: listIndex }) => (
            <div key={key} style={{ display: "flex", marginBottom: 4, width: "100%" }}>
              <Card
                style={{ flex: 1, marginBottom: "0.5rem", marginRight: "0.5rem" }}
                size="small"
              >
                <CollectedSampleSelect
                  name={[name, listIndex]} //⭐ 把动态 index 传给子组件
                  {...rest}
                />
              </Card>
              <MinusCircleOutlined onClick={() => remove(listIndex)} />
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

export default NestCollectedSampleSelect;

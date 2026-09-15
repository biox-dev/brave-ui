// src/components/form-components/components/sample/nest-select-sample.tsx
// Repeatable (`Form.List`) sample picker. Each row is a `SelectSample` plus the
// nested sub-fields declared in `append`.
import { Button, Card, Form } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { FC } from "react";
import { AppendFields } from "../append/append-fields";
import { SelectSample } from "./select-sample";

export const NestSelectSample: FC<any> = ({ name, append, ...rest }) => (
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
                <SelectSample name={[name, listIndex]} {...rest} />
                <AppendFields append={append} prefix={[listIndex]} />
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

export default NestSelectSample;

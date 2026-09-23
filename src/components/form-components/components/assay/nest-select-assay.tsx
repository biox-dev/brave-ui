// src/components/form-components/components/assay/nest-select-assay.tsx
// Repeatable (`Form.List`) assay picker. Each row is a `SelectAssay` plus the
// nested sub-fields declared in `append`.
import { Button, Card, Form } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { FC } from "react";
import { AppendFields } from "../append/append-fields";
import { SelectAssay } from "./select-assay";

export const NestSelectAssay: FC<any> = ({ name, append, ...rest }) => (
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
                <SelectAssay name={[name, listIndex]} {...rest} />
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

export default NestSelectAssay;

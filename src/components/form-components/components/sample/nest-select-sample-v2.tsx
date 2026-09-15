// src/components/form-components/components/sample/nest-select-sample-v2.tsx
// Repeatable sample picker whose rows hold other collected selectors. The
// parent's own props are forwarded to the `CollectedSampleSelectV2` child.
import { Button, Card, Form } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { FC } from "react";
import { AppendFields } from "../append/append-fields";

export const NestSelectSampleV2: FC<any> = ({ name, append, ...grest }) => (
  <>
    {grest?.label}
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name: listIndex }) => (
            <div key={key} style={{ display: "flex", marginBottom: 4, width: "100%" }}>
              <Card
                style={{ flex: 1, marginBottom: "0.5rem", marginRight: "0.5rem" }}
                size="small"
              >
                <AppendFields
                  append={append}
                  prefix={[listIndex]}
                  variant="v2"
                  inherited={grest}
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

export default NestSelectSampleV2;

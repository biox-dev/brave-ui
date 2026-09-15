// src/components/form-components/components/collected/collected-simplpe-group-select.tsx
// Group name + colour for every collected column, laid out two per row.
import { Col, Flex, Form, Input, Row } from "antd";
import { FC } from "react";
import { ColorPickerComp } from "../shared/color-picker";

export const CollectedSimplpeGroupSelect: FC<any> = ({
  label,
  projParameter,
  name,
  columns,
}) => (
  <Row>
    {columns &&
      Array.isArray(columns) &&
      columns.map((item: any, index: any) => (
        <Col span={12} key={index}>
          <div>
            {label} {item}:
          </div>
          <Flex gap="small">
            <Form.Item name={[name, "group_name", `${item}`]}>
              <Input size="small" placeholder="Optional group name"></Input>
            </Form.Item>
            <Form.Item name={[name, "color", `${item}`]}>
              <ColorPickerComp projParameter={projParameter} />
            </Form.Item>
          </Flex>
        </Col>
      ))}
  </Row>
);

export default CollectedSimplpeGroupSelect;

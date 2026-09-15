// src/components/form-components/components/collected/simplpe-group-select.tsx
// Single group name + colour pair.
import { Flex, Form, Input } from "antd";
import { FC } from "react";
import { ColorPickerComp } from "../shared/color-picker";

export const SimplpeGroupSelect: FC<any> = ({ label, projParameter, name }) => (
  <>
    <div>{label}:</div>
    <Flex gap="small">
      <Form.Item name={[name, "group_name"]} noStyle>
        <Input size="small" placeholder="Optional group name"></Input>
      </Form.Item>
      <Form.Item name={[name, "color"]} noStyle>
        <ColorPickerComp projParameter={projParameter} />
      </Form.Item>
    </Flex>
  </>
);

export default SimplpeGroupSelect;

// src/components/form-components/components/base/base-color-picker.tsx
import { Form } from "antd";
import { FC } from "react";
import { ColorPickerComp } from "../shared/color-picker";

export const BaseColorPicker: FC<any> = ({ label, name, data, initialValue, rules, ...rest }) => (
  <Form.Item initialValue={initialValue} label={label} name={name} rules={rules}>
    <ColorPickerComp {...rest} />
  </Form.Item>
);

export default BaseColorPicker;

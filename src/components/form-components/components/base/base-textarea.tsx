// src/components/form-components/components/base/base-textarea.tsx
import { Form } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC } from "react";

export const BaseTextArea: FC<any> = ({ label, name, data, initialValue, rules, ...rest }) => (
  <Form.Item initialValue={initialValue} label={label} name={name} rules={rules}>
    <TextArea {...rest} />
  </Form.Item>
);

export default BaseTextArea;

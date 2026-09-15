// src/components/form-components/components/base/base-input.tsx
import { Form, Input } from "antd";
import { FC } from "react";

export const BaseInput: FC<any> = ({ label, name, form, data, initialValue, rules, ...rest }) => (
  <Form.Item
    initialValue={initialValue}
    label={label}
    name={name}
    rules={rules}
    tooltip={rest?.tooltip}
  >
    <Input {...rest} />
  </Form.Item>
);

export default BaseInput;

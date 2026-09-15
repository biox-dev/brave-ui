// src/components/form-components/components/base/base-input-number.tsx
import { Form, InputNumber } from "antd";
import { FC } from "react";

export const BaseInputNumber: FC<any> = ({ label, name, data, initialValue, rules, ...rest }) => (
  <Form.Item
    initialValue={initialValue}
    label={label}
    name={name}
    rules={rules}
    tooltip={rest?.tooltip}
  >
    <InputNumber {...rest} />
  </Form.Item>
);

export default BaseInputNumber;

// src/components/form-components/components/base/base-switch.tsx
import { Form, Switch } from "antd";
import { FC } from "react";

export const BaseSwitch: FC<any> = ({ label, name, data, initialValue, rules, ...rest }) => (
  <Form.Item
    initialValue={initialValue}
    label={label}
    name={name}
    rules={rules}
    tooltip={rest?.tooltip}
  >
    <Switch {...rest} />
  </Form.Item>
);

export default BaseSwitch;

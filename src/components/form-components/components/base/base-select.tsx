// src/components/form-components/components/base/base-select.tsx
// Options are passed in as `data` (resolved by `ComponentsRender` from the
// item's `dataKey` / `resolver.accept_formats`).
import { Form } from "antd";
import { FC } from "react";
import { BasicSelect } from "../shared/basic-select";

export const BaseSelect: FC<any> = ({
  extra,
  tooltip,
  label,
  name,
  data,
  initialValue,
  rules,
  ...rest
}) => (
  <Form.Item
    extra={extra}
    name={name}
    tooltip={tooltip}
    initialValue={initialValue ? initialValue : null}
    label={label}
    rules={rules}
  >
    <BasicSelect {...rest} options={data}></BasicSelect>
  </Form.Item>
);

export default BaseSelect;

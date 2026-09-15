// src/components/form-components/components/base/base-textarea-num.tsx
// Comma separated feature list. The `extra` text reports how many features were
// entered so the user gets immediate feedback.
import { Form } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC } from "react";

export const BaseTextAreaNum: FC<any> = ({
  label,
  name,
  tooltip,
  data,
  initialValue,
  rules,
  ...rest
}) => {
  const form = Form.useFormInstance();
  const content = Form.useWatch(name, form);

  return (
    <Form.Item
      tooltip={tooltip}
      extra={`A total of ${content ? content.split(",").length : 0} features are entered`}
      initialValue={initialValue}
      label={label}
      name={name}
      rules={rules}
    >
      <TextArea allowClear {...rest} rows={3} />
    </Form.Item>
  );
};

export default BaseTextAreaNum;

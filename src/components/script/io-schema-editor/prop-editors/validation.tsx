// src/components/script/io-schema-editor/prop-editors/validation.tsx
// The `rules` array is a form-json / antd pass-through; the editor only exposes
// the one rule that is used in practice: `required` + its message. Every other
// rule is preserved untouched (see `withRequired`).
import { Flex, Input, Row, Switch } from "antd";
import { Field } from "../shared/field";
import { DEFAULT_RULE_MESSAGE, isRequired, requiredMessage, withRequired } from "../normalize";
import type { PropEditor } from "../types";

export const ValidationEditor: PropEditor = ({ item, patch }) => {
  const required = isRequired(item);
  const message = requiredMessage(item);

  const setMessage = (text: string) => {
    const rules = (Array.isArray(item.rules) ? item.rules : []).map((rule: any) =>
      rule?.required ? { ...rule, message: text } : rule
    );
    patch({ ...item, rules });
  };

  return (
    <Row gutter={12}>
      <Field label="required" span={6}>
        <Flex align="center" gap={8}>
          <Switch
            size="small"
            checked={required}
            onChange={(checked) => patch(withRequired(item, checked))}
          />
        </Flex>
      </Field>
      {required && (
        <Field label="rule message" span={18}>
          <Input
            size="small"
            value={message}
            placeholder={DEFAULT_RULE_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
      )}
    </Row>
  );
};

export default ValidationEditor;

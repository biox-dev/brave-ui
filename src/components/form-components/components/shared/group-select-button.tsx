// src/components/form-components/components/shared/group-select-button.tsx
// Group shortcut buttons ("GroupA(12)"). Toggling a group writes the merged
// sample list into the sibling sample field (`field`).
import { Button, Flex, Form } from "antd";
import { FC } from "react";

export const GroupSelectButton: FC<any> = ({ value, onChange, field, sampleGrouped }) => {
  const form = Form.useFormInstance();

  const onSelectSample = (keys: any) => {
    const merged = Object.entries(sampleGrouped ? sampleGrouped : {})
      .filter(([key]) => keys.includes(key)) // 只保留特定 key
      .flatMap(([, value]) => value);
    form.setFieldValue(field, merged);
  };

  const onSelectGroup = (key: any) => {
    let currentKey: any = [];
    if ((value ? value : []).includes(key)) {
      currentKey = (value ? value : []).filter((it: any) => !it.includes(key));
      onChange(currentKey);
    } else {
      currentKey = [...(value ? value : []), key];
      onChange(currentKey);
    }
    onSelectSample(currentKey);
  };

  return (
    <Flex gap="small">
      {Object.entries(sampleGrouped ? sampleGrouped : {}).map(([key, value2]: any) => (
        <span key={key}>
          <Button
            size="small"
            type={(value ? value : []).includes(key) ? "primary" : "dashed"}
            onClick={() => onSelectGroup(key)}
          >
            {key}({value2.length})
          </Button>
        </span>
      ))}
    </Flex>
  );
};

export default GroupSelectButton;

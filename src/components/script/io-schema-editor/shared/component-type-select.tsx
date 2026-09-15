// src/components/script/io-schema-editor/shared/component-type-select.tsx
import { Select } from "antd";
import type { SelectProps } from "antd";
import { FC } from "react";
import {
  componentTypeOptionsFor,
  groupedComponentTypeOptions,
} from "@/components/form-components/registry";

/**
 * Picker for an item's `type`. Pass `allowedTypes` to restrict the choices
 * (used for `append` children, whose parent only knows how to render a few
 * component types).
 */
export const ComponentTypeSelect: FC<{
  value?: string;
  onChange?: (value: any) => void;
  placeholder?: string;
  allowedTypes?: readonly string[];
}> = ({ value, onChange, placeholder, allowedTypes }) => {
  const options: SelectProps["options"] =
    allowedTypes && allowedTypes.length
      ? componentTypeOptionsFor(allowedTypes)
      : groupedComponentTypeOptions;

  return (
    <Select
      size="small"
      showSearch
      allowClear
      value={value}
      placeholder={placeholder ?? "Select component type"}
      style={{ width: "100%" }}
      optionFilterProp="label"
      options={options}
      onChange={onChange}
    />
  );
};

export default ComponentTypeSelect;

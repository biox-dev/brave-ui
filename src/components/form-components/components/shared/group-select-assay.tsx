// src/components/form-components/components/shared/group-select-assay.tsx
// A multi/single select over assays grouped by a metadata field. When several
// assays are selected it reports how many were picked.
import { Select } from "antd";
import { FC } from "react";

export const GroupSelectAssay: FC<any> = ({
  value,
  onChange,
  mode,
  sampleGroup,
  watch,
  sampleGrouped,
}) => (
  <>
    <Select
      showSearch
      allowClear
      filterOption={(input: any, option: any) =>
        (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
      }
      mode={mode}
      value={value}
      onChange={onChange}
      options={sampleGroup}
    ></Select>
    {mode == "multiple" && value && <>A total of {value.length} assays were selected</>}
  </>
);

export default GroupSelectAssay;

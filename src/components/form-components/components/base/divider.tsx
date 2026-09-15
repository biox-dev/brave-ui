// src/components/form-components/components/base/divider.tsx
import { Divider } from "antd";
import { FC } from "react";

/** Section title — layout only, no form field. */
export const DividerComp: FC<any> = ({ text }) => <Divider orientation="left">{text}</Divider>;

export default DividerComp;

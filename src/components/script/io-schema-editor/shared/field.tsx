// src/components/script/io-schema-editor/shared/field.tsx
import { Col } from "antd";
import { FC, ReactNode } from "react";
import { Typography } from "antd";

/** Small labelled cell used by every property editor. */
export const Field: FC<{ label: string; span?: number; children: ReactNode }> = ({
  label,
  span = 8,
  children,
}) => (
  <Col span={span}>
    <div style={{ marginBottom: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      <div style={{ marginTop: 2 }}>{children}</div>
    </div>
  </Col>
);

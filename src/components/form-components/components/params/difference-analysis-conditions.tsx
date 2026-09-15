// src/components/form-components/components/params/difference-analysis-conditions.tsx
// Diff-analysis parameter block. Writes three synthetic fields prefixed with
// `__<name>_` so they never collide with real form fields.
import { Col, Form, InputNumber, Row, Select } from "antd";
import { FC } from "react";
import { DividerComp } from "../base/divider";

export const DifferenceAnalysisConditions: FC<any> = ({ label, sig_type, name, rules }) => (
  <>
    <DividerComp text={label}></DividerComp>
    <Row gutter={[8, 8]}>
      <Col span={12}>
        <Form.Item
          initialValue={sig_type && sig_type[0]?.value}
          label="Significant level type"
          name={`__${name}_sig_type`}
          tooltip="Choose the type of significance value: p-value or q-value (adjusted p-value)."
          rules={rules}
        >
          <Select options={sig_type} />
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          initialValue={0.05}
          label="Significant level threshold"
          name={`__${name}_sig_threshold`}
          tooltip="Threshold below which a result is considered statistically significant, e.g., 0.05."
          rules={rules}
        >
          <InputNumber style={{ width: "100%" }} min={0} max={1} step={0.01} />
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          initialValue={0}
          label="Effect threshold"
          name={`__${name}_effect_threshold`}
          tooltip="Minimum effect size (e.g., log2 fold change) required to consider a result biologically meaningful."
          rules={rules}
        >
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>
      </Col>
    </Row>
  </>
);

export default DifferenceAnalysisConditions;

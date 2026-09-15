// src/components/form-components/components/params/heatmap-params.tsx
// Heatmap output parameters. Like DifferenceAnalysisConditions, the fields are
// synthetic and prefixed with `__<name>_`.
import { Col, Form, Input, InputNumber, Row, Switch } from "antd";
import { FC } from "react";
import { DividerComp } from "../base/divider";

export const HeatmapParams: FC<any> = ({ label, name, rules }) => (
  <>
    <DividerComp text={label} />
    <Row gutter={[8, 8]}>
      <Col span={24}>
        <Form.Item initialValue={""} label="title" name={`__${name}_title`} tooltip="heatmap title.">
          <Input />
        </Form.Item>
      </Col>
      {/* Width */}
      <Col span={12}>
        <Form.Item
          initialValue={8}
          label="Width (inches)"
          name={`__${name}_width`}
          tooltip="Width of the output PDF in inches."
          rules={rules}
        >
          <InputNumber style={{ width: "100%" }} min={1} step={0.5} />
        </Form.Item>
      </Col>

      {/* Height */}
      <Col span={12}>
        <Form.Item
          initialValue={8}
          label="Height (inches)"
          name={`__${name}_height`}
          tooltip="Height of the output PDF in inches."
          rules={rules}
        >
          <InputNumber style={{ width: "100%" }} min={1} step={0.5} />
        </Form.Item>
      </Col>

      {/* cluster_rows */}
      <Col span={12}>
        <Form.Item
          initialValue={true}
          label="Cluster rows"
          name={`__${name}_cluster_rows`}
          tooltip="Whether to perform hierarchical clustering on rows."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>

      {/* cluster_cols */}
      <Col span={12}>
        <Form.Item
          initialValue={true}
          label="Cluster columns"
          name={`__${name}_cluster_cols`}
          tooltip="Whether to perform hierarchical clustering on columns."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>

      {/* show_rownames */}
      <Col span={12}>
        <Form.Item
          initialValue={true}
          label="Show row names"
          name={`__${name}_show_rownames`}
          tooltip="Display row labels in the heatmap."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>

      {/* show_colnames */}
      <Col span={12}>
        <Form.Item
          initialValue={true}
          label="Show column names"
          name={`__${name}_show_colnames`}
          tooltip="Display column labels in the heatmap."
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Col>
    </Row>
  </>
);

export default HeatmapParams;

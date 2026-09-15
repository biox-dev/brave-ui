// src/components/form-components/components/base/three-color-picker.tsx
// Low / middle / high colour triple, used by gradient style parameters.
import { Col, Flex, Form, Row, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { FC, useEffect, useState } from "react";
import { ColorPickerComp } from "../shared/color-picker";

export const ThreeColorPicker: FC<any> = ({
  label,
  name,
  data,
  initialValue: initialValue_,
  rules,
  ...rest
}) => {
  const [initialValue, setInitialValue] = useState<any>([null, null, null]);

  useEffect(() => {
    if (initialValue_ && Array.isArray(initialValue_) && initialValue_.length == 3) {
      setInitialValue(initialValue_);
    }
  }, [initialValue_]);

  return (
    <>
      <Flex gap={"small"}>
        <div>{label}</div>
        <Tooltip
          title={`The first color represents a low value, and the third color represents a high value.`}
        >
          <QuestionCircleOutlined style={{ color: "rgba(0,0,0,0.45)" }} />
        </Tooltip>
      </Flex>

      <Row gutter={[8, 0]}>
        <Col span={8}>
          <Form.Item noStyle initialValue={initialValue[0]} name={[name, "color1"]} rules={rules}>
            <ColorPickerComp {...rest} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item initialValue={initialValue[1]} noStyle name={[name, "color2"]} rules={rules}>
            <ColorPickerComp {...rest} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item initialValue={initialValue[2]} noStyle name={[name, "color3"]} rules={rules}>
            <ColorPickerComp {...rest} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
};

export default ThreeColorPicker;

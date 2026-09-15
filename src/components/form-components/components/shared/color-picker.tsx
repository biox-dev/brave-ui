// src/components/form-components/components/shared/color-picker.tsx
// Colour picker whose presets come from the project parameter
// (`projParameter.colors`). Emits a hex string.
import { Col, ColorPicker, ColorPickerProps, Divider, Row } from "antd";
import { FC } from "react";

export const ColorPickerComp: FC<any> = ({ projParameter, value, onChange, ...rest }) => {
  const customPanelRender: ColorPickerProps["panelRender"] = (
    _,
    { components: { Picker, Presets } }
  ) => (
    <Row justify="space-between" wrap={false}>
      <Col span={12}>
        <Presets />
      </Col>
      <Divider type="vertical" style={{ height: "auto" }} />
      <Col flex="auto">
        <Picker />
      </Col>
    </Row>
  );

  return (
    <ColorPicker
      styles={{ popupOverlayInner: { width: 480 } }}
      panelRender={projParameter?.colors ? customPanelRender : undefined}
      presets={projParameter?.colors ? projParameter?.colors : []}
      allowClear
      value={value}
      onChange={(color) => {
        const hexColor = color.toHexString();
        onChange(hexColor);
      }}
    />
  );
};

export default ColorPickerComp;

// src/components/form-components/core/form-json-comp.tsx
// Renders a whole `formJson` array.
//
// Layout is one `Col` per item (`item.col`, defaulting to 24). Items declaring
// `depends` are wrapped in a `Form.Item` with `shouldUpdate`, scoped to only the
// fields that item actually watches, so unrelated keystrokes do not re-render
// the form.
import { Col, Form, Row } from "antd";
import { FC, memo, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { checkDepends, extractDependsNames } from "./depends";
import { ComponentsRender } from "./components-render";
import { componentMap } from "./component-map";

const RANK_OPTIONS = [
  { label: "SGB", value: "SGB" },
  { label: "SPECIES", value: "SPECIES" },
  { label: "GENUS", value: "GENUS" },
  { label: "FAMILY", value: "FAMILY" },
  { label: "ORDER", value: "ORDER" },
  { label: "CLASS", value: "CLASS" },
  { label: "PHYLUM", value: "PHYLUM" },
];

export const FormJsonComp: FC<any> = memo(
  ({ formJson, dataMap = {}, analysisResultId }) => {
    const { projectObj } = useSelector((state: any) => state.user);
    const [parameter, setParameter] = useState<any>();

    useEffect(() => {
      if (projectObj?.parameter) {
        try {
          setParameter(JSON.parse(projectObj?.parameter));
        } catch (e) {
          setParameter({});
        }
      }
    }, [projectObj?.parameter]);

    // Hooks must run before this bail-out, otherwise switching from "no
    // formJson" to "formJson" would change the hook count between renders.
    if (!formJson) return null;

    const getGroupField = () => {
      if (!projectObj?.metadata_form) return [];
      return projectObj?.metadata_form.map((item: any) => ({
        label: item.label,
        value: item.name,
      }));
    };

    // Data sources that do not come from the analysis result: project level
    // constants injected on top of `dataMap`.
    const constDataMap = {
      rank: RANK_OPTIONS,
      group_field: getGroupField(),
    };

    return (
      <Row gutter={[8, 0]}>
        {formJson.map((it: any, index: any) => {
          const dependNames = [...new Set(extractDependsNames(it.depends))];

          const renderItem = () => (
            <Col span={it?.col ? it?.col : 24} key={index}>
              <ComponentsRender
                projParameter={parameter}
                analysisResultId={analysisResultId}
                key={index}
                {...it}
                dataMap={dataMap}
                componentMap={componentMap}
                constDataMap={constDataMap}
              ></ComponentsRender>
            </Col>
          );

          // No `depends` → nothing to watch, do not subscribe to form updates.
          if (!it.depends) return renderItem();

          return (
            <Form.Item
              key={index}
              noStyle
              shouldUpdate={(prev, cur) =>
                dependNames.some((name) => prev[name] !== cur[name])
              }
            >
              {({ getFieldValue }) =>
                checkDepends(it.depends, getFieldValue) ? renderItem() : null
              }
            </Form.Item>
          );
        })}
      </Row>
    );
  },
  // The form is driven by `formJson` + `dataMap`; anything else changing should
  // not re-render it (it holds a lot of state and network-loaded options).
  (prevProps, nextProps) => JSON.stringify(prevProps) === JSON.stringify(nextProps)
);

export default FormJsonComp;

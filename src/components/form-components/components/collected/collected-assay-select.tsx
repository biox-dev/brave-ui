// src/components/form-components/components/collected/collected-assay-select.tsx
// Table picker over the results of upstream analyses. For every collected column
// it projects one extra form field (`<name>.<column>`, plus `<column>_group`
// when the matching `groups[i]` flag is set) and keeps `node_name` in sync with
// the group names.
import { Form, Input, Select } from "antd";
import { FC, useEffect, useState } from "react";
import { useStoreForm } from "@/context/form/FormProvider";
import { AppendFields } from "../append/append-fields";

export const CollectedAssaySelect: FC<any> = ({
  label,
  modes = [],
  columns,
  append,
  groups,
  name: name_,
  columns_rules = [],
  rules,
  data,
  filter,
  group,
  groupField: groupField_,
  analysisResultId,
}) => {
  const [options, setOptions] = useState<any>([]);
  const [collectFiles, setCollectFiles] = useState<any>([]);
  const { addColumns } = useStoreForm();
  let name = name_;
  if (name_ instanceof Array && name_.length > 1) {
    name = name_[1];
  } else {
    name_ = [name_];
  }

  const form = Form.useFormInstance();
  const basePath = Array.isArray(name_) ? [...name_] : [name_];

  let filterName: any = [];
  if (filter) {
    filterName = filter.map((it: any) => it.name);
  }
  const customFilterValue = Form.useWatch((values) => {
    const data = Object.entries(values).filter(([key]) => filterName.includes(key));
    return Object.fromEntries(data);
  }, form);

  const groupField = Form.useWatch(group, form);
  const groupFormValues = Form.useWatch(basePath, form);
  const selectCollectFile = Form.useWatch([...name_, "file"], form);

  useEffect(() => {
    if (data && Array.isArray(data)) {
      const collectedFiles = data.map((it: any) => ({
        label: `${it.file_name}`,
        value: it.id,
      }));
      setCollectFiles(collectedFiles);
    }
  }, [data]);

  useEffect(() => {
    if (selectCollectFile) {
      let columnsData = data.find((it: any) => it.id == selectCollectFile);
      if (columnsData) {
        // 后端只给 EXP / TABLE 角色的文件生成 `columns`（buildCompatFileItem），
        // 多个 accept_formats 合并成候选列表后可能选到没有 `columns` 的文件。
        const columnList = Array.isArray(columnsData.columns) ? columnsData.columns : [];
        columnsData = columnList.map((it: any) => ({
          label: it.columns_name,
          value: it.columns_name,
          ...it,
        }));
        if (filter && customFilterValue) {
          columnsData = filter.reduce((result: any, filterHandle: any) => {
            return result.filter((item: any) => {
              return filterHandle.method(item) === customFilterValue[filterHandle.name];
            });
          }, columnsData);

          columnsData = columnsData.map((it: any) => {
            const { label, id, value, ...rest } = it;
            return {
              label: `${it.label}(${filter[0].method(it)})`,
              value: it.value,
              ...rest,
            };
          });
        }

        setOptions(columnsData);
        addColumns(name, columnsData);
      }
    }
  }, [data, selectCollectFile, groupField, customFilterValue]);

  // `node_name` is derived from the selected group names, so downstream nodes can
  // reference this selection by a stable name.
  useEffect(() => {
    if (!Array.isArray(columns) || columns.length === 0) return;

    const nodeName = columns
      .map((item: any) => groupFormValues?.[`${item}_group`])
      .filter((value: any) => typeof value === "string" && value.trim() !== "")
      .map((value: string) => value.trim())
      .join("_vs_");

    if ((groupFormValues?.node_name ?? "") !== nodeName) {
      form.setFieldValue([...basePath, "node_name"], nodeName || undefined);
    }
  }, [columns, groupFormValues, form, basePath]);

  return (
    <>
      <Form.Item label={`${label} File`} name={[name, "file"]} rules={rules}>
        <Select options={collectFiles}></Select>
      </Form.Item>

      <Form.Item style={{ display: "none" }} label={`Node Name`} name={[name, `node_name`]}>
        <Input placeholder="Auto generated from group names" />
      </Form.Item>

      {columns &&
        Array.isArray(columns) &&
        columns.map((item: any, index: any) => (
          <div key={index}>
            <Form.Item
              label={`${item} Columns`}
              name={[name, item]}
              rules={[
                {
                  required: columns_rules[index] ? true : false,
                  message: "This field cannot be empty!",
                },
              ]}
            >
              <Select
                showSearch
                allowClear
                mode={modes[index] ? "multiple" : undefined}
                filterOption={(input: any, option: any) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={options}
              ></Select>
            </Form.Item>

            {groups && groups[index] != 0 && (
              <Form.Item label={`${item} Group Name`} name={[name, `${item}_group`]}>
                <Input></Input>
              </Form.Item>
            )}
          </div>
        ))}

      <AppendFields append={append} prefix={[name]} />
    </>
  );
};

export default CollectedAssaySelect;

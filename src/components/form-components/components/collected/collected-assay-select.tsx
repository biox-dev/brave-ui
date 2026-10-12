// src/components/form-components/components/collected/collected-assay-select.tsx
// Table picker over the results of upstream analyses. For every collected column
// it projects one extra form field (`<name>.<column>`, plus `<column>_group`
// when the matching `groups[i]` flag is set) and keeps `node_name` in sync with
// the group names.
import { Button, Form, Input, Select, Space } from "antd";
import { FC, useEffect, useState } from "react";
import { TableOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useStoreForm } from "@/context/form/FormProvider";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { getFileColumnsApi } from "@/api/data";
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
  resolver,
  groupField: groupField_,
  analysisResultId,
}) => {
  const [options, setOptions] = useState<any>([]);
  const [collectFiles, setCollectFiles] = useState<any>([]);
  // Raw columns of the selected file. Flat array for tsv/csv, or a
  // { sheetName: column[] } map for Excel workbooks.
  const [fileColumns, setFileColumns] = useState<any>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  // 正在按需拉取列（/data/file/columns）时置为 true，供下拉框展示 loading。
  const [columnsLoading, setColumnsLoading] = useState(false);
  const { addColumns } = useStoreForm();
  const message = useGlobalMessage();
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
  const selectSheet = Form.useWatch([...basePath, "sheet"], form);
  const selectedFile = Array.isArray(data)
    ? data.find((it: any) => it.id == selectCollectFile)
    : undefined;

  useEffect(() => {
    if (data && Array.isArray(data)) {
      const collectedFiles = data.map((it: any) => ({
        label: `${it.label}`,
        value: it.id,
      }));
      setCollectFiles(collectedFiles);
    }
  }, [data]);

  // 后端不再在文件列表里内联 columns（buildCompatFileItem），因此选中的文件
  // 只要 role=TABLE 就按需调用 /data/file/columns 获取列：tsv/csv 返回扁平数组，
  // Excel 返回 { sheetName: [...] }。
  useEffect(() => {
    setFileColumns(null);
    setSheetNames([]);
    setColumnsLoading(false);

    if (!selectCollectFile || !Array.isArray(data)) return;

    const fileObj = data.find((it: any) => it.id == selectCollectFile);
    if (!fileObj) return;

    if (fileObj.role !== "TABLE") {
      // 兼容：payload 仍带内联 columns 时直接使用。
      if (fileObj.columns) setFileColumns(fileObj.columns);
      return;
    }

    let cancelled = false;
    setColumnsLoading(true);
    const fileId = String(fileObj.file_id ?? fileObj.id ?? selectCollectFile);
    getFileColumnsApi(fileId)
      .then((resp: any) => {
        if (cancelled) return;
        setFileColumns(resp?.data?.columns ?? null);
      })
      .catch(() => {
        if (!cancelled) setFileColumns(null);
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, selectCollectFile]);

  // 根据已获取的列构建下拉选项：Excel 需要先确定 sheet（保留上次选择或退回第一个）。
  useEffect(() => {
    if (!fileColumns) {
      setOptions([]);
      return;
    }

    let columnList: any[] = [];
    if (Array.isArray(fileColumns)) {
      // tsv / csv：扁平列数组，没有 sheet 维度。
      setSheetNames([]);
      columnList = fileColumns;
    } else if (typeof fileColumns === "object") {
      const sheets = Object.keys(fileColumns);
      setSheetNames(sheets);
      const activeSheet =
        selectSheet && sheets.includes(selectSheet) ? selectSheet : sheets[0];
      if (activeSheet && activeSheet !== selectSheet) {
        form.setFieldValue([...basePath, "sheet"], activeSheet);
      }
      columnList =
        activeSheet && Array.isArray(fileColumns[activeSheet]) ? fileColumns[activeSheet] : [];
    }

    let columnsData = columnList.map((it: any) => ({
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
  }, [fileColumns, selectSheet, filter, customFilterValue, groupField]);

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

  // 使用选中的 `[name, "file"]` 打开 Univer 表格预览弹窗。select 的值是文件主键 id，
  // Univer 需要业务 file_id，因此先回查 data 取 file_id（缺失时退回主键）。
  const handleOpenSheet = () => {
    const fileId = String(selectedFile?.file_id ?? selectCollectFile ?? "").trim();
    if (!fileId) {
      message.error("Invalid file id");
      return;
    }
    invoke.univerView.open(
      { file_id: fileId },
      { width: "90%", title: `Sheet: ${selectedFile?.file_name ?? fileId}`, footer: null }
    );
  };

  // 打开收集到的全部 data 详情列表（invoke 弹窗），可只读查看并在此直接
  // 打开 sheet / 编辑 / 删除；从列表中选择一行则回填为当前文件。
  const handleOpenFileList = async () => {
    try {
      const selected = await invoke.collectedFileList.openDrawerAsync(
        { data, title: `${label} Files`, resolver },
        { width: 900, title: `${label} Files` }
      );
      if (selected?.id != null) {
        form.setFieldValue([...basePath, "file"], selected.id);
      }
    } catch {
      // user cancelled
    }
  };

  // Excel 文件的 sheet 选择器：根据文件格式立即渲染（拉取列期间显示 loading），
  // 避免等接口返回后 sheet 才突然出现造成布局跳动。
  const excelSelected =
    !!selectCollectFile &&
    ["xlsx", "xlsm", "xls"].includes(
      String(selectedFile?.format ?? "").toLowerCase().trim()
    );
  const showSheetField = excelSelected || sheetNames.length > 0;

  return (
    <>
    {/* {JSON.stringify(resolver)} */}
      <Form.Item label={`${label} File`}>
        <Space.Compact style={{ width: "100%" }}>
          <Form.Item name={[name, "file"]} rules={rules} noStyle>
            <Select options={collectFiles}></Select>
          </Form.Item>
          <Button
            icon={<TableOutlined />}
            disabled={!selectCollectFile}
            onClick={handleOpenSheet}
          >
            Open
          </Button>
          <Button
            icon={<UnorderedListOutlined />}
            disabled={!Array.isArray(data) || data.length === 0}
            onClick={handleOpenFileList}
          >
            List
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item style={{ display: "none" }} label={`Node Name`} name={[name, `node_name`]}>
        <Input placeholder="Auto generated from group names" />
      </Form.Item>

      {showSheetField && (
        <Form.Item label={`${label} Sheet`} name={[...basePath, "sheet"]}>
          <Select
            loading={columnsLoading}
            options={sheetNames.map((sheet) => ({ label: sheet, value: sheet }))}
          ></Select>
        </Form.Item>
      )}

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
                loading={columnsLoading}
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

import { useEffect, useState } from "react";
import { AutoComplete, Button, Flex, Form, Input } from "antd";
import { createFileApi, updateFileApi } from "@/api/data";
import type { DataFileItem } from "@/api/data";

export interface EditAssayFilePageProps {
  /** PK of the assay that owns the file; required when creating. */
  assay_id?: string;
  /** Human readable assay label, echoed back in the form. */
  assay_label?: string;
  /** Existing file to edit; omit to create a new file owned by the assay. */
  file?: DataFileItem;
  onOk?: (result: unknown) => void;
  onCancel?: () => void;
  close?: () => void;
}

// go_file.file_key is the key an analysis form input maps onto its
// resolver.accept_formats, so both conventions in use are suggested (assay keys
// such as FASTQ_R1 and format names such as fasta) but any value is allowed.
const FILE_KEY_OPTIONS = [
  "FASTQ",
  "FASTQ_R1",
  "FASTQ_R2",
  "BAM",
  "CRAM",
  "VCF",
  "BCF",
  "fasta",
  "gtf",
  "bed",
  "tsv",
  "csv",
  "DEFAULT",
  "TABLE",
  "PHENOTYPE",
].map((value) => ({ value }));

const baseName = (path: string) => path.split("/").filter(Boolean).pop() ?? "";

const extensionOf = (path: string) => {
  const name = baseName(path);
  const index = name.lastIndexOf(".");
  // A leading dot means a hidden file (".env"), not an extension.
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
};

const EditAssayFilePage = ({
  assay_id,
  assay_label,
  file,
  onOk,
  onCancel,
  close,
}: EditAssayFilePageProps) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(file?.id);

  useEffect(() => {
    if (!file) {
      form.resetFields();
      return;
    }

    const path = file.path || "";
    form.setFieldsValue({
      path,
      file_name: file.file_name || baseName(path),
      format: file.format || extensionOf(path),
      file_key: file.file_key,
      description: file.description,
    });
  }, [file, form]);

  const handleSubmit = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return; // validation error, keep the drawer open
    }

    const path = String(values.path ?? "").trim();
    const fileName = String(values.file_name ?? "").trim() || baseName(path);
    const format = String(values.format ?? "").trim() || extensionOf(path);
    const fileKey = String(values.file_key ?? "").trim();
    const description = String(values.description ?? "").trim();

    try {
      setSaving(true);
      // The HTTP layer toasts API failures globally, so no error toast here.
      const result = isEdit
        ? await updateFileApi({ id: file!.id, path, file_name: fileName, format, file_key: fileKey, description })
        : await createFileApi({ assay_id, path, file_name: fileName, format, file_key: fileKey, description });
      onOk?.(result);
    } catch {
      // already reported by the global interceptor; keep the drawer open
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item label="Assay">
        <Input
          value={assay_label || (assay_id ? `Assay ${assay_id}` : "-")}
          disabled
        />
      </Form.Item>

      <Form.Item
        name="path"
        label="Path"
        rules={[{ required: true, message: "Please input the absolute file path" }]}
        tooltip="Absolute path on the storage server. It is handed to the workflow as this assay's input. Editing it re-points this record at another file."
      >
        <Input placeholder="e.g. /data2/brave_analysis_workspace/data/<project_id>/sample1.fastq.gz" />
      </Form.Item>

      <Form.Item name="file_name" label="File Name" tooltip="Leave empty to use the path's file name">
        <Input placeholder="Defaults to the path's file name" />
      </Form.Item>

      <Form.Item name="format" label="Format" tooltip="Leave empty to use the path's extension">
        <Input placeholder="e.g. fastq, bam, vcf" />
      </Form.Item>

      <Form.Item
        name="file_key"
        label="File Key"
        rules={[{ required: true, message: "Please input the file key" }]}
        tooltip="Key of the file inside this assay. Analysis form inputs map it onto their accept formats."
      >
        <AutoComplete
          options={FILE_KEY_OPTIONS}
          placeholder="e.g. FASTQ, BAM, VCF"
          filterOption={(input, option) =>
            String(option?.value ?? "").toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Optional" />
      </Form.Item>

      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={saving} disabled={!isEdit && !assay_id} onClick={handleSubmit}>
          {isEdit ? "Save" : "Add"}
        </Button>
      </Flex>
    </Form>
  );
};

export default EditAssayFilePage;

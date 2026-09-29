import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Select } from "antd";
import {
  createAssayApi,
  createDatasetAssayApi,
  updateAssayApi,
} from "@/api/data";
import type { AssayDetailItem, AssayItem, DatasetItem } from "@/api/data";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { ASSAY_ROLE_OPTIONS } from "@/utils/assay-roles";

export interface EditAssayPageProps {
  /** Edit mode: the assay as returned by the assay page. */
  assay?: AssayItem;
  /**
   * Create mode: the dataset the new assay is bound to (go_dataset_assay). The
   * binding is written right after the assay is created.
   */
  dataset?: Pick<DatasetItem, "id" | "dataset_name">;
  onOk?: (result: AssayDetailItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Assay create & edit form.
 *
 * An assay carries its own biological sample name (go_assay.sample_name); there is
 * no separate Sample entity any more. A dataset binds to the assay through
 * go_dataset_assay, so when the form is opened with a `dataset` the create flow
 * also writes that binding.
 *
 * Files are NOT part of this form: `go_file.assay_id` owns the assay -> file
 * relation, and files are added from the assay's file actions.
 */
const EditAssayPage = ({ assay, dataset, onOk, onCancel, close }: EditAssayPageProps) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();

  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(assay?.id);

  useEffect(() => {
    if (isEdit && assay) {
      form.setFieldsValue({
        sample_name: assay.sample_name ?? "",
        assay_type: assay.assay_type ?? "",
        platform: assay.platform ?? "",
        library_id: assay.library_id ?? "",
        role: assay.role ?? "",
        metadata: assay.metadata ?? "",
        description: assay.description ?? "",
      });
      return;
    }

    form.resetFields();
  }, [assay, isEdit, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        sample_name: String(values.sample_name ?? "").trim(),
        assay_type: trimOrUndefined(values.assay_type),
        platform: trimOrUndefined(values.platform),
        library_id: trimOrUndefined(values.library_id),
        role: trimOrUndefined(values.role),
        metadata: trimOrUndefined(values.metadata),
        description: trimOrUndefined(values.description),
      };

      if (isEdit) {
        await updateAssayApi({ id: assay!.id, ...payload });
        message.success("Assay updated successfully");
        onOk?.(assay as AssayItem);
        return;
      }

      const created = await createAssayApi(payload);
      const saved = created.data as AssayDetailItem;
      if (dataset?.id && saved?.id) {
        await createDatasetAssayApi({
          dataset_id: String(dataset.id),
          assay_id: String(saved.id),
        });
      }
      message.success("Assay created successfully");
      onOk?.(saved);
    } catch (error: any) {
      if (error?.errorFields) return; // validation error, keep the drawer open
      message.error(isEdit ? "Failed to update assay" : "Failed to create assay");
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
    <>
      <Form form={form} layout="vertical">
        <Form.Item
          name="sample_name"
          label="Sample Name"
          tooltip="Business identifier of the biological sample this assay was built from; it only has to be unique inside a dataset."
          rules={[{ required: true, message: "Please input the sample name" }]}
        >
          <Input placeholder="e.g. S-001" />
        </Form.Item>

        <Form.Item name="assay_type" label="Assay Type">
          <Input placeholder="e.g. WGS, RNA-seq" />
        </Form.Item>

        <Form.Item name="platform" label="Platform">
          <Input placeholder="e.g. Illumina NovaSeq" />
        </Form.Item>

        <Form.Item name="library_id" label="Library ID">
          <Input placeholder="Library identifier" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Role"
          tooltip="Matched against an analysis form input's resolver.accept_formats, e.g. WGS_SHORT_READ or DEFAULT/TABLE (same convention as a dataset file's role). Leave empty for no role filtering."
        >
          <Select allowClear options={ASSAY_ROLE_OPTIONS} placeholder="e.g. WGS_SHORT_READ" />
        </Form.Item>

        <Form.Item name="metadata" label="Metadata">
          <Input.TextArea rows={3} placeholder="Free-form metadata" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Description" />
        </Form.Item>
      </Form>

      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={saving} onClick={handleSubmit}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </>
  );
};

export default EditAssayPage;

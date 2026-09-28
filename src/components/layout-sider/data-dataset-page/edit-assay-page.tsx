import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Space, Tooltip } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createAssayApi, getSampleApi, updateAssayApi } from "@/api/data";
import type { AssayDetailItem, AssayItem, SampleItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface EditAssayPageProps {
  /** Edit mode: the assay as returned by the sample page. */
  assay?: AssayItem;
  /** Create mode: the owning sample (usually the expanded sample row). */
  sample?: SampleItem;
  onOk?: (result: AssayDetailItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const sampleLabel = (sample?: SampleItem) =>
  sample ? sample.sample_name || sample.sample_key || sample.id : "";

/**
 * Assay create & edit form.
 *
 * An assay belongs to a Sample and carries nothing else: it has no dataset
 * binding of its own (go_dataset_assay is gone), so the dataset is only
 * involved when the sample is created/picked — the Subject -> Dataset binding
 * lives on DatasetSubject. That is why this form only asks for a sample.
 *
 * Files are NOT part of this form: `go_file.assay_id` owns the assay -> file
 * relation, and files are added from the assay's file actions.
 *
 * "Select" opens the sample picker drawer (sampleProjectPage) and "New" opens
 * the sample form (editSamplePage), which in turn handles the subject (the
 * subject form handles the dataset).
 */
const EditAssayPage = ({ assay, sample, onOk, onCancel, close }: EditAssayPageProps) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();

  const [saving, setSaving] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleItem>();

  const isEdit = Boolean(assay?.id);

  useEffect(() => {
    if (isEdit && assay) {
      form.setFieldsValue({
        assay_type: assay.assay_type ?? "",
        platform: assay.platform ?? "",
        library_id: assay.library_id ?? "",
        role: assay.role ?? "",
        metadata: assay.metadata ?? "",
      });

      // The assay only stores sample_id, so fetch the sample for its label.
      let cancelled = false;
      const loadSample = async () => {
        if (!assay.sample_id) {
          return;
        }
        const response = await getSampleApi(assay.sample_id).catch(() => undefined);
        if (!cancelled && response?.data) {
          setSelectedSample(response.data);
        }
      };

      void loadSample();
      return () => {
        cancelled = true;
      };
    }

    form.resetFields();
    setSelectedSample(sample);
  }, [assay, sample, isEdit, form]);

  const handleSelectSample = async () => {
    try {
      const picked = await invoke.sampleProjectPage.openDrawerAsync(
        {},
        { width: 900, title: "Select Sample" }
      );
      if (picked?.id) {
        setSelectedSample(picked as SampleItem);
      }
    } catch {
      // user cancelled
    }
  };

  const handleCreateSample = async () => {
    try {
      const created = await invoke.editSamplePage.openDrawerAsync(
        {},
        { width: 560, title: "New Sample" }
      );
      if (created?.id) {
        setSelectedSample(created as SampleItem);
      }
    } catch {
      // user cancelled
    }
  };

  const handleSubmit = async () => {
    if (!selectedSample?.id) {
      message.error("Please select or create a sample");
      return;
    }

    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        sample_id: String(selectedSample.id),
        assay_type: trimOrUndefined(values.assay_type),
        platform: trimOrUndefined(values.platform),
        library_id: trimOrUndefined(values.library_id),
        role: trimOrUndefined(values.role),
        metadata: trimOrUndefined(values.metadata),
      };

      if (isEdit) {
        await updateAssayApi({ id: assay!.id, ...payload });
        message.success("Assay updated successfully");
        onOk?.(assay as AssayItem);
        return;
      }
      const created = await createAssayApi(payload);
      message.success("Assay created successfully");
      onOk?.(created.data);
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
          label="Sample"
          required
          tooltip="The assay belongs to this sample; the sample's subject is in turn bound to a project dataset (DatasetSubject)"
        >
          <Space.Compact style={{ width: "100%" }}>
            <Tooltip title={sampleLabel(selectedSample)}>
              <Input
                readOnly
                value={sampleLabel(selectedSample)}
                placeholder="Click to select a sample"
                onClick={handleSelectSample}
                style={{ cursor: "pointer", flex: 1 }}
              />
            </Tooltip>
            <Button onClick={handleSelectSample}>
              {selectedSample ? "Change" : "Select"}
            </Button>
            <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleCreateSample}>
              New
            </Button>
          </Space.Compact>
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
          tooltip="Matched against an analysis form input's resolver.accept_formats, e.g. DEFAULT or TABLE (same convention as a dataset file's role). Leave empty for no role filtering."
        >
          <Input placeholder="e.g. DEFAULT, TABLE" />
        </Form.Item>

        <Form.Item name="metadata" label="Metadata">
          <Input.TextArea rows={3} placeholder="Free-form metadata" />
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

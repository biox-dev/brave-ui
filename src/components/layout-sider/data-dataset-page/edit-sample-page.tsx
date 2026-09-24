import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Space, Tooltip } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createSampleApi, updateSampleApi } from "@/api/data";
import type { SampleItem, SubjectItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/** Sample as edited here; `subject_name` is only present on the paged read model. */
export type SampleFormSource = SampleItem & { subject_name?: string };

export interface EditSamplePageProps {
  /** When provided the form updates the sample, otherwise it creates a new one. */
  sample?: SampleFormSource;
  /** Optional pre-selected owning subject (used when creating from the assay form). */
  subject?: SubjectItem;
  onOk?: (result: SampleItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

/** Picker label: prefer the machine-readable business key (go_subject.subject_key). */
const subjectLabel = (subject?: SubjectItem) =>
  subject ? subject.subject_key || subject.subject_name || subject.id : "";

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** ISO string -> value accepted by <input type="datetime-local"> (local time). */
const isoToLocalInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

/** <input type="datetime-local"> value -> ISO string for the backend. */
const localInputToIso = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * Sample create & edit form.
 *
 * A Sample always belongs to a Subject, so the subject can be picked from the
 * Subject page drawer or created on the fly through the Subject form drawer.
 */
const EditSamplePage = ({ sample, subject, onOk, onCancel, close }: EditSamplePageProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | undefined>();
  const message = useGlobalMessage();

  const isEdit = Boolean(sample?.id);

  useEffect(() => {
    if (isEdit && sample) {
      form.setFieldsValue({
        sample_key: sample.sample_key ?? "",
        sample_name: sample.sample_name ?? "",
        tissue: sample.tissue ?? "",
        cell_type: sample.cell_type ?? "",
        collection_time: isoToLocalInput(sample.collection_time),
        metadata: sample.metadata ?? "",
        description: sample.description ?? "",
      });
      // Editing: the read model carries the subject name, reuse it as the label.
      setSelectedSubject({
        id: sample.subject_id,
        subject_name: sample.subject_name ?? "",
      } as SubjectItem);
      return;
    }

    form.resetFields();
    setSelectedSubject(subject);
  }, [sample, subject, isEdit, form]);

  const handleSelectSubject = async () => {
    try {
      const picked = await invoke.subjectProjectPage.openDrawerAsync(
        {},
        { width: 760, title: "Select Subject" }
      );
      if (picked?.id) {
        setSelectedSubject(picked as SubjectItem);
      }
    } catch {
      // user cancelled
    }
  };

  const handleCreateSubject = async () => {
    try {
      const created = await invoke.editSubjectPage.openDrawerAsync(
        {},
        { width: 480, title: "New Subject" }
      );
      if (created?.id) {
        setSelectedSubject(created as SubjectItem);
      }
    } catch {
      // user cancelled
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubject?.id) {
      message.error("Please select a subject");
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        sample_key: String(values.sample_key ?? "").trim(),
        sample_name: trimOrUndefined(values.sample_name),
        subject_id: String(selectedSubject.id),
        tissue: trimOrUndefined(values.tissue),
        cell_type: trimOrUndefined(values.cell_type),
        collection_time: localInputToIso(values.collection_time),
        metadata: trimOrUndefined(values.metadata),
        description: trimOrUndefined(values.description),
      };

      const result = isEdit
        ? await updateSampleApi({ id: sample!.id, ...payload })
        : await createSampleApi(payload);

      message.success(isEdit ? "Sample updated successfully" : "Sample created successfully");
      onOk?.(result.data);
    } catch (error: any) {
      if (error?.errorFields) return; // validation error, keep the drawer open
      message.error(isEdit ? "Failed to update sample" : "Failed to create sample");
    } finally {
      setLoading(false);
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
      <Form.Item
        label="Subject"
        required
        tooltip="Every sample belongs to a subject; pick an existing one or create a new one"
      >
        <Space.Compact style={{ width: "100%" }}>
          <Tooltip title={subjectLabel(selectedSubject)}>
            <Input
              readOnly
              value={subjectLabel(selectedSubject)}
              placeholder="Click to select a subject"
              onClick={handleSelectSubject}
              style={{ cursor: "pointer", flex: 1 }}
            />
          </Tooltip>
          <Button onClick={handleSelectSubject}>
            {selectedSubject ? "Change" : "Select"}
          </Button>
          <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleCreateSubject}>
            New
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item
        name="sample_key"
        label="Sample Key"
        tooltip="Business number, unique across all samples"
        rules={[{ required: true, message: "Please input the sample key" }]}
      >
        <Input placeholder="e.g. S-001" />
      </Form.Item>

      <Form.Item name="sample_name" label="Sample Name">
        <Input placeholder="Display name" />
      </Form.Item>

      <Flex gap="small">
        <Form.Item name="tissue" label="Tissue" style={{ flex: 1 }}>
          <Input placeholder="e.g. liver" />
        </Form.Item>
        <Form.Item name="cell_type" label="Cell Type" style={{ flex: 1 }}>
          <Input placeholder="e.g. hepatocyte" />
        </Form.Item>
      </Flex>

      <Form.Item name="collection_time" label="Collection Time">
        <Input type="datetime-local" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea rows={2} placeholder="Description" />
      </Form.Item>

      <Form.Item name="metadata" label="Metadata">
        <Input.TextArea rows={3} placeholder="Free-form metadata" />
      </Form.Item>

      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </Form>
  );
};

export default EditSamplePage;

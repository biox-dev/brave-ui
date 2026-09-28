import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Space, Tooltip } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  createDatasetSampleApi,
  createSampleApi,
  getDatasetSampleBySampleApi,
  updateDatasetSampleApi,
  updateSampleApi,
} from "@/api/data";
import type { DatasetItem, DatasetSampleItem, SampleItem, SubjectItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/**
 * Sample as edited here. `subject_name` and the dataset fields only exist on the
 * project read models (SampleWithSubjectInfo / SampleWithDatasetInfo).
 */
export type SampleFormSource = SampleItem & {
  subject_name?: string;
  dataset_id?: string;
  dataset_name?: string;
};

export interface EditSamplePageProps {
  /** When provided the form updates the sample, otherwise it creates a new one. */
  sample?: SampleFormSource;
  /** Optional pre-selected owning subject (used when creating from the assay form). */
  subject?: SubjectItem;
  /**
   * Optional pre-selected dataset. A sample joins a project through
   * DatasetSample (go_dataset_sample) — the only entity that carries
   * `dataset_id` now that DatasetAssay is gone — so this form writes that
   * binding alongside the sample itself.
   */
  dataset?: Pick<DatasetItem, "id" | "dataset_name">;
  onOk?: (result: SampleItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

/** Picker label: prefer the machine-readable business key (go_subject.subject_key). */
const subjectLabel = (subject?: SubjectItem) =>
  subject ? subject.subject_key || subject.subject_name || subject.id : "";

const datasetLabel = (dataset?: Pick<DatasetItem, "id" | "dataset_name">) =>
  dataset ? dataset.dataset_name || dataset.id : "";

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
 *
 * A Sample joins a project through its dataset binding (go_dataset_sample), so
 * the dataset is picked here too and written as a DatasetSample record — that is
 * the only place `dataset_id` lives in the Sample -> Assay -> File branch.
 */
const EditSamplePage = ({ sample, subject, dataset, onOk, onCancel, close }: EditSamplePageProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | undefined>();
  const [selectedDataset, setSelectedDataset] = useState<
    Pick<DatasetItem, "id" | "dataset_name"> | undefined
  >();
  // Binding of the edited sample (go_dataset_sample); undefined until loaded.
  const [binding, setBinding] = useState<DatasetSampleItem>();
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
      setSelectedDataset(
        sample.dataset_id
          ? { id: sample.dataset_id, dataset_name: sample.dataset_name ?? "" }
          : undefined
      );

      // The sample read model only carries the dataset ids, so load the binding
      // itself to know whether to update it (or create it when it is missing).
      let cancelled = false;
      const loadBinding = async () => {
        const response = await getDatasetSampleBySampleApi(sample.id).catch(() => undefined);
        if (!cancelled && response?.data) {
          setBinding(response.data);
        }
      };

      void loadBinding();
      return () => {
        cancelled = true;
      };
    }

    form.resetFields();
    setSelectedSubject(subject);
    setSelectedDataset(dataset ? { id: dataset.id, dataset_name: dataset.dataset_name } : undefined);
    setBinding(undefined);
  }, [sample, subject, dataset, isEdit, form]);

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

  const handleSelectDataset = async () => {
    try {
      const picked = await invoke.datasetProjectPage.openDrawerAsync(
        {},
        { width: 760, title: "Select Dataset" }
      );
      if (picked?.id) {
        setSelectedDataset(picked as DatasetItem);
      }
    } catch {
      // user cancelled
    }
  };

  const handleCreateDataset = async () => {
    try {
      const created = await invoke.editDatasetPage.openDrawerAsync(
        {},
        { width: 480, title: "New Dataset" }
      );
      if (created?.id) {
        setSelectedDataset(created as DatasetItem);
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
    if (!isEdit && !selectedDataset?.id) {
      message.error("Please select a dataset");
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

      // A sample joins a project through go_dataset_sample, so the binding is
      // written here too — otherwise the sample never shows up in the project.
      if (selectedDataset?.id) {
        const sampleId = String(result.data.id);
        if (binding?.id) {
          if (binding.dataset_id !== selectedDataset.id) {
            await updateDatasetSampleApi({
              id: binding.id,
              dataset_id: selectedDataset.id,
              sample_id: sampleId,
            });
          }
        } else if (sample?.dataset_id !== selectedDataset.id) {
          await createDatasetSampleApi({
            dataset_id: selectedDataset.id,
            sample_id: sampleId,
          });
        }
      }

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
        label="Dataset"
        required={!isEdit}
        tooltip="A sample joins a project through its dataset (DatasetSample). Picking one here writes that binding; without it the sample does not show up in the project."
      >
        <Space.Compact style={{ width: "100%" }}>
          <Tooltip title={datasetLabel(selectedDataset)}>
            <Input
              readOnly
              value={datasetLabel(selectedDataset)}
              placeholder="Click to select a dataset"
              onClick={handleSelectDataset}
              style={{ cursor: "pointer", flex: 1 }}
            />
          </Tooltip>
          <Button onClick={handleSelectDataset}>
            {selectedDataset ? "Change" : "Select"}
          </Button>
          <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleCreateDataset}>
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

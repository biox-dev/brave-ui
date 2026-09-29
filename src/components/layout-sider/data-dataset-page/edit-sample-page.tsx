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
import type { DatasetItem, SampleItem } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/**
 * Sample as edited here. `dataset_id` / `dataset_name` only exist on the project
 * read model (SampleWithDatasetInfo); the owning dataset itself is stored in the
 * DatasetSample join row.
 */
export type SampleFormSource = SampleItem & {
  dataset_id?: string;
  dataset_name?: string;
};

export interface EditSamplePageProps {
  /** When provided the form updates the sample, otherwise it creates a new one. */
  sample?: SampleFormSource;
  /** Optional pre-selected owning dataset (used when creating from the assay form). */
  dataset?: DatasetItem;
  onOk?: (result: SampleItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

/** Picker label: the dataset's display name (go_dataset.dataset_name). */
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
 * A Sample joins a project through DatasetSample (dataset -> sample): the form
 * picks the owning dataset and, on submit, creates/updates the sample and then
 * creates/updates the DatasetSample binding that anchors it to that dataset.
 */
const EditSamplePage = ({ sample, dataset, onOk, onCancel, close }: EditSamplePageProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | undefined>();
  const [bindingId, setBindingId] = useState<string | undefined>();
  const message = useGlobalMessage();

  const isEdit = Boolean(sample?.id);

  useEffect(() => {
    if (isEdit && sample) {
      form.setFieldsValue({
        sample_name: sample.sample_name ?? "",
        tissue: sample.tissue ?? "",
        cell_type: sample.cell_type ?? "",
        collection_time: isoToLocalInput(sample.collection_time),
        metadata: sample.metadata ?? "",
        description: sample.description ?? "",
      });
      // Editing: the read model carries the dataset label; reuse it, then load
      // the binding (its id is needed to update rather than re-create it).
      setSelectedDataset(
        sample.dataset_id
          ? ({ id: sample.dataset_id, dataset_name: sample.dataset_name ?? "" } as DatasetItem)
          : undefined
      );
      setBindingId(undefined);
      void (async () => {
        try {
          const response = await getDatasetSampleBySampleApi(sample.id);
          if (response.data) {
            setBindingId(response.data.id);
            setSelectedDataset({
              id: response.data.dataset_id,
              dataset_name: sample.dataset_name ?? "",
            } as DatasetItem);
          }
        } catch {
          // already reported by the global interceptor
        }
      })();
      return;
    }

    form.resetFields();
    setSelectedDataset(dataset);
    setBindingId(undefined);
  }, [sample, dataset, isEdit, form]);

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
    if (!selectedDataset?.id) {
      message.error("Please select a dataset");
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        sample_name: String(values.sample_name ?? "").trim(),
        tissue: trimOrUndefined(values.tissue),
        cell_type: trimOrUndefined(values.cell_type),
        collection_time: localInputToIso(values.collection_time),
        metadata: trimOrUndefined(values.metadata),
        description: trimOrUndefined(values.description),
      };

      const result = isEdit
        ? await updateSampleApi({ id: sample!.id, ...payload })
        : await createSampleApi(payload);
      const saved = result.data as SampleItem;

      // Keep the sample <-> dataset binding in sync.
      if (bindingId) {
        await updateDatasetSampleApi({
          id: bindingId,
          dataset_id: selectedDataset.id,
          sample_id: saved.id,
        });
      } else {
        const created = await createDatasetSampleApi({
          dataset_id: selectedDataset.id,
          sample_id: saved.id,
        });
        setBindingId(created.data.id);
      }

      message.success(isEdit ? "Sample updated successfully" : "Sample created successfully");
      onOk?.(saved);
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
        label="Dataset"
        required
        tooltip="Every sample belongs to a dataset; pick an existing one or create a new one. The sample is bound to it through DatasetSample."
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
        name="sample_name"
        label="Sample Name"
        tooltip="Business number / display name, required and unique within a dataset (the same name may repeat in another dataset)"
        rules={[{ required: true, message: "Please input the sample name" }]}
      >
        <Input placeholder="e.g. S-001" />
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

import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Space, Tooltip, AutoComplete } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  createAssayApi,
  createDatasetAssayApi,
  getDatasetAssayByAssayApi,
  getSampleApi,
  updateAssayApi,
  updateDatasetAssayApi,
} from "@/api/data";
import type {
  AssayDetailItem,
  AssayItem,
  DatasetAssayItem,
  DatasetItem,
  SampleItem,
} from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface EditAssayPageProps {
  /** Edit mode: the assay as returned by the assay page (carries its dataset). */
  assay?: AssayItem;
  /** Create mode: pre-selected dataset. */
  dataset?: DatasetItem;
  onOk?: (result: { assay: AssayDetailItem; dataset_id: string }) => void;
  onCancel?: () => void;
  close?: () => void;
}

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const datasetLabel = (dataset?: Pick<DatasetItem, "id" | "dataset_name">) =>
  dataset ? dataset.dataset_name || dataset.id : "";

const sampleLabel = (sample?: SampleItem) =>
  sample ? sample.sample_name || sample.sample_id || sample.id : "";

// Role of the assay inside its dataset binding (go_dataset_assay.role).
// Analysis form inputs with input_type=assay match it against their
// resolver.accept_formats — same convention as DatasetFile.role for files.
const ROLE_OPTIONS = ["DEFAULT", "TABLE", "ASSAY", "PHENOTYPE", "EXP"].map((value) => ({ value }));

/**
 * Assay create & edit form.
 *
 * Create mode writes the assay plus its DatasetAssay binding (the assay list is
 * read through `go_dataset_assay`, so the binding is mandatory) and nothing
 * else. Edit mode only touches the assay's own columns and its sample; the
 * dataset is fixed at creation time.
 *
 * Files are NOT part of this form: no file is created or bound here
 * (`go_file.assay_id` owns the assay -> file relation).
 *
 * "Select" opens the entity's page drawer (datasetProjectPage /
 * sampleProjectPage) and "New" opens its form drawer (editDatasetPage /
 * editSamplePage) — the Sample form in turn opens subjectProjectPage /
 * editSubjectPage for the subject.
 */
const EditAssayPage = ({ assay, dataset, onOk, onCancel, close }: EditAssayPageProps) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();

  const [saving, setSaving] = useState(false);

  const [selectedDataset, setSelectedDataset] = useState<Pick<DatasetItem, "id" | "dataset_name">>();
  const [selectedSample, setSelectedSample] = useState<SampleItem>();
  // DatasetAssay binding of the assay being edited (create mode leaves it
  // undefined; the binding is written right after the assay is created).
  const [binding, setBinding] = useState<DatasetAssayItem>();

  const isEdit = Boolean(assay?.id);

  // Seed the form: edit mode hydrates from the existing assay (and looks up its
  // sample for the label), create mode only takes the optional dataset.
  useEffect(() => {
    if (isEdit && assay) {
      form.setFieldsValue({
        assay_type: assay.assay_type ?? "",
        platform: assay.platform ?? "",
        library_id: assay.library_id ?? "",
        metadata: assay.metadata ?? "",
      });
      setSelectedDataset(
        assay.dataset_id ? { id: assay.dataset_id, dataset_name: assay.dataset_name } : undefined
      );

      // The assay only stores sample_id, so fetch the sample for its label.
      // The dataset binding is fetched separately because EditAssayPage only
      // touches the assay's own columns otherwise; the binding carries the role.
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
      const loadBinding = async () => {
        const response = await getDatasetAssayByAssayApi(assay.id).catch(() => undefined);
        if (!cancelled && response?.data) {
          setBinding(response.data);
          form.setFieldsValue({ role: response.data.role ?? "" });
        }
      };

      void loadSample();
      void loadBinding();
      return () => {
        cancelled = true;
      };
    }

    form.resetFields();
    setSelectedDataset(dataset ? { id: dataset.id, dataset_name: dataset.dataset_name } : undefined);
    setSelectedSample(undefined);
    setBinding(undefined);
  }, [assay, dataset, isEdit, form]);

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
        { subject: undefined },
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
    if (!selectedDataset?.id) {
      message.error("Please select a dataset");
      return;
    }
    if (!selectedSample?.id) {
      message.error("Please select or create a sample");
      return;
    }

    try {
      const values = await form.validateFields();
      setSaving(true);

      const role = trimOrUndefined(values.role);

      const assayPayload = {
        sample_id: String(selectedSample.id),
        assay_type: trimOrUndefined(values.assay_type),
        platform: trimOrUndefined(values.platform),
        library_id: trimOrUndefined(values.library_id),
        metadata: trimOrUndefined(values.metadata),
      };

      if (isEdit) {
        await updateAssayApi({ id: assay!.id, ...assayPayload });
        // The dataset binding carries the role an assay form input matches
        // against its accept_formats, so keep it in sync when it exists.
        if (binding?.id) {
          await updateDatasetAssayApi({
            id: binding.id,
            dataset_id: selectedDataset.id,
            assay_id: assay!.id,
            role: role ?? "",
          });
        }
        message.success("Assay updated successfully");
        onOk?.({ assay: assay as AssayDetailItem, dataset_id: selectedDataset.id });
        return;
      }

      const created = await createAssayApi(assayPayload);
      // The assay list is read through go_dataset_assay, so the binding has to
      // be written too — otherwise the new assay would never show up. `role` is
      // what analysis form inputs match against their accept_formats.
      await createDatasetAssayApi({
        dataset_id: selectedDataset.id,
        assay_id: String(created.data.id),
        role,
      });

      message.success("Assay created successfully");
      onOk?.({ assay: created.data, dataset_id: selectedDataset.id });
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
          label="Dataset"
          required
          tooltip="The assay is created inside this dataset (a DatasetAssay record is written too)"
        >
          {isEdit ? (
            // The dataset binding is written once, at creation time.
            <Input readOnly disabled value={datasetLabel(selectedDataset)} placeholder="-" />
          ) : (
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
          )}
        </Form.Item>

        <Form.Item
          label="Sample"
          required
          tooltip="The assay belongs to this sample; pick an existing one or create a new one"
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
          tooltip="Role of the assay inside its dataset. Analysis form inputs with input_type=assay match it against their accept formats (same convention as a file's role)."
        >
          <AutoComplete
            options={ROLE_OPTIONS}
            placeholder="e.g. DEFAULT, TABLE"
            filterOption={(input, option) =>
              String(option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
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

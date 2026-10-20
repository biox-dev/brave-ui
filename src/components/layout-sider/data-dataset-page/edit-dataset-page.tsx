import { useEffect, useState } from "react";
import { Button, Flex, Form, Input, Typography } from "antd";
import { listDatasetDirFilesApi } from "@/api/data";
import { createDatasetApi, updateDatasetApi } from "@/api/data";
import type { DatasetItem } from "@/api/data";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

export interface EditDatasetPageProps {
  /** When provided the form updates the dataset, otherwise it creates a new one. */
  dataset?: DatasetItem;
  /** Receives the created/updated dataset (not the raw HTTP response). */
  onOk?: (result: DatasetItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const EditDatasetPage = ({ dataset, onOk, onCancel, close }: EditDatasetPageProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [datasetDir, setDatasetDir] = useState("");
  const message = useGlobalMessage();

  const isEdit = Boolean(dataset?.id);

  useEffect(() => {
    form.setFieldsValue({
      dataset_name: dataset?.dataset_name ?? "",
      description: dataset?.description ?? "",
      metadata: dataset?.metadata ?? "",
    });
  }, [dataset, form]);

  // The dataset's workspace directory (utils.GetDatasetDir) only exists for a
  // persisted dataset, so it is resolved in edit mode. The files bound to the
  // dataset are listed on the dataset table (expand a row), not here.
  useEffect(() => {
    if (!isEdit || !dataset?.id) {
      setDatasetDir("");
      return;
    }

    let cancelled = false;

    listDatasetDirFilesApi({ dataset_id: dataset.id })
      .then((response) => {
        if (!cancelled) {
          setDatasetDir(response.data?.path ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDatasetDir("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, dataset?.id]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        dataset_name: String(values.dataset_name ?? "").trim(),
        description: trimOrUndefined(values.description),
        metadata: trimOrUndefined(values.metadata),
      };

      if (isEdit) {
        await updateDatasetApi({ id: dataset!.id, ...payload });
        message.success("Dataset updated successfully");
        // The update endpoint only returns a message, so echo the merged item back.
        onOk?.({
          ...dataset!,
          dataset_name: payload.dataset_name,
          description: payload.description ?? "",
          metadata: payload.metadata ?? "",
        });
      } else {
        const created = await createDatasetApi(payload);
        message.success("Dataset created successfully");
        onOk?.(created.data);
      }
    } catch (error: any) {
      if (error?.errorFields) return; // validation error
      message.error(isEdit ? "Failed to update dataset" : "Failed to create dataset");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (close) {
      close();
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="dataset_name"
        label="Dataset Name"
        rules={[{ required: true, message: "Please input dataset name" }]}
      >
        <Input placeholder="Enter dataset name" />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <Input.TextArea rows={3} placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="metadata" label="Metadata">
        <Input.TextArea rows={3} placeholder="Enter metadata" />
      </Form.Item>
      {isEdit && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Dataset Dir</div>
          <Typography.Text
            code
            copyable={Boolean(datasetDir)}
            style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
          >
            {datasetDir || "-"}
          </Typography.Text>
        </div>
      )}
      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </Flex>
    </Form>
  );
};

export default EditDatasetPage;

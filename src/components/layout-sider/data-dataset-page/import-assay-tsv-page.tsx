import { useEffect, useState } from "react";
import { Button, Flex, Input, Space, Tooltip, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, PlusOutlined } from "@ant-design/icons";
import { importAssayTSVApi } from "@/api/data";
import type { DatasetItem, ImportAssayTSVResult } from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface ImportAssayTsvPageProps {
  /** Optional pre-selected dataset (the import is scoped to it). */
  dataset_id?: string;
  dataset_name?: string;
  onOk?: (result: ImportAssayTSVResult) => void;
  onCancel?: () => void;
  close?: () => void;
}

const datasetLabel = (dataset?: Pick<DatasetItem, "id" | "dataset_name">) =>
  dataset ? dataset.dataset_name || dataset.id : "";

const SAMPLE_TSV = [
  "sample_name\tFASTQ_R1\tFASTQ_R2\tassay_type\tassay_role\tsubject_name",
  "脾脏-6\t/data/metagenomics/leipu_singlebac/V350200084_L03_167_1.fq.gz\t/data/metagenomics/leipu_singlebac/V350200084_L03_167_2.fq.gz\tWGS\tWGS\t脾脏-6",
].join("\n");

/**
 * Import a TSV table into a dataset.
 *
 * The header row names the columns; the backend upserts the whole
 * Subject -> Sample -> Assay -> File tree per row (subject_name,
 * sample_name, assay_type/assay_role/assay_name, and one File per remaining
 * column, whose file_key is the column name). Content can be uploaded as a file
 * or pasted into the text box; nothing is parsed on the client so new columns
 * need no frontend change.
 */
const ImportAssayTsvPage = ({
  dataset_id,
  dataset_name,
  onOk,
  onCancel,
  close,
}: ImportAssayTsvPageProps) => {
  const message = useGlobalMessage();
  const [selectedDataset, setSelectedDataset] = useState<
    Pick<DatasetItem, "id" | "dataset_name"> | undefined
  >();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedDataset(
      dataset_id ? { id: dataset_id, dataset_name: dataset_name ?? "" } : undefined
    );
  }, [dataset_id, dataset_name]);

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

  const handleFile: UploadProps["beforeUpload"] = (file) => {
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.onerror = () => message.error("Failed to read the selected file");
    reader.readAsText(file as unknown as Blob);
    // Never auto-upload: the text is sent to the import endpoint instead.
    return false;
  };

  const handleSubmit = async () => {
    if (!selectedDataset?.id) {
      message.error("Please select a dataset");
      return;
    }
    if (!content.trim()) {
      message.error("Please upload a TSV file or paste its content");
      return;
    }

    setLoading(true);
    try {
      const response = await importAssayTSVApi({
        dataset_id: selectedDataset.id,
        content,
      });
      const result = response.data;
      message.success(
        `Imported ${result.rows} row(s): ` +
          `subjects +${result.subjects_created}/~${result.subjects_updated}, ` +
          `samples +${result.samples_created}/~${result.samples_updated}, ` +
          `assays +${result.assays_created}/~${result.assays_updated}, ` +
          `files +${result.files_created}/~${result.files_updated}`
      );
      onOk?.(result);
    } catch {
      message.error("Failed to import TSV");
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
    <Flex vertical gap="small">
      <Flex vertical gap={4}>
        <Text strong>Dataset</Text>
        <Space.Compact style={{ width: "100%" }}>
          <Tooltip title={datasetLabel(selectedDataset)}>
            <Input
              readOnly
              value={datasetLabel(selectedDataset)}
              placeholder="Click to select a dataset"
              onClick={handleSelectDataset}
              style={{ cursor: "pointer", flex: 1 }}
              status={selectedDataset ? undefined : "warning"}
            />
          </Tooltip>
          <Button onClick={handleSelectDataset}>{selectedDataset ? "Change" : "Select"}</Button>
          <Button type="primary" ghost icon={<PlusOutlined />} onClick={handleCreateDataset}>
            New
          </Button>
        </Space.Compact>
      </Flex>

      <Flex vertical gap={4}>
        <Flex justify="space-between" align="center">
          <Text strong>TSV Content</Text>
          <Flex gap="small">
            <Button size="small" onClick={() => setContent(SAMPLE_TSV)}>
              Load Example
            </Button>
            <Button size="small" disabled={!content} onClick={() => setContent("")}>
              Clear
            </Button>
          </Flex>
        </Flex>
        <Upload.Dragger
          beforeUpload={handleFile}
          showUploadList={false}
          accept=".tsv,.txt,.csv,.tab"
          style={{ padding: "8px 0" }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
            <InboxOutlined />
          </p>
          <p className="ant-upload-text" style={{ margin: 0 }}>
            Click or drag a TSV file here
          </p>
          <p className="ant-upload-hint" style={{ margin: 0 }}>
            The first row must be the header; columns are separated by tabs.
          </p>
        </Upload.Dragger>
        <Input.TextArea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="…or paste the TSV content here"
          autoSize={{ minRows: 6, maxRows: 14 }}
          spellCheck={false}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          subject_name / sample_name are required. Unmapped columns become files whose key is the
          column name (e.g. FASTQ_R1); their cell value is the file path.
        </Text>
      </Flex>

      <Flex justify="end" gap="small">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          Import
        </Button>
      </Flex>
    </Flex>
  );
};

export default ImportAssayTsvPage;

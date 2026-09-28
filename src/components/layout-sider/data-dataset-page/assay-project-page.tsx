import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Pagination, Popconfirm, Table, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FileOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  deleteAssayApi,
  deleteSampleApi,
  deleteSubjectApi,
  listAssayByProjectApi,
  listFileByAssayApi,
  listSampleByProjectApi,
  listSubjectByProjectApi,
} from "@/api/data";
import type {
  AssayItem,
  DataFileItem,
  SampleWithDatasetItem,
  SubjectWithDatasetItem,
} from "@/api/data";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface SubjectSampleAssayProjectPageProps {
  /** Optional client-side subject filters; the list is already scoped to the active project. */
  id?: string;
  subject_key?: string;
  subject_name?: string;
  species?: string;
  strain?: string;
  sex?: string;
  page_size?: number | string;
  title?: string;
  onOk?: (subject: SubjectWithDatasetItem) => void;
  onCancel?: () => void;
  close?: () => void;
}

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizePageSize = (value?: number | string) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 10;
};

/** Group a flat list by a string key (e.g. samples by subject_id). */
const groupBy = <T,>(items: T[], keyOf: (item: T) => string) => {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = grouped.get(key);
    if (list) {
      list.push(item);
    } else {
      grouped.set(key, [item]);
    }
  }
  return grouped;
};

/** Subject label: display name -> business key -> primary key. */
const subjectLabel = (record: SubjectWithDatasetItem) =>
  record.subject_name || record.subject_key || `Subject-${record.id}`;

/** Sample label: display name -> business key -> primary key. */
const sampleLabel = (record: SampleWithDatasetItem) =>
  record.sample_name || record.sample_key || `Sample-${record.id}`;

/** Assay has no name column, so the label derives from library_id -> assay_type -> PK. */
const assayLabel = (record: AssayItem) => record.library_id || record.assay_type || record.id;

const assayMeta = (record: AssayItem) =>
  [record.assay_type, record.platform, record.library_id].filter(Boolean).join(" · ");

/** File label: file_name -> file_id -> primary key. */
const fileLabel = (record: DataFileItem) =>
  record.file_name || record.file_id || `File-${record.id}`;

const fileMeta = (record: DataFileItem) =>
  [record.format, record.file_key].filter(Boolean).join(" · ");

/**
 * Subject -> Sample -> Assay -> File data page.
 *
 * A dataset binds only to the top-level Subject (go_dataset_subject), so the
 * project's subjects are the entry point; their samples and assays are resolved
 * through that binding (go_project_dataset -> go_dataset_subject -> go_subject
 * -> go_sample -> go_assay). Expanding a subject reveals its samples, expanding
 * a sample reveals its assays, and expanding an assay lazily loads its files
 * (go_file.assay_id owns the assay -> file relation).
 *
 * CRUD is delegated to the existing drawers: `editSubjectPage` (which also
 * writes the DatasetSubject binding), `editSamplePage` (subject-scoped, no
 * dataset), `editAssayPage` (sample-scoped, no dataset), and
 * `editAssayFilePage` / `assayFileListPage` for the files of one assay.
 */
const SubjectSampleAssayProjectPage = ({
  id,
  subject_key,
  subject_name,
  species,
  strain,
  sex,
  page_size,
  title,
  onOk,
  onCancel,
  close,
}: SubjectSampleAssayProjectPageProps) => {
  const message = useGlobalMessage();

  const [subjects, setSubjects] = useState<SubjectWithDatasetItem[]>([]);
  const [samples, setSamples] = useState<SampleWithDatasetItem[]>([]);
  const [assays, setAssays] = useState<AssayItem[]>([]);
  const [filesByAssay, setFilesByAssay] = useState<Record<string, DataFileItem[]>>({});
  const [filesLoading, setFilesLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const [expandedSamples, setExpandedSamples] = useState<string[]>([]);
  const [expandedAssays, setExpandedAssays] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => normalizePageSize(page_size));

  const selectable = Boolean(onOk || onCancel);

  // All three lists are scoped to the current user's active project by the
  // backend, so one round trip is enough and the hierarchy is grouped here.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectResponse, sampleResponse, assayResponse] = await Promise.all([
        listSubjectByProjectApi(),
        listSampleByProjectApi(),
        listAssayByProjectApi(),
      ]);
      setSubjects((subjectResponse.data ?? []) as SubjectWithDatasetItem[]);
      setSamples((sampleResponse.data ?? []) as SampleWithDatasetItem[]);
      setAssays((assayResponse.data ?? []) as AssayItem[]);
      setFailed(false);
    } catch {
      // already reported by the global interceptor
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Files are owned by an assay and loaded lazily the first time it expands.
  const loadFiles = useCallback(async (assayId: string) => {
    setFilesLoading((map) => ({ ...map, [assayId]: true }));
    try {
      const response = await listFileByAssayApi(assayId);
      setFilesByAssay((map) => ({ ...map, [assayId]: (response.data ?? []) as DataFileItem[] }));
    } catch {
      // already reported by the global interceptor
    } finally {
      setFilesLoading((map) => ({ ...map, [assayId]: false }));
    }
  }, []);

  const samplesBySubject = useMemo(
    () => groupBy(samples, (sample) => String(sample.subject_id ?? "")),
    [samples]
  );

  const assaysBySample = useMemo(
    () => groupBy(assays, (assay) => String(assay.sample_id ?? "")),
    [assays]
  );

  const filteredSubjects = useMemo(() => {
    const idFilter = normalizeText(id);
    const keyFilter = normalizeText(subject_key)?.toLowerCase();
    const nameFilter = normalizeText(subject_name)?.toLowerCase();
    const speciesFilter = normalizeText(species)?.toLowerCase();
    const strainFilter = normalizeText(strain)?.toLowerCase();
    const sexFilter = normalizeText(sex)?.toLowerCase();

    return subjects.filter((subject) => {
      if (idFilter && String(subject.id) !== idFilter) return false;
      if (keyFilter && !(subject.subject_key ?? "").toLowerCase().includes(keyFilter)) return false;
      if (nameFilter && !(subject.subject_name ?? "").toLowerCase().includes(nameFilter)) {
        return false;
      }
      if (speciesFilter && !(subject.species ?? "").toLowerCase().includes(speciesFilter)) {
        return false;
      }
      if (strainFilter && !(subject.strain ?? "").toLowerCase().includes(strainFilter)) {
        return false;
      }
      if (sexFilter && !(subject.sex ?? "").toLowerCase().includes(sexFilter)) return false;
      return true;
    });
  }, [subjects, id, subject_key, subject_name, species, strain, sex]);

  const pagedSubjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSubjects.slice(start, start + pageSize);
  }, [filteredSubjects, page, pageSize]);

  const selectedItem = useMemo(
    () => subjects.find((item) => item.id === selectedId),
    [subjects, selectedId]
  );

  // ---- Subject CRUD -------------------------------------------------------

  const handleCreateSubject = async () => {
    try {
      // The form also writes the DatasetSubject binding, which is what makes
      // the subject (and its samples) belong to the active project.
      await invoke.editSubjectPage.openDrawerAsync({}, { width: 520, title: "New Subject" });
      await load();
    } catch {
      // user cancelled
    }
  };

  const handleEditSubject = async (record: SubjectWithDatasetItem) => {
    try {
      await invoke.editSubjectPage.openDrawerAsync(
        { subject: record },
        { width: 520, title: `Edit Subject: ${subjectLabel(record)}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  // The backend refuses (409) while the subject still owns samples.
  const handleDeleteSubject = async (record: SubjectWithDatasetItem) => {
    try {
      await deleteSubjectApi({ id: record.id });
      message.success("Subject deleted successfully");
      if (selectedId === record.id) {
        setSelectedId(undefined);
      }
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Sample CRUD --------------------------------------------------------

  const handleCreateSample = async (subject: SubjectWithDatasetItem) => {
    try {
      await invoke.editSamplePage.openDrawerAsync(
        { subject },
        { width: 560, title: `New Sample: ${subjectLabel(subject)}` }
      );
      await load();
      setExpandedSubjects((keys) => (keys.includes(subject.id) ? keys : [...keys, subject.id]));
    } catch {
      // user cancelled
    }
  };

  const handleEditSample = async (record: SampleWithDatasetItem) => {
    try {
      await invoke.editSamplePage.openDrawerAsync(
        { sample: record },
        { width: 560, title: `Edit Sample: ${sampleLabel(record)}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  // The backend refuses (409) while the sample still owns assays.
  const handleDeleteSample = async (record: SampleWithDatasetItem) => {
    try {
      await deleteSampleApi({ id: record.id });
      message.success("Sample deleted successfully");
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Assay CRUD ---------------------------------------------------------

  const handleCreateAssay = async (sample: SampleWithDatasetItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { sample },
        { width: 560, title: `New Assay: ${sampleLabel(sample)}` }
      );
      await load();
      setExpandedSamples((keys) => (keys.includes(sample.id) ? keys : [...keys, sample.id]));
    } catch {
      // user cancelled
    }
  };

  const handleEditAssay = async (assay: AssayItem) => {
    try {
      await invoke.editAssayPage.openDrawerAsync(
        { assay },
        { width: 560, title: `Edit Assay: ${assayLabel(assay)}` }
      );
      await load();
    } catch {
      // user cancelled
    }
  };

  // Deleting an assay also removes the files it owns.
  const handleDeleteAssay = async (assay: AssayItem) => {
    try {
      await deleteAssayApi({ id: assay.id });
      message.success("Assay deleted successfully");
      await load();
    } catch {
      // already reported by the global interceptor
    }
  };

  // ---- Assay files --------------------------------------------------------

  const handleOpenFiles = (assay: AssayItem) => {
    // Fire-and-forget: the file list drawer is a list, not a form, so it does
    // not resolve openDrawerAsync. Files are refreshed the next time the assay
    // expands.
    invoke.assayFileListPage.drawer(
      { assay_id: assay.id, assay_label: assayLabel(assay) },
      { width: 880, title: `Assay Files: ${assayLabel(assay)}` }
    );
  };

  const handleAddFile = async (assay: AssayItem) => {
    try {
      await invoke.editAssayFilePage.openDrawerAsync(
        { assay_id: assay.id, assay_label: assayLabel(assay) },
        { width: 520, title: `Add File: ${assayLabel(assay)}` }
      );
    } catch {
      // user cancelled
    }
    await loadFiles(assay.id);
  };

  // ---- Render -------------------------------------------------------------

  const renderFiles = (assay: AssayItem) => {
    const rows = filesByAssay[assay.id] ?? [];
    const isLoading = Boolean(filesLoading[assay.id]);

    return (
      <div style={{ padding: "2px 0 8px 44px" }}>
        <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isLoading ? "Loading files..." : rows.length === 0 ? "No files" : `${rows.length} file(s)`}
          </Text>
          <Flex gap="small">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<FileAddOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleAddFile(assay);
              }}
            >
              Add File
            </Button>
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void handleOpenFiles(assay);
              }}
            >
              Manage
            </Button>
          </Flex>
        </Flex>

        {rows.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This assay has no file yet.
          </Text>
        ) : (
          <Flex vertical gap={2}>
            {rows.map((file) => (
              <Flex key={file.id} align="center" gap={6}>
                <FileOutlined className="project-report-item-icon" />
                <Tooltip title={file.path || fileLabel(file)}>
                  <span className="project-report-item-title" style={{ flex: 1, minWidth: 0 }}>
                    {fileLabel(file)}
                  </span>
                </Tooltip>
                <Text type="secondary" ellipsis style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                  {fileMeta(file) || "-"}
                </Text>
              </Flex>
            ))}
          </Flex>
        )}
      </div>
    );
  };

  const assayColumns: ColumnsType<AssayItem> = [
    {
      key: "assay",
      render: (_value: unknown, record) => {
        const label = assayLabel(record);
        const meta = assayMeta(record);
        return (
          <div className="project-report-item">
            <ExperimentOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <Tooltip placement="topLeft" title={label}>
                <span className="project-report-item-title">{label}</span>
              </Tooltip>
              {meta && (
                <span className="project-report-item-meta" title={meta}>
                  {meta}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      align: "right",
      render: (_value: unknown, record) => (
        <span
          className="project-report-item-actions project-report-item-actions-static"
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip title="Add File">
            <Button
              type="text"
              size="small"
              icon={<FileAddOutlined />}
              onClick={() => void handleAddFile(record)}
            />
          </Tooltip>
          <Tooltip title="Manage Files">
            <Button
              type="text"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => void handleOpenFiles(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Assay">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => void handleEditAssay(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this assay?"
            description="Its files are deleted too."
            onConfirm={() => void handleDeleteAssay(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const renderAssays = (sample: SampleWithDatasetItem) => {
    const rows = assaysBySample.get(String(sample.id)) ?? [];

    return (
      <div style={{ padding: "2px 0 8px 26px" }}>
        <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {rows.length === 0 ? "No assays" : `${rows.length} assay(s)`}
          </Text>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              void handleCreateAssay(sample);
            }}
          >
            Add Assay
          </Button>
        </Flex>

        {rows.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This sample has no assay yet.
          </Text>
        ) : (
          <Table<AssayItem>
            rowKey="id"
            size="small"
            showHeader={false}
            columns={assayColumns}
            dataSource={rows}
            pagination={false}
            expandable={{
              expandedRowKeys: expandedAssays,
              onExpandedRowsChange: (keys) => {
                const next = keys.map(String);
                setExpandedAssays(next);
                // Refresh files for every expanded assay so the inline list
                // reflects changes made through the Manage drawer.
                for (const key of next) {
                  void loadFiles(key);
                }
              },
              expandedRowRender: renderFiles,
            }}
          />
        )}
      </div>
    );
  };

  const sampleColumns: ColumnsType<SampleWithDatasetItem> = [
    {
      key: "sample",
      render: (_value: unknown, record) => {
        const label = sampleLabel(record);
        const meta = [record.tissue, record.cell_type].filter(Boolean).join(" · ");
        return (
          <div className="project-report-item">
            <ExperimentOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <Tooltip placement="topLeft" title={label}>
                <span className="project-report-item-title">{label}</span>
              </Tooltip>
              {meta && (
                <span className="project-report-item-meta" title={meta}>
                  {meta}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      align: "right",
      render: (_value: unknown, record) => (
        <span
          className="project-report-item-actions project-report-item-actions-static"
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip title="Add Assay">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => void handleCreateAssay(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Sample">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => void handleEditSample(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this sample?"
            description="Samples that still own assays cannot be deleted."
            onConfirm={() => void handleDeleteSample(record)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const renderSamples = (subject: SubjectWithDatasetItem) => {
    const rows = samplesBySubject.get(String(subject.id)) ?? [];

    return (
      <div style={{ padding: "2px 0 8px 26px" }}>
        <Flex justify="space-between" align="center" gap="small" wrap style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {rows.length === 0 ? "No samples" : `${rows.length} sample(s)`}
          </Text>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              void handleCreateSample(subject);
            }}
          >
            Add Sample
          </Button>
        </Flex>

        {rows.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            This subject has no sample yet.
          </Text>
        ) : (
          <Table<SampleWithDatasetItem>
            rowKey="id"
            size="small"
            showHeader={false}
            columns={sampleColumns}
            dataSource={rows}
            pagination={false}
            expandable={{
              expandedRowKeys: expandedSamples,
              onExpandedRowsChange: (keys) => setExpandedSamples(keys.map(String)),
              expandedRowRender: renderAssays,
            }}
          />
        )}
      </div>
    );
  };

  const subjectActionsColumn: ColumnsType<SubjectWithDatasetItem>[number] = {
    title: "Actions",
    key: "actions",
    width: 130,
    align: "right",
    render: (_value: unknown, record) => (
      <span
        className="project-report-item-actions project-report-item-actions-static"
        onClick={(event) => event.stopPropagation()}
      >
        <Tooltip title="Add Sample">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => void handleCreateSample(record)}
          />
        </Tooltip>
        <Tooltip title="Edit Subject">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => void handleEditSubject(record)}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this subject?"
          description="Subjects that still own samples cannot be deleted."
          onConfirm={() => void handleDeleteSubject(record)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </span>
    ),
  };

  const columns: ColumnsType<SubjectWithDatasetItem> = [
    {
      title: "Subject",
      dataIndex: "subject_name",
      key: "subject_name",
      ellipsis: { showTitle: false },
      render: (_value: string, record) => {
        const label = subjectLabel(record);
        const meta = [record.subject_key, record.species, record.dataset_name]
          .filter(Boolean)
          .join(" · ");

        return (
          <div className="project-report-item">
            <UserOutlined className="project-report-item-icon" />
            <div className="project-report-item-text">
              <Tooltip placement="topLeft" title={label}>
                <span className="project-report-item-title">{label}</span>
              </Tooltip>
              {meta && (
                <span className="project-report-item-meta" title={meta}>
                  {meta}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    subjectActionsColumn,
  ];

  const handleConfirm = () => {
    if (!selectedItem || !onOk) {
      return;
    }
    onOk(selectedItem);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    close?.();
  };

  return (
    <div className="project-report-panel">
      <div className="project-report-panel-header">
        <span className="project-report-panel-title">{title || "Subjects"}</span>
        <div className="project-report-panel-actions">
          <Tooltip title="New Subject">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => void handleCreateSubject()}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void load()} />
          </Tooltip>
        </div>
      </div>

      <div className="project-report-panel-body">
        {pagedSubjects.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={failed ? "Failed to load subjects" : "No subjects"}
          />
        ) : (
          <Table<SubjectWithDatasetItem>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={pagedSubjects}
            loading={loading}
            pagination={false}
            showHeader={selectable}
            expandable={{
              expandedRowKeys: expandedSubjects,
              onExpandedRowsChange: (keys) => setExpandedSubjects(keys.map(String)),
              expandedRowRender: renderSamples,
            }}
            rowClassName={(record) =>
              record.id === selectedId ? "project-report-row-selected" : ""
            }
            rowSelection={
              selectable
                ? {
                    type: "radio",
                    selectedRowKeys: selectedId ? [selectedId] : [],
                    onChange: (selectedRowKeys) => {
                      setSelectedId(String(selectedRowKeys[0] || ""));
                    },
                  }
                : undefined
            }
            onRow={(record) => ({
              onClick: () => {
                if (selectable) {
                  setSelectedId(record.id);
                  return;
                }
                setExpandedSubjects((keys) =>
                  keys.includes(record.id)
                    ? keys.filter((key) => key !== record.id)
                    : [...keys, record.id]
                );
              },
            })}
          />
        )}
      </div>

      <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={filteredSubjects.length}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            onChange={(nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
              }
              setPage(nextPage);
            }}
            showTotal={(value) => `Total ${value}`}
          />
          {selectable && (
            <Flex gap="small">
              <Button size="small" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="small" type="primary" disabled={!selectedItem} onClick={handleConfirm}>
                Confirm
              </Button>
            </Flex>
          )}
        </Flex>
      </div>
    </div>
  );
};

export default SubjectSampleAssayProjectPage;

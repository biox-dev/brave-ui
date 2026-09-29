import { http } from "@/api/client/http";

export type ListFileByProjectGroupResponse = Record<string, any[]>;

export type PageRequest<TQuery extends object = Record<string, unknown>> = TQuery & {
	page?: number;
	page_size?: number;
};

export interface PageResponse<TItem> {
	data: TItem[];
	page: number;
	page_size: number;
	total: number;
}

export interface DatasetItem {
	id: string;
	dataset_name: string;
	description: string;
	metadata: string;
	created_at: string;
	updated_at: string;
}

export interface DatasetFileItem {
	id: string;
	file_id: string;
	file_name: string;
	path: string;
	format: string;
	size: number;
	analysis_node_id: string;
	md5: string;
	storage: string;
	description: string;
	created_at: string;
	updated_at: string;
	dataset_id: string;
	dataset_name: string;
	role: string;
}

export interface AssayDetailItem {
	id: string;
	sample_id: string;
	assay_type: string;
	platform: string;
	library_id: string;
	// assay_name is the assay's display name (go_assay.assay_name); empty means the
	// UI falls back to library_id -> assay_type -> id.
	assay_name: string;
	// role is matched against an analysis form input's resolver.accept_formats
	// (the same convention as a dataset file's role); empty means "no role".
	role: string;
	metadata: string;
	description: string;
	created_at: string;
	updated_at: string;
}

// AssayItem is the read model of the assay APIs: the plain assay entity plus the
// owning sample/subject labels joined in by the backend. An assay carries no
// dataset binding of its own — it is reached through its sample, which belongs
// to a subject, and only DatasetSubject (subject -> dataset) holds `dataset_id`.
export interface AssayItem extends AssayDetailItem {
	sample_name: string;
	// subject_name is the owning Subject's human-readable display name
	// (go_subject.subject_name).
	subject_name: string;
}

// SubjectItem is a donor / individual (go_subject). subject_name is both the
// business identifier (e.g. "mouse-001") and the human-readable display name; it
// is only unique within a dataset. id is the int64 primary key.
export interface SubjectItem {
	id: string;
	subject_name: string;
	species: string;
	strain: string;
	sex: string;
	age: string;
	metadata: string;
	description: string;
	created_at: string;
	updated_at: string;
}

// SampleItem is one biological sample taken from a Subject (go_sample).
// sample_name is the business number; subject_id is the owning subject's PK.
export interface SampleItem {
	id: string;
	sample_name: string;
	subject_id: string;
	tissue: string;
	cell_type: string;
	collection_time?: string | null;
	metadata: string;
	description: string;
	created_at: string;
	updated_at: string;
}

// SampleWithSubjectItem is what /data/sample/page returns: a Sample joined with
// its Subject's business name/species so the picker can show them directly.
// `subject_id` (inherited) stays the owning subject's PK.
export interface SampleWithSubjectItem extends SampleItem {
	subject_name: string;
	species: string;
}

// SubjectWithDatasetItem is what the active-project subject list returns: a
// Subject joined with the dataset it is bound to through go_dataset_subject.
// This is the entry point of the Subject -> Sample -> Assay -> File tree.
export interface SubjectWithDatasetItem extends SubjectItem {
	dataset_id: string;
	dataset_name: string;
}

// DatasetSubjectItem binds a Subject into a Dataset (go_dataset_subject). It is
// the only project binding on the Subject -> Sample -> Assay -> File branch: a
// dataset binds to the top-level Subject, and its samples/assays are resolved
// through that subject, so this is the only place `dataset_id` lives.
export interface DatasetSubjectItem {
	id: string;
	dataset_id: string;
	subject_id: string;
	created_at: string;
}

// SampleWithDatasetItem is what the active-project sample list returns: a Sample
// joined with its Subject and the dataset that subject is bound to through
// go_dataset_subject (the same columns as /data/sample/list-by-project).
export interface SampleWithDatasetItem extends SampleItem {
	subject_name: string;
	species: string;
	dataset_id: string;
	dataset_name: string;
}

export interface DatasetPageQuery {
	project_id?: string;
	id?: string;
	dataset_name?: string;
	description?: string;
	metadata?: string;
}

export interface DatasetFilePageQuery {
	// project_id: string;
	id?: string;
	file_id?: string;
	file_name?: string;
	path?: string;
	format?: string;
	size?: number;
	md5?: string;
	storage?: string;
	description?: string;
	dataset_id?: string;
	dataset_name?: string;
	role?: string[];
}

export interface AssayPageQuery {
	// project_id: string;
	id?: string;
	sample_id?: string;
	assay_type?: string;
	platform?: string;
	library_id?: string;
	metadata?: string;
}

export interface SubjectPageQuery {
	subject_name?: string;
	species?: string;
	strain?: string;
	sex?: string;
}

export interface SamplePageQuery {
	sample_name?: string;
	subject_id?: string;
	tissue?: string;
	cell_type?: string;
}

// SaveSubjectRequest payload for /data/subject/create and /data/subject/update.
// subject_name is the business identifier (e.g. "mouse-001") and is required; it
// is only unique within a dataset. The PK is generated by the backend. Fields
// left undefined are omitted from the request body.
export interface SaveSubjectRequest {
	subject_name: string;
	species?: string;
	strain?: string;
	sex?: string;
	age?: string;
	metadata?: string;
	description?: string;
}

// SaveSampleRequest payload for /data/sample/create and /data/sample/update.
// sample_name is the business number, unique within a dataset (not globally);
// subject_id is the owning subject's
// PK (sent as a string, backend int64).
export interface SaveSampleRequest {
	sample_name: string;
	subject_id: string;
	tissue?: string;
	cell_type?: string;
	collection_time?: string | null;
	metadata?: string;
	description?: string;
}

// SaveAssayRequest payload for /data/assay/create and /data/assay/update.
export interface SaveAssayRequest {
	sample_id: string;
	assay_type?: string;
	platform?: string;
	library_id?: string;
	// assay_name is the assay's display name; empty means the UI falls back to
	// library_id -> assay_type -> id.
	assay_name?: string;
	// role is matched against an analysis form input's resolver.accept_formats.
	role?: string;
	metadata?: string;
	description?: string;
}

// CreateFileRequest payload for /data/file/create. assay_id binds the file to its
// owning assay (a file belongs to at most one assay); omit it for files that are
// only attached to a dataset. file_key is the key an analysis form input maps
// onto its resolver.accept_formats.
export interface CreateFileRequest {
	file_id?: string;
	file_name?: string;
	path: string;
	format?: string;
	assay_id?: string;
	file_key?: string;
	analysis_node_id?: string;
	description?: string;
}

export interface AddFileToDatasetRequest {
	dataset_id: string;
	path: string;
	role?: string;
	file_name?: string;
	is_copy?: boolean;
	is_prefix?: boolean;
	analysis_node_id?: string;
	// "data" resolves the path under base_dir/data/<project_id>, "analysis" expects an absolute path
	source?: string;
}

export interface AddFileToDatasetResponse {
	file: Record<string, unknown>;
	dataset_file: Record<string, unknown>;
}

export interface UpdateFileRequest {
	id: string;
	// path re-points the record at another physical file. Omit it to keep the
	// stored path (the backend only writes non-empty values).
	path?: string;
	file_name?: string;
	description?: string;
	format?: string;
	storage?: string;
	assay_id?: string;
	file_key?: string;
}

export interface DeleteFileRequest {
	id: string;
}

export const listFileByProjectGroupApi = (projectId: string) => {
	return http.get<ListFileByProjectGroupResponse>(
		`/data/file/list-by-project-group?project_id=${encodeURIComponent(projectId)}`
	);
};

export interface CreateDatasetRequest {
	dataset_name: string;
	description?: string;
	metadata?: string;
}

export interface UpdateDatasetRequest extends CreateDatasetRequest {
	id: string;
}

export interface DeleteDatasetRequest {
	id: string;
}

export const pageDatasetByProjectApi = (payload: PageRequest<DatasetPageQuery>) => {
	return http.post<PageResponse<DatasetItem>>("/data/dataset/list-by-project-page", payload);
};

export const createDatasetApi = (payload: CreateDatasetRequest) => {
	return http.post<DatasetItem>("/data/dataset/create", payload);
};

export const updateDatasetApi = (payload: UpdateDatasetRequest) => {
	return http.post<{ message: string }>("/data/dataset/update", payload);
};

export const deleteDatasetApi = (payload: DeleteDatasetRequest) => {
	return http.post<{ message: string }>("/data/dataset/delete", payload);
};

export interface EnsureDatasetDirResponse {
	path: string;
}

export const ensureDatasetDirApi = (payload: { id: string }) => {
	return http.post<EnsureDatasetDirResponse>("/data/dataset/ensure-dir", payload);
};

// ImportAssayTSVRequest payload for /data/import/assay-tsv. `content` is the raw
// TSV text (an uploaded file or pasted content). The header names the columns:
// subject_name maps to Subject, sample_name to Sample,
// assay_type/assay_role/assay_name to Assay, and every other column becomes a File
// whose file_key is the column name (e.g. FASTQ_R1) and whose path is the cell value.
// Each level is upserted by its natural key, so re-importing the same table
// updates instead of duplicating.
export interface ImportAssayTSVRequest {
	dataset_id: string;
	content: string;
}

export interface ImportAssayTSVResult {
	rows: number;
	subjects_created: number;
	subjects_updated: number;
	samples_created: number;
	samples_updated: number;
	assays_created: number;
	assays_updated: number;
	files_created: number;
	files_updated: number;
}

export const importAssayTSVApi = (payload: ImportAssayTSVRequest) => {
	return http.post<ImportAssayTSVResult>("/data/import/assay-tsv", payload);
};

export const pageFileByProjectApi = (payload: PageRequest<DatasetFilePageQuery>) => {
	return http.post<PageResponse<DatasetFileItem>>("/data/file/list-by-project-page", payload);
};

export const pageAssayByProjectApi = (payload: PageRequest<AssayPageQuery>) => {
	return http.post<PageResponse<AssayItem>>("/data/assay/list-by-project-page", payload);
};

// The active project is resolved from the current user on the backend, so no
// project_id has to be sent. `listAssayByProjectApi` returns every assay of the
// project (unpaged) with its owning sample_id, which the subject page groups per
// sample; `listSampleByProjectApi` returns the project's samples (with their
// subject and the subject's dataset); `listSubjectByProjectApi` returns the
// project's subjects together with the dataset they are bound to
// (go_dataset_subject).
export const listAssayByProjectApi = () => {
	return http.get<AssayItem[]>("/data/assay/list-by-project");
};

export const listSampleByProjectApi = () => {
	return http.get<SampleWithDatasetItem[]>("/data/sample/list-by-project");
};

export const listSubjectByProjectApi = () => {
	return http.get<SubjectWithDatasetItem[]>("/data/subject/list-by-project");
};

// ---------------------------------------------------------------------------
// Assay create / update / read
// ---------------------------------------------------------------------------

export const getAssayApi = (id: string) => {
	return http.get<AssayDetailItem>(`/data/assay/get?id=${encodeURIComponent(id)}`);
};

export const createAssayApi = (payload: SaveAssayRequest) => {
	return http.post<AssayDetailItem>("/data/assay/create", payload);
};

export const updateAssayApi = (payload: SaveAssayRequest & { id: string }) => {
	return http.post<{ message: string }>("/data/assay/update", payload);
};

// Deleting an assay also removes the files it owns.
export const deleteAssayApi = (payload: { id: string }) => {
	return http.post<{ message: string }>("/data/assay/delete", payload);
};

// ---------------------------------------------------------------------------
// Assay files (go_file.assay_id: a file is owned by at most one assay)
// ---------------------------------------------------------------------------

export const listFileByAssayApi = (assayId: string) => {
	return http.get<DataFileItem[]>(
		`/data/file/list-by-assay?assay_id=${encodeURIComponent(assayId)}`
	);
};

export const createFileApi = (payload: CreateFileRequest) => {
	return http.post<DataFileItem>("/data/file/create", payload);
};

// ---------------------------------------------------------------------------
// DatasetSubject (Subject -> Dataset binding)
// ---------------------------------------------------------------------------

export const createDatasetSubjectApi = (payload: { dataset_id: string; subject_id: string }) => {
	return http.post<DatasetSubjectItem>("/data/dataset-subject/create", payload);
};

// Returns null when the subject is not bound to any dataset yet.
export const getDatasetSubjectBySubjectApi = (subjectId: string) => {
	return http.get<DatasetSubjectItem | null>(
		`/data/dataset-subject/get-by-subject?subject_id=${encodeURIComponent(subjectId)}`
	);
};

export const updateDatasetSubjectApi = (payload: {
	id: string;
	dataset_id: string;
	subject_id: string;
}) => {
	return http.post<{ message: string }>("/data/dataset-subject/update", payload);
};

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

export const pageSubjectApi = (payload: PageRequest<SubjectPageQuery>) => {
	return http.post<PageResponse<SubjectItem>>("/data/subject/page", payload);
};

export const listSubjectApi = () => {
	return http.get<SubjectItem[]>("/data/subject/list");
};

export const getSubjectApi = (id: string) => {
	return http.get<SubjectItem>(`/data/subject/get?id=${encodeURIComponent(id)}`);
};

export const createSubjectApi = (payload: SaveSubjectRequest) => {
	return http.post<SubjectItem>("/data/subject/create", payload);
};

export const updateSubjectApi = (payload: SaveSubjectRequest & { id: string }) => {
	return http.post<SubjectItem>("/data/subject/update", payload);
};

// The backend returns 409 while the subject still owns samples.
export const deleteSubjectApi = (payload: { id: string }) => {
	return http.post<{ message: string }>("/data/subject/delete", payload);
};

// ---------------------------------------------------------------------------
// Sample
// ---------------------------------------------------------------------------

export const pageSampleApi = (payload: PageRequest<SamplePageQuery>) => {
	return http.post<PageResponse<SampleWithSubjectItem>>("/data/sample/page", payload);
};

export const listSampleApi = () => {
	return http.get<SampleItem[]>("/data/sample/list");
};

export const getSampleApi = (id: string) => {
	return http.get<SampleItem>(`/data/sample/get?id=${encodeURIComponent(id)}`);
};

export const createSampleApi = (payload: SaveSampleRequest) => {
	return http.post<SampleItem>("/data/sample/create", payload);
};

export const updateSampleApi = (payload: SaveSampleRequest & { id: string }) => {
	return http.post<SampleItem>("/data/sample/update", payload);
};

// The backend returns 409 while the sample still owns assays.
export const deleteSampleApi = (payload: { id: string }) => {
	return http.post<{ message: string }>("/data/sample/delete", payload);
};

export const addFileToDatasetApi = (payload: AddFileToDatasetRequest) => {
	return http.post<AddFileToDatasetResponse>("/data/dataset-file/add-file", payload);
};

export const updateFileApi = (payload: UpdateFileRequest) => {
	return http.post<{ message: string }>("/data/file/update", payload);
};

export const deleteFileApi = (payload: DeleteFileRequest) => {
	return http.post<{ message: string }>("/data/file/delete", payload);
};

export interface UpdateDatasetFileRequest {
	dataset_id: string;
	file_id: string;
	role: string;
}

export const updateDatasetFileApi = (payload: UpdateDatasetFileRequest) => {
	return http.post<{ message: string }>("/data/dataset-file/update", payload);
};

export interface DataFileItem {
	id: string;
	file_id: string;
	file_name: string;
	path: string;
	format: string;
	// assay_id is the owning assay's PK; empty when the file is not owned by any
	// assay (dataset-only attachment).
	assay_id: string;
	// file_key (go_file.file_key) is the key this file fills inside its assay;
	// analysis form inputs map it onto their resolver.accept_formats keys.
	file_key: string;
	size: number;
	md5: string;
	storage: string;
	description: string;
	created_at: string;
	updated_at: string;
}

export const getFileApi = (id: string) => {
	return http.get<DataFileItem>(`/data/file/get?id=${encodeURIComponent(id)}`);
};

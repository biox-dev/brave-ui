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
// owning sample label joined in by the backend. An assay carries no dataset
// binding of its own — it is reached through its sample, and only DatasetSample
// (dataset -> sample) holds `dataset_id`.
export interface AssayItem extends AssayDetailItem {
	sample_name: string;
}

// SampleItem is one biological sample (go_sample). sample_name is the business
// number; the owning dataset is modelled by the DatasetSample join row.
export interface SampleItem {
	id: string;
	sample_name: string;
	tissue: string;
	cell_type: string;
	collection_time?: string | null;
	metadata: string;
	description: string;
	created_at: string;
	updated_at: string;
}

// DatasetSampleItem binds a Sample into a Dataset (go_dataset_sample). It is the
// only project binding on the Sample -> Assay -> File branch: a dataset binds to
// the Sample, and its assays/files are resolved through that sample.
export interface DatasetSampleItem {
	id: string;
	dataset_id: string;
	sample_id: string;
	created_at: string;
}

// SampleWithDatasetItem is what the active-project sample list returns: a Sample
// joined with the dataset it is bound to through go_dataset_sample (the same
// columns as /data/sample/list-by-project).
export interface SampleWithDatasetItem extends SampleItem {
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

export interface SamplePageQuery {
	sample_name?: string;
	tissue?: string;
	cell_type?: string;
}

// SaveSampleRequest payload for /data/sample/create and /data/sample/update.
// sample_name is the business number, unique within a dataset (not globally).
// The dataset the sample belongs to is established separately through
// createDatasetSampleApi / updateDatasetSampleApi.
export interface SaveSampleRequest {
	sample_name: string;
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
// sample_name maps to Sample (and creates its DatasetSample binding),
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
// project (unpaged) with its owning sample_id, which the sample page groups per
// sample; `listSampleByProjectApi` returns the project's samples together with the
// dataset they are bound to (go_dataset_sample).
export const listAssayByProjectApi = () => {
	return http.get<AssayItem[]>("/data/assay/list-by-project");
};

export const listSampleByProjectApi = () => {
	return http.get<SampleWithDatasetItem[]>("/data/sample/list-by-project");
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
// DatasetSample (Dataset -> Sample binding)
// ---------------------------------------------------------------------------

export const createDatasetSampleApi = (payload: { dataset_id: string; sample_id: string }) => {
	return http.post<DatasetSampleItem>("/data/dataset-sample/create", payload);
};

// Returns null when the sample is not bound to any dataset yet.
export const getDatasetSampleBySampleApi = (sampleId: string) => {
	return http.get<DatasetSampleItem | null>(
		`/data/dataset-sample/get-by-sample?sample_id=${encodeURIComponent(sampleId)}`
	);
};

export const updateDatasetSampleApi = (payload: {
	id: string;
	dataset_id: string;
	sample_id: string;
}) => {
	return http.post<{ message: string }>("/data/dataset-sample/update", payload);
};

// ---------------------------------------------------------------------------
// Sample
// ---------------------------------------------------------------------------

export const pageSampleApi = (payload: PageRequest<SamplePageQuery>) => {
	return http.post<PageResponse<SampleItem>>("/data/sample/page", payload);
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

// Deleting a sample also removes the assays/files it owns and its dataset binding.
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

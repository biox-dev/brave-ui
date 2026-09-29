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
	// sample_name is the biological sample's business identifier, carried directly on
	// the assay (go_assay.sample_name); it is only unique within a dataset.
	sample_name: string;
	assay_type: string;
	platform: string;
	library_id: string;
	// role is matched against an analysis form input's resolver.accept_formats
	// (the same convention as a dataset file's role); empty means "no role".
	role: string;
	metadata: string;
	description: string;
	created_at: string;
	updated_at: string;
}

// AssayItem is the read model of the assay APIs: the plain assay entity plus the
// dataset it is bound to through go_dataset_assay.
export interface AssayItem extends AssayDetailItem {
	dataset_id: string;
	dataset_name: string;
}

// DatasetAssayItem binds an Assay into a Dataset (go_dataset_assay). It is the
// project binding on the Dataset -> Assay -> File branch: a dataset binds to the
// Assay, and the assay's files follow it (go_file.assay_id).
export interface DatasetAssayItem {
	id: string;
	dataset_id: string;
	assay_id: string;
	created_at: string;
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
	sample_name?: string;
	assay_type?: string;
	platform?: string;
	library_id?: string;
	role?: string;
	metadata?: string;
}

// SaveAssayRequest payload for /data/assay/create and /data/assay/update.
// sample_name is the biological sample's business identifier, carried directly on
// the assay; it is required and only unique within a dataset. The dataset the
// assay belongs to is established separately through createDatasetAssayApi /
// updateDatasetAssayApi.
export interface SaveAssayRequest {
	sample_name: string;
	assay_type?: string;
	platform?: string;
	library_id?: string;
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
// sample_name + assay_role (+ assay_type) map to Assay (the assay is bound to the
// dataset through go_dataset_assay), and every other column becomes a File whose
// file_key is the column name (e.g. FASTQ_R1) and whose path is the cell value.
// Each level is upserted by its natural key, so re-importing the same table
// updates instead of duplicating.
export interface ImportAssayTSVRequest {
	dataset_id: string;
	content: string;
}

export interface ImportAssayTSVResult {
	rows: number;
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
// project (unpaged) together with the dataset it is bound to (go_dataset_assay).
export const listAssayByProjectApi = () => {
	return http.get<AssayItem[]>("/data/assay/list-by-project");
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
// DatasetAssay (Dataset -> Assay binding)
// ---------------------------------------------------------------------------

export const createDatasetAssayApi = (payload: { dataset_id: string; assay_id: string }) => {
	return http.post<DatasetAssayItem>("/data/dataset-assay/create", payload);
};

// Returns null when the assay is not bound to any dataset yet.
export const getDatasetAssayByAssayApi = (assayId: string) => {
	return http.get<DatasetAssayItem | null>(
		`/data/dataset-assay/get-by-assay?assay_id=${encodeURIComponent(assayId)}`
	);
};

export const updateDatasetAssayApi = (payload: {
	id: string;
	dataset_id: string;
	assay_id: string;
}) => {
	return http.post<{ message: string }>("/data/dataset-assay/update", payload);
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

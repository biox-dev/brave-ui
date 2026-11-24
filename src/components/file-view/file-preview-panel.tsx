import { FC, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Empty, Flex, Skeleton, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileTextOutlined, ReloadOutlined } from "@ant-design/icons";
import {
	previewFileByFileIDApi,
	type FilePreviewResponse,
	type PreviewFileInfo,
} from "@/api/sheet";
import { parseDelimitedText } from "./parse-delimited";
import "./styles.css";

/** 文本内容在前端渲染的上限，避免超大文件把页面卡死。 */
const TEXT_RENDER_LIMIT = 1_000_000;

const extractErrorMessage = (error: any): string => {
	const data = error?.response?.data;
	const candidates = [data?.error?.message, data?.message, data?.detail, error?.message];
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim()) {
			return candidate;
		}
	}
	return "Failed to load file preview";
};

type TableRow = { key: number; cells: string[] };

export interface FilePreviewPanelProps {
	/** go_file 主键 id。 */
	fileId?: string;
	/** 预览加载后回传文件元信息（供页面侧栏展示）。 */
	onFileLoaded?: (file: PreviewFileInfo | undefined) => void;
	/** 标题栏右侧额外操作。 */
	extra?: ReactNode;
	/**
	 * 是否渲染内置标题栏（默认 true）。
	 * 路由页把标题栏交给统一的 `PanelLayout`，保证与其它页面头部高度一致，
	 * 避免自绘工具栏比 `--sharp-head-height` 高出一截；此时传 false 只渲染内容区。
	 */
	showHeader?: boolean;
	/** 外部刷新信号：值变化时重新拉取预览（配合页面标题栏的刷新按钮）。 */
	reloadKey?: number;
	/** 预览加载状态变化回调（供外部刷新按钮显示 loading）。 */
	onLoadingChange?: (loading: boolean) => void;
	/** 预览数据变化回调（供外部标题栏展示格式 / 截断标记）。 */
	onPreviewLoaded?: (preview: FilePreviewResponse | null) => void;
}

/**
 * 文件预览面板：拉取后端预览内容并自行渲染。
 *
 * 后端不再返回表格模型：表格类文件返回分隔文本（xlsx 由后端转 TSV），
 * 这里解析后交给 antd Table 展示；文本类文件直接显示原始文本；二进制格式
 * 只展示「无法预览」提示。组件同时被路由页与会话页右侧标签复用。
 */
const FilePreviewPanel: FC<FilePreviewPanelProps> = ({
	fileId,
	onFileLoaded,
	extra,
	showHeader = true,
	reloadKey,
	onLoadingChange,
	onPreviewLoaded,
}) => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
	const [reloadToken, setReloadToken] = useState(0);

	// 用 ref 持有回调，避免调用方传入内联函数时触发重复请求。
	const onFileLoadedRef = useRef(onFileLoaded);
	useEffect(() => {
		onFileLoadedRef.current = onFileLoaded;
	}, [onFileLoaded]);

	const onLoadingChangeRef = useRef(onLoadingChange);
	useEffect(() => {
		onLoadingChangeRef.current = onLoadingChange;
	}, [onLoadingChange]);

	const onPreviewLoadedRef = useRef(onPreviewLoaded);
	useEffect(() => {
		onPreviewLoadedRef.current = onPreviewLoaded;
	}, [onPreviewLoaded]);

	// 把加载状态与预览结果同步给外部（标题栏放在页面侧时使用）。
	useEffect(() => {
		onLoadingChangeRef.current?.(loading);
	}, [loading]);

	useEffect(() => {
		onPreviewLoadedRef.current?.(preview);
	}, [preview]);

	const resolvedFileId = String(fileId ?? "").trim();

	useEffect(() => {
		if (!resolvedFileId) {
			setPreview(null);
			setError(null);
			onFileLoadedRef.current?.(undefined);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		previewFileByFileIDApi({ id: resolvedFileId })
			.then((response) => {
				if (cancelled) return;
				setPreview(response.data);
				onFileLoadedRef.current?.(response.data.file);
			})
			.catch((err) => {
				if (cancelled) return;
				setPreview(null);
				setError(extractErrorMessage(err));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [resolvedFileId, reloadToken, reloadKey]);

	const reload = useCallback(() => setReloadToken((token) => token + 1), []);

	const table = useMemo(() => {
		if (preview?.kind !== "table") {
			return null;
		}
		const rows = parseDelimitedText(preview.content ?? "", preview.delimiter ?? ",");
		if (rows.length === 0) {
			return { columns: [] as ColumnsType<TableRow>, data: [] as TableRow[] };
		}

		const header = rows[0];
		const body = rows.slice(1);
		const columnCount = Math.max(header.length, ...body.map((row) => row.length), 1);

		const columns: ColumnsType<TableRow> = Array.from({ length: columnCount }, (_, columnIndex) => ({
			key: `col-${columnIndex}`,
			title: header[columnIndex] || `Column ${columnIndex + 1}`,
			dataIndex: columnIndex,
			ellipsis: true,
			render: (_: unknown, record: TableRow) => record.cells[columnIndex] ?? "",
		}));

		const data: TableRow[] = body.map((cells, rowIndex) => ({ key: rowIndex, cells }));
		return { columns, data };
	}, [preview]);

	const textContent = preview?.kind === "text" ? preview.content ?? "" : "";
	const textTooLarge = textContent.length > TEXT_RENDER_LIMIT;
	const displayText = textTooLarge ? textContent.slice(0, TEXT_RENDER_LIMIT) : textContent;

	const fileName = preview?.file?.file_name || resolvedFileId || "File";

	const renderContent = () => {
		if (!resolvedFileId) {
			return (
				<div className="file-preview-empty">
					<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Missing file id" />
				</div>
			);
		}
		if (loading) {
			return <Skeleton active paragraph={{ rows: 8 }} />;
		}
		if (error) {
			return (
				<Alert
					type="error"
					showIcon
					message="Failed to load file preview"
					description={error}
					action={
						<Button size="small" onClick={reload}>
							Retry
						</Button>
					}
				/>
			);
		}
		if (!preview) {
			return null;
		}
		if (preview.kind === "binary") {
			return (
				<Alert
					type="info"
					showIcon
					message="无法在线预览"
					description={preview.message || "该文件为二进制格式，暂不支持在线预览"}
				/>
			);
		}
		if (preview.kind === "table") {
			if (!table || table.columns.length === 0) {
				return (
					<div className="file-preview-empty">
						<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Empty table" />
					</div>
				);
			}
			return (
				<Table<TableRow>
					className="file-preview-table"
					size="small"
					bordered
					sticky
					rowKey="key"
					columns={table.columns}
					dataSource={table.data}
					pagination={{ pageSize: 100, size: "small", showSizeChanger: false }}
					scroll={{ x: "max-content" }}
				/>
			);
		}
		return (
			<pre className="file-preview-text">
				{displayText}
				{textTooLarge ? "\n…" : ""}
			</pre>
		);
	};

	const truncated = preview?.truncated || textTooLarge;

	return (
		<div className={`file-preview-panel${showHeader ? "" : " is-headerless"}`}>
			{showHeader ? (
				<div className="file-preview-panel-toolbar">
					<Flex align="center" justify="space-between" gap={8}>
						<Space size={8} align="center" style={{ minWidth: 0 }}>
							<FileTextOutlined />
							<Typography.Text strong ellipsis style={{ maxWidth: 480 }}>
								{fileName}
							</Typography.Text>
							{preview?.format ? <Tag color="cyan">{preview.format}</Tag> : null}
							{truncated ? <Tag color="orange">truncated</Tag> : null}
						</Space>
						<Space size={8}>
							{extra}
							<Tooltip title="Reload">
								<Button
									size="small"
									icon={<ReloadOutlined />}
									loading={loading}
									onClick={reload}
								/>
							</Tooltip>
						</Space>
					</Flex>
				</div>
			) : null}
			<div className="file-preview-panel-body">
				{/* 提示文本放进滚动区，避免它把标题栏高度撑得不固定。 */}
				{preview?.message && preview.kind !== "binary" ? (
					<Alert className="file-preview-note" type="info" showIcon message={preview.message} />
				) : null}
				{renderContent()}
			</div>
		</div>
	);
};

export default FilePreviewPanel;

import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileTextOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAnalysisPageQuery } from "@/hooks/usePaginationV2";
import type { AnalysisItem } from "@/api/analysis";
import { useComponentStore } from "@/store-zustand/components";
import { useStoreRender } from "@/context/render/RenderProvider";
import AnalysisNodePanel from "../analysis-node-view/analysis-node-panel";
import { http } from "@/api/client/http";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

export interface AnalysisPageProps {
	analysis_name?: string;
	relation_id?: string;
	job_status?: string;
	server_status?: string;
	page_size?: number | string;
	title?: string;
	onOk?: (analysis: AnalysisItem) => void;
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

const statusColor = (status?: string) => {
	const v = String(status ?? "").toLowerCase();
	if (v === "done" || v === "finished" || v === "success") return "success";
	if (v === "running" || v === "submitted") return "processing";
	if (v === "failed" || v === "error") return "error";
	if (v === "stopped" || v === "skipped") return "default";
	return "default";
};

const cacheTypeLabel = (cacheType?: number) => {
	switch (cacheType) {
		case 1:
			return "rerun_all";
		case 2:
			return "reuse_existing_node";
		case 3:
			return "reuse_when_script_unchanged";
		case 4:
			return "reuse_when_script_and_params_unchanged";
		default:
			return "-";
	}
};

const AnalysisPage = ({
	analysis_name,
	relation_id,
	job_status,
	server_status,
	page_size,
	title,
	onOk,
	onCancel,
	close,
}: AnalysisPageProps) => {
	const [selectedId, setSelectedID] = useState<string>();
	const selectable = Boolean(onOk || onCancel);
	const { setAnalysisId, analysisId } = useStoreRender();
	const { register, unregister } = useComponentStore();

	// 当 analysisId 有值时，同步选中对应的行
	useEffect(() => {
		if (analysisId) {
			setSelectedID(analysisId);
		}
	}, [analysisId]);

	const columns: ColumnsType<AnalysisItem> = [
		{
			title: "Analysis Name",
			dataIndex: "analysis_name",
			key: "analysis_name",
			width: 150,

			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Analysis ID",
			dataIndex: "id",
			key: "id",
			width: 220,
			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Workflow ID",
			dataIndex: "relation_id",
			key: "relation_id",
			width: 220,
			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Job Status",
			dataIndex: "job_status",
			key: "job_status",
			width: 130,
			render: (value: string) => <Tag color={statusColor(value)}>{value || "-"}</Tag>,
		},
		{
			title: "Server Status",
			dataIndex: "server_status",
			key: "server_status",
			width: 130,
			render: (value: string) => <Tag color={statusColor(value)}>{value || "-"}</Tag>,
		},
		{
			title: "Report",
			dataIndex: "is_report",
			key: "is_report",
			width: 100,
			render: (value: boolean) => <Tag color={value ? "blue" : "default"}>{value ? "yes" : "no"}</Tag>,
		},
		{
			title: "Cache Type",
			dataIndex: "cache_type",
			key: "cache_type",
			width: 280,
			render: (value: number) => cacheTypeLabel(value),
		},
		{
			title: "Created At",
			dataIndex: "created_at",
			key: "created_at",
			width: 210,
			render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
		},
		{
			title: "Updated At",
			dataIndex: "updated_at",
			key: "updated_at",
			width: 210,
			render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
		},
		{
			title: "Action",
			key: "action",
			fixed: "right",
			width: 120,
			render: (_: unknown, record) => (
				<Button
					type="link"
					onClick={() => {
						setAnalysisId(record.id);
					}}
				>
					View
				</Button>
			),
		},
	];

	const {
		data,
		total,
		page,
		pageSize,
		setPage,
		setPageSize,
		setQuery,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useAnalysisPageQuery(
		{},
		{
			enabled: true,
			initialPageSize: normalizePageSize(page_size),
			keepPreviousData: true,
			staleTime: 30_000,
			cacheTime: 5 * 60_000,
		}
	);
	const message = useGlobalMessage()

	useEffect(() => {
		setQuery({
			analysis_name: normalizeText(analysis_name),
			relation_id: normalizeText(relation_id),
			job_status: normalizeText(job_status),
			server_status: normalizeText(server_status),
		});
	}, [analysis_name, relation_id, job_status, server_status, setQuery]);

	const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

	const selectColumns = useMemo<ColumnsType<AnalysisItem>>(() => {
		if (!selectable) {
			return columns;
		}

		return [
			...columns,
			{
				title: "Select",
				key: "select",
				width: 120,
				fixed: "right",
				render: (_: unknown, record) => (
					<Button
						type={record.id === selectedId ? "primary" : "default"}
						size="small"
						onClick={() => setSelectedID(record.id)}
					>
						{record.id === selectedId ? "Selected" : "Select"}
					</Button>
				),
			},
		];
	}, [selectable, selectedId, columns]);

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
		if (close) {
			close();
		}
	};

	const instance = useMemo(() => {
		return {
			analysisStarted: () => {
				refetch();
			},
			analysisDone: () => {
				refetch();
			},
		};
	}, [refetch]);

	useEffect(() => {
		register("analysis", "*", instance);
		return () => {
			unregister("analysis", "*", instance);
		};
	}, [register, unregister, instance]);

	const [publishing, setPublishing] = useState(false);

	const handlePublishToDoc = async () => {
		if (!relation_id) {
			message.warning("No script_id available");
			return;
		}
		setPublishing(true);
		try {
			// TODO
			await http.post(`/workflow/publish-to-doc/${relation_id}`);
			message.success("Published to doc successfully");
			refetch();
		} catch {
			message.error("Failed to publish to doc");
		} finally {
			setPublishing(false);
		}
	};
	return (
		<Card
			size="small"
			title={title || "Analysis List By Active Project"}
			extra={
				<Space>

					<Text type="secondary">Total: {total}</Text>
					<Button
						icon={<FileTextOutlined />}
						onClick={handlePublishToDoc}
						loading={publishing}
						disabled={!relation_id}
					>
						Publish to Doc
					</Button>
					<Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
						Refresh
					</Button>
				</Space>
			}
		>
			{error ? <Alert type="error" showIcon message="Failed to load analyses" style={{ marginBottom: 12 }} /> : null}

			<Table<AnalysisItem>
				rowKey="id"
				columns={selectColumns}
				dataSource={data}
				loading={isLoading || isFetching}
				size="small"
				scroll={{ x: 1800 }}
				locale={{ emptyText: error ? "Failed to load analyses" : "No analyses" }}
				rowClassName={(record) =>
					record.id === analysisId ? "analysis-node-row-selected" : ""
				}
				rowSelection={
					selectable
						? {
							type: "radio",
							selectedRowKeys: selectedId ? [selectedId] : [],
							onChange: (selectedRowKeys) => {
								setSelectedID(String(selectedRowKeys[0] || ""));
							},
						}
						: undefined
				}
				onRow={
					selectable
						? (record) => ({
							onClick: () => setSelectedID(record.id),
						})
						: undefined
				}
				pagination={{
					current: page,
					pageSize,
					total,
					showSizeChanger: true,
					pageSizeOptions: [20, 50, 100, 200, 500, 1000],
					onChange: (nextPage, nextPageSize) => {
						if (nextPageSize !== pageSize) {
							setPageSize(nextPageSize);
						}
						setPage(nextPage);
					},
					showTotal: (value) => `Total ${value} items`,
				}}
			/>

			{selectable && (
				<Flex justify="end" gap="small" style={{ marginTop: 12 }}>
					<Button onClick={handleCancel}>Cancel</Button>
					<Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
						Confirm
					</Button>
				</Flex>
			)}

			{analysisId && <>

				<AnalysisNodePanel></AnalysisNodePanel>
			</>}
		</Card>
	);
};

export default AnalysisPage;

import { useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Card, Flex, Popconfirm, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, ReloadOutlined, FileTextOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useAnalysisNodePageQuery } from "@/hooks/usePaginationV2";
import type { AnalysisNodeItem } from "@/api/analysis";
import { deleteAnalysisNodeApi } from "@/api/analysis";
import { useStoreRender } from "@/context/render/RenderProvider";
import AnalysisNodeDetails from "./analysis-nodes-report/analysis-node-details";
import { useComponentStore } from "@/event-bus/stores/components";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { http } from "@/api/client/http";

const { Text } = Typography;

export interface AnalysisNodePageProps {
	script_id?: string;
	page_size?: number | string;
	title?: string;
	onOk?: (node: AnalysisNodeItem) => void;
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
	if (v === "done" || v === "finished") return "success";
	if (v === "running" || v === "submitted") return "processing";
	if (v === "failed") return "error";
	if (v === "skipped" || v === "stopped") return "default";
	return "default";
};


const AnalysisNodePage = ({
	script_id,
	page_size,
	title,
	onOk,
	onCancel,
	close,
}: AnalysisNodePageProps) => {
	const [selectedId, setSelectedID] = useState<string>();
	const selectable = Boolean(onOk || onCancel);
	const { setAnalysisNodeId, analysisNodeId } = useStoreRender()
	const message = useGlobalMessage()

	// 当 analysisNodeId 有值时，同步选中对应的行
	useEffect(() => {
		if (analysisNodeId) {
			setSelectedID(analysisNodeId);
		}
	}, [analysisNodeId]);

	// const [nodeID,setNodeId] = useState<any>()
	const columns: ColumnsType<AnalysisNodeItem> = [
		{
			title: "Node Name",
			dataIndex: "node_name",
			key: "node_name",
			width: 150,

			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Analysis Node ID",
			dataIndex: "analysis_node_id",
			key: "analysis_node_id",
			width: 220,
			ellipsis: true,
			render: (value: string) => value || "-",
		},
		
		
		{
			title: "Status",
			dataIndex: "status",
			key: "status",
			width: 120,
			render: (value: string) => <Tag color={statusColor(value)}>{value || "-"}</Tag>,
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
		},{
			title: "Script ID",
			dataIndex: "script_id",
			key: "script_id",
			width: 180,
			ellipsis: true,
			render: (value: string) => value || "-",
		},{
			title: "Analysis ID",
			dataIndex: "analysis_id",
			key: "analysis_id",
			width: 200,
			ellipsis: true,
			render: (value: string) => value || "-",
		},{
			title: "Executor",
			dataIndex: "executor",
			key: "executor",
			width: 120,
			render: (value: string) => value || "-",
		}, {
			title: "action",
			key: "action",
			fixed: "right",
			width: 160,
			render: (_: unknown, record) => (
				<Space size="small">
					<Button type="link" size="small" onClick={() => {
						setAnalysisNodeId(record.id)
					}}>View</Button>
					<Popconfirm
						title="Delete analysis node"
						description="Are you sure you want to delete this analysis node?"
						onConfirm={() => handleDelete(record.id)}
						okText="Delete"
						cancelText="Cancel"
						okButtonProps={{ danger: true }}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			)
		}
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
	} = useAnalysisNodePageQuery(
		{},
		{
			enabled: true,
			initialPageSize: normalizePageSize(page_size),
			keepPreviousData: true,
			staleTime: 30_000,
			cacheTime: 5 * 60_000,
		}
	);

	const handleDelete = async (id: string) => {
		try {
			await deleteAnalysisNodeApi(id);
			message.success("Analysis node deleted successfully");
			refetch();
		} catch {
			message.error("Failed to delete analysis node");
		}
	};

	const [publishing, setPublishing] = useState(false);
	const [runningAll, setRunningAll] = useState(false);

	const activeNodeCount = useMemo(() => {
		return data.filter((n) => n.status === "running" || n.status === "submitted").length;
	}, [data]);

	const handleRunAllNodes = async () => {
		if (!script_id) {
			message.warning("No script_id available");
			return;
		}
		setRunningAll(true);
		try {
			await http.post(`/script/${script_id}/run-analysis-nodes`);
			message.success("Batch run started successfully");
			refetch();
		} catch {
			message.error("Failed to start batch run");
		} finally {
			setRunningAll(false);
		}
	};

	const handlePublishToDoc = async () => {
		if (!script_id) {
			message.warning("No script_id available");
			return;
		}
		setPublishing(true);
		try {
			await http.post(`/script/${script_id}/publish-to-doc`);
			message.success("Published to doc successfully");
			refetch();
		} catch {
			message.error("Failed to publish to doc");
		} finally {
			setPublishing(false);
		}
	};

	useEffect(() => {
		setQuery({
			script_id: normalizeText(script_id),
		});
	}, [script_id, setQuery]);

	const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

	const selectColumns = useMemo<ColumnsType<AnalysisNodeItem>>(() => {
		if (!selectable) {
			return columns;
		}

		return [
			...columns,
			{
				title: "Action",
				key: "action",
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
	}, [selectable, selectedId]);

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
	const { register, unregister } = useComponentStore();


	const instanceNode = useMemo(() => {
		return {
			analysisStarted: (args: any) => {
				refetch()
			},
			analysisDone: (args: any) => {
				refetch()
			}

		}
	}, [])
	useEffect(() => {
		register("analysis", "*", instanceNode);
		return () => {
			unregister("analysis", "*", instanceNode);
		}
	}, []);



	return (
		<Card
			size="small"
			title={title || "Analysis Node List By Active Project"}
			extra={
				<Space>
					<Text type="secondary">Total: {total}</Text>

					<Button
						icon={<PlayCircleOutlined />}
						onClick={handleRunAllNodes}
						loading={runningAll}
						disabled={!script_id || runningAll}
						title={activeNodeCount > 0 ? `${activeNodeCount} node(s) already running` : undefined}
					>
						Run All{activeNodeCount > 0 ? ` (${activeNodeCount} running)` : ""}
					</Button>
					<Button
						icon={<FileTextOutlined />}
						onClick={handlePublishToDoc}
						loading={publishing}
						disabled={!script_id}
					>
						Publish to Doc
					</Button>
					<Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
						Refresh
					</Button>
				</Space>
			}
		>

			{error ? (
				<Alert type="error" showIcon message="Failed to load analysis nodes" style={{ marginBottom: 12 }} />
			) : null}

			<Table<AnalysisNodeItem>
				rowKey="id"
				columns={selectColumns}
				dataSource={data}
				loading={isLoading || isFetching}
				size="small"
				scroll={{ x: 1500 }}
				locale={{ emptyText: error ? "Failed to load analysis nodes" : "No analysis nodes" }}
				rowClassName={(record) =>
					record.id === analysisNodeId ? "analysis-node-row-selected" : ""
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

			{analysisNodeId && <AnalysisNodeDetails analysis_node_id={analysisNodeId}></AnalysisNodeDetails>}

		</Card>
	);
};

export default AnalysisNodePage;


import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Flex, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useScriptPageQuery } from "@/hooks/usePaginationV2";
import type { ScriptItem } from "@/api/workflow";
import BorderlessCard from "@/components/common/borderless-card";

const { Text } = Typography;

export interface ScriptPageProps {
	script_type?: string;
	category?: string;
	page_size?: number | string;
	title?: string;
	onOk?: (script: ScriptItem) => void;
	onCancel?: () => void;
	close?: () => void;
	onAddScriptToNode?: (scriptId: string) => void;
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

const ScriptPage = ({
	script_type,
	category,
	page_size,
	title,
	onOk,
	onCancel,
	onAddScriptToNode,
	close,
}: ScriptPageProps) => {
	const [selectedId, setSelectedID] = useState<string>();
	const [keywords, setKeywords] = useState<string>("");
	const [scriptTypeValue, setScriptTypeValue] = useState<string | undefined>(normalizeText(script_type));
	const selectable = Boolean(onOk || onCancel);

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
	} = useScriptPageQuery(
		{},
		{
			enabled: true,
			initialPageSize: normalizePageSize(page_size),
			keepPreviousData: true,
			staleTime: 30_000,
			cacheTime: 5 * 60_000,
		}
	);

	useEffect(() => {
		setScriptTypeValue(normalizeText(script_type));
		setQuery({
			script_type: normalizeText(script_type),
			category: normalizeText(category),
			sort_by: "created_at",
			sort_order: "DESC",
		});
	}, [script_type, category, setQuery]);

	const selectedItem = useMemo(() => data.find((item) => item.id === selectedId), [data, selectedId]);

	const scriptTypeOptions = useMemo(() => {
		const values = new Set<string>();
		for (const item of data) {
			const value = item.script_type?.trim();
			if (value) {
				values.add(value);
			}
		}
		return Array.from(values).map((value) => ({ label: value, value }));
	}, [data]);

	const columns: ColumnsType<ScriptItem> = [
		{
			title: "Script Name",
			dataIndex: "component_name",
			key: "component_name",
			width: 300,
			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Script ID",
			dataIndex: "component_id",
			key: "component_id",
			width: 220,
			ellipsis: true,
			render: (value: string) => value || "-",
		},
		{
			title: "Script Type",
			dataIndex: "script_type",
			key: "script_type",
			width: 120,
			render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : "-"),
		},
		{
			title: "Category",
			dataIndex: "category",
			key: "category",
			width: 140,
			render: (value: string) => value || "-",
		},
		{
			title: "Container Template",
			dataIndex: "container_template_id",
			key: "container_template_id",
			width: 180,
			render: (value: string) => value || "-",
		},
		{
			title: "Updated At",
			dataIndex: "updated_at",
			key: "updated_at",
			width: 210,
			render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
		},
		{
			title: "Created At",
			dataIndex: "created_at",
			key: "created_at",
			width: 210,
			render: (value: string) => (value ? new Date(value).toLocaleString() : "-"),
		},
	];

	const selectColumns = useMemo<ColumnsType<ScriptItem>>(() => {
		if (!selectable) {
			return columns;
		}

		return [
			...columns,
			{
				title: "Action",
				key: "action",
				width:120,
				fixed: "right",
				render: (_: unknown, record) => (
					<Space>
						<Button
							type={record.id === selectedId ? "primary" : "default"}
							size="small"
							onClick={() => {
								setSelectedID(record.id)
								onOk && onOk(record)
							}}
						>
							{record.id === selectedId ? "Selected" : "Select"}
						</Button>
						{
							onAddScriptToNode && (
								<Button
									size="small"
									onClick={() => {
										onAddScriptToNode(record.component_id)
									}}
								>
									Add to Node
								</Button>
							)

						}
					</Space>

				),
			},
		];
	}, [columns, selectable, selectedId]);

	// const handleConfirm = () => {
	// 	if (!selectedItem || !onOk) {
	// 		return;
	// 	}
	// 	onOk(selectedItem);
	// };

	// const handleCancel = () => {
	// 	if (onCancel) {
	// 		onCancel();
	// 		return;
	// 	}
	// 	if (close) {
	// 		close();
	// 	}
	// };

	const applyKeywordSearch = () => {
		setQuery({
			keywords: normalizeText(keywords),
			script_type: normalizeText(scriptTypeValue),
			category: normalizeText(category),
			sort_by: "updated_at",
			sort_order: "DESC",
		});
	};



	return (
		<BorderlessCard
			size="small"
			title={title || "Script List"}
			extra={
				<Space>
					<Text type="secondary">Total: {total}</Text>
					<Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
						Refresh
					</Button>
				</Space>
			}
		>
			<Space wrap style={{ marginBottom: 12 }}>
				<Input
					allowClear
					placeholder="Search by name/description/tags/script id"
					value={keywords}
					onChange={(event) => setKeywords(event.target.value)}
					onPressEnter={applyKeywordSearch}
					style={{ width: 320 }}
				/>
				<Select
					allowClear
					placeholder="Script type"
					value={scriptTypeValue}
					onChange={(value) => {
						setScriptTypeValue(value);
						setQuery({
							script_type: normalizeText(value),
							category: normalizeText(category),
							sort_by: "updated_at",
							sort_order: "DESC",
						});
					}}
					options={scriptTypeOptions}
					style={{ width: 180 }}
				/>
				<Button type="primary" icon={<SearchOutlined />} onClick={applyKeywordSearch}>
					Search
				</Button>
			</Space>

			{error ? <Alert type="error" showIcon message="Failed to load scripts" style={{ marginBottom: 12 }} /> : null}

			<Table<ScriptItem>
				rowKey="id"
				columns={selectColumns}
				dataSource={data}
				loading={isLoading || isFetching}
				size="small"
				scroll={{ x: 1300 }}
				locale={{ emptyText: error ? "Failed to load scripts" : "No scripts" }}
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

			{/* {selectable && (
				<Flex justify="end" gap="small" style={{ marginTop: 12 }}>
					<Button onClick={handleCancel}>Cancel</Button>
					<Button type="primary" disabled={!selectedItem} onClick={handleConfirm}>
						Confirm
					</Button>
				</Flex>
			)} */}
		</BorderlessCard>
	);
};

export default ScriptPage;

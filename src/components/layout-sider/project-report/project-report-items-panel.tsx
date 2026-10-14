import {
	addProjectReportItemApi,
	deleteProjectReportItemApi,
	listProjectReportItemApi,
	reorderProjectReportItemApi,
	type ProjectReportItem,
	type ProjectReportItemOwnerType,
} from "@/api/project";
import { invoke } from "@/core/ui-system/invokeV2";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { DeleteOutlined, FileTextOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Dropdown, Empty, Input, Modal, Popconfirm, Spin, Tree } from "antd";
import type { MenuProps, TreeProps } from "antd";
import { FC, useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import {
	countReportTreeNodes,
	flattenReportTreeOrders,
	moveReportTreeNode,
	toReportTreeNodes,
	type ReportTreeNode,
} from "./project-report-tree-utils";

const OWNER_TYPE_OPTIONS: { key: ProjectReportItemOwnerType; label: string }[] = [
	{ key: "analysis", label: "Analysis" },
	{ key: "analysis_node", label: "Analysis Node" },
	{ key: "ai_summary", label: "AI Summary" },
	{ key: "custom", label: "Section / Custom" },
];

interface AddReportItemModalProps {
	reportId: string;
	sortOrder: number;
	open: boolean;
	onClose: () => void;
	onAdded?: () => void;
}

// AddReportItemModal 仅用于新增 custom 类型条目：输入标题即可创建章节占位/自定义内容条目。
// analysis / analysis_node / ai_summary 类型条目改为通过 invoke 打开对应列表页进行选择。
const AddReportItemModal: FC<AddReportItemModalProps> = ({
	reportId,
	sortOrder,
	open,
	onClose,
	onAdded,
}) => {
	const message = useGlobalMessage();
	const [title, setTitle] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (open) {
			setTitle("");
		}
	}, [open]);

	const handleOk = async () => {
		if (!title.trim()) {
			message.warning("Please input a title");
			return;
		}

		setSubmitting(true);
		try {
			await addProjectReportItemApi({
				project_report_id: reportId,
				parent_id: "0",
				owner_type: "custom",
				sort_order: sortOrder,
				title: title.trim(),
			});
			message.success("Added successfully");
			onAdded?.();
			onClose();
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Modal
			open={open}
			title="Add custom item"
			onCancel={onClose}
			onOk={handleOk}
			confirmLoading={submitting}
			destroyOnClose
		>
			<Input
				style={{ width: "100%" }}
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Title"
				maxLength={255}
				onPressEnter={handleOk}
			/>
		</Modal>
	);
};

interface ProjectReportItemsPanelProps {
	reportId: string;
	onOpenItem: (item: ProjectReportItem) => void;
	onChanged?: () => void;
}

// ProjectReportItemsPanel 以 antd Tree 展示报告下所有条目，支持拖拽调整层级与顺序。
const ProjectReportItemsPanel: FC<ProjectReportItemsPanelProps> = ({ reportId, onOpenItem, onChanged }) => {
	const message = useGlobalMessage();
	const {
		data = [],
		isLoading,
		refetch,
	} = useQuery(
		["project-report-items", reportId],
		async () => (await listProjectReportItemApi(reportId)).data,
		{ enabled: !!reportId }
	);

	const [treeNodes, setTreeNodes] = useState<ReportTreeNode[]>([]);
	const [modalOpen, setModalOpen] = useState(false);
	const [reordering, setReordering] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// 以接口数据为准同步本地树，拖拽后通过 refetch 回写。
	useEffect(() => {
		setTreeNodes(toReportTreeNodes(data ?? []));
	}, [data]);

	// 新增条目追加到根节点末尾。
	const nextSortOrder = useMemo(() => treeNodes.length, [treeNodes]);
	const totalItems = useMemo(() => countReportTreeNodes(treeNodes), [treeNodes]);

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	// 非 custom 类型通过 invoke 打开对应列表页进行选择；custom 直接弹标题输入框。
	const handleAddMenuClick: MenuProps["onClick"] = async ({ key }) => {
		const ownerType = key as ProjectReportItemOwnerType;
		if (ownerType === "custom") {
			setModalOpen(true);
			return;
		}
		await handlePickOwnerAndAdd(ownerType);
	};

	// handlePickOwnerAndAdd 打开对应实体列表页选择一条记录，选中后作为报告条目写入。
	const handlePickOwnerAndAdd = async (ownerType: ProjectReportItemOwnerType) => {
		try {
			let picked: { id: string } | undefined;
			if (ownerType === "analysis") {
				picked = await invoke.analysisList.openDrawerAsync(
					{},
					{ title: "Select Analysis", width: 720 }
				);
			} else if (ownerType === "analysis_node") {
				picked = await invoke.analysisNodeList.openDrawerAsync(
					{},
					{ title: "Select Analysis Node", width: 720 }
				);
			} else if (ownerType === "ai_summary") {
				picked = await invoke.aiSummaryProject.openDrawerAsync(
					{},
					{ title: "Select AI Summary", width: 720 }
				);
			}

			if (!picked?.id) {
				return;
			}

			await addProjectReportItemApi({
				project_report_id: reportId,
				parent_id: "0",
				owner_type: ownerType,
				owner_id: picked.id,
				sort_order: nextSortOrder,
			});
			message.success("Added successfully");
			await refetch();
			onChanged?.();
		} catch {
			// 用户取消选择，无需处理。
		}
	};

	const handleDeleteItem = async (itemId: string) => {
		await deleteProjectReportItemApi({ id: itemId });
		message.success("Deleted successfully");
		await refetch();
		onChanged?.();
	};

	// handleDrop 按拖拽结果本地重排并持久化，失败时回滚到服务端数据。
	const handleDrop: NonNullable<TreeProps<ReportTreeNode>["onDrop"]> = async (info) => {
		const dropKey = String(info.node.key);
		const dragKey = String(info.dragNode.key);
		const dropPos = String(info.node.pos).split("-");
		const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

		const nextTree = moveReportTreeNode(treeNodes, dragKey, dropKey, info.dropToGap, dropPosition);
		if (!nextTree) {
			return;
		}

		setTreeNodes(nextTree);
		setReordering(true);
		try {
			await reorderProjectReportItemApi({
				report_id: reportId,
				items: flattenReportTreeOrders(nextTree),
			});
			await refetch();
			onChanged?.();
		} catch {
			await refetch();
		} finally {
			setReordering(false);
		}
	};

	const titleRender = (node: ReportTreeNode) => (
		<span className="project-report-tree-title">
			<FileTextOutlined className="project-report-item-icon" />
			<span className="project-report-item-title">{node.title}</span>
			<span className="project-report-item-meta">{node.ownerType}</span>
			<span className="project-report-item-actions" onClick={(e) => e.stopPropagation()}>
				<Popconfirm
					title="Delete selected report item and its children?"
					onConfirm={() => handleDeleteItem(node.key)}
				>
					<Button type="text" size="small" danger icon={<DeleteOutlined />} />
				</Popconfirm>
			</span>
		</span>
	);

	return (
		<div className="project-report-items-panel">
			<div className="project-report-items-panel-header">
				<span className="project-report-items-panel-title">
					Report Items
					{totalItems > 0 && <span className="project-report-items-panel-count">{totalItems}</span>}
				</span>
				<span className="project-report-items-panel-actions">
					<Button
						type="text"
						size="small"
						icon={<ReloadOutlined />}
						loading={refreshing}
						title="Refresh"
						onClick={handleRefresh}
					/>
					<Dropdown
						trigger={["click"]}
						menu={{
							items: OWNER_TYPE_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
							onClick: handleAddMenuClick,
						}}
					>
						<Button type="text" size="small" icon={<PlusOutlined />} title="Add item" />
					</Dropdown>
				</span>
			</div>

			{isLoading ? (
				<Spin size="small" />
			) : treeNodes.length === 0 ? (
				<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No report item" />
			) : (
				<Tree<ReportTreeNode>
					className="project-report-tree"
					treeData={treeNodes}
					blockNode
					draggable
					disabled={reordering}
					titleRender={titleRender}
					onDrop={handleDrop}
					onSelect={(_, info) => onOpenItem((info.node as unknown as ReportTreeNode).item)}
				/>
			)}

			<AddReportItemModal
				reportId={reportId}
				sortOrder={nextSortOrder}
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onAdded={async () => {
					await refetch();
					onChanged?.();
				}}
			/>
		</div>
	);
};

export default ProjectReportItemsPanel;

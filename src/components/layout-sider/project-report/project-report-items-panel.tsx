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
import {
	DeleteOutlined,
	ExperimentOutlined,
	FileSearchOutlined,
	FileTextOutlined,
	PlusOutlined,
	ReloadOutlined,
	RobotOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Empty, Input, Modal, Popconfirm, Spin, Tree } from "antd";
import type { MenuProps, TreeProps } from "antd";
import { FC, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "react-query";
import {
	countReportTreeNodes,
	findReportTreeNode,
	flattenReportTreeOrders,
	moveReportTreeNode,
	toReportTreeNodes,
	type ReportTreeNode,
} from "./project-report-tree-utils";

// ADD_OWNER_ACTIONS 把四种新增条目类型平铺成独立 icon 按钮，避免每次都要先展开下拉菜单。
const ADD_OWNER_ACTIONS: {
	key: ProjectReportItemOwnerType;
	label: string;
	icon: ReactNode;
}[] = [
	{ key: "analysis", label: "Add analysis", icon: <FileSearchOutlined /> },
	{ key: "analysis_node", label: "Add analysis node", icon: <ExperimentOutlined /> },
	{ key: "ai_summary", label: "Add AI summary", icon: <RobotOutlined /> },
	{ key: "custom", label: "Add section / custom", icon: <PlusOutlined /> },
];

// ROOT_PARENT_ID 是 antd Tree 中根层条目的父节点标识，与后端约定一致。
const ROOT_PARENT_ID = "0";

// ADD_OWNER_MENU_ITEMS 复用新增类型定义，作为树节点右键/加号下拉的菜单项。
const ADD_OWNER_MENU_ITEMS: MenuProps["items"] = ADD_OWNER_ACTIONS.map((action) => ({
	key: action.key,
	label: action.label,
	icon: action.icon,
}));

interface AddReportItemModalProps {
	reportId: string;
	parentId: string;
	sortOrder: number;
	open: boolean;
	onClose: () => void;
	onAdded?: () => void;
}

// AddReportItemModal 仅用于新增 custom 类型条目：输入标题即可创建章节占位/自定义内容条目。
// analysis / analysis_node / ai_summary 类型条目改为通过 invoke 打开对应列表页进行选择。
const AddReportItemModal: FC<AddReportItemModalProps> = ({
	reportId,
	parentId,
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
				parent_id: parentId,
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
	// addParentId 记录当前新增操作的父节点，"0" 表示追加到根层，否则作为该节点的子条目。
	const [addParentId, setAddParentId] = useState(ROOT_PARENT_ID);
	const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
	const [reordering, setReordering] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	// 以接口数据为准同步本地树，拖拽后通过 refetch 回写。
	useEffect(() => {
		setTreeNodes(toReportTreeNodes(data ?? []));
	}, [data]);

	// 新增条目追加到目标父节点的同级末尾。
	const nextSortOrder = useMemo(() => treeNodes.length, [treeNodes]);
	const totalItems = useMemo(() => countReportTreeNodes(treeNodes), [treeNodes]);

	// nextSortOrderFor 计算在指定父节点下追加新条目时的 sort_order。
	const nextSortOrderFor = (parentId: string) => {
		if (parentId === ROOT_PARENT_ID) {
			return nextSortOrder;
		}
		return findReportTreeNode(treeNodes, parentId)?.children?.length ?? 0;
	};

	// expandParents 展开新条目所在父节点，便于直接看到结果。
	const expandParents = (parentId: string) => {
		if (parentId === ROOT_PARENT_ID) {
			return;
		}
		setExpandedKeys((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]));
	};

	const handleRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} finally {
			setRefreshing(false);
		}
	};

	// 非 custom 类型通过 invoke 打开对应列表页进行选择；custom 直接弹标题输入框。
	// parentId 为 "0" 时新增到根层，为具体节点 id 时新增为该节点的子条目。
	const handleAddItem = async (ownerType: ProjectReportItemOwnerType, parentId = ROOT_PARENT_ID) => {
		if (ownerType === "custom") {
			setAddParentId(parentId);
			setModalOpen(true);
			return;
		}
		await handlePickOwnerAndAdd(ownerType, parentId);
	};

	// existingOwnerIds 返回指定父节点下已存在的同类型条目 owner_id 集合，用于避免重复添加。
	const existingOwnerIds = (parentId: string, ownerType: ProjectReportItemOwnerType) => {
		const siblings =
			parentId === ROOT_PARENT_ID
				? treeNodes
				: findReportTreeNode(treeNodes, parentId)?.children ?? [];
		return new Set(
			siblings
				.filter((node) => node.ownerType === ownerType)
				.map((node) => String(node.item.owner_id ?? ""))
		);
	};

	// handlePickOwnerAndAdd 打开对应实体列表页（支持多选）选择记录，选中后作为报告条目批量写入。
	const handlePickOwnerAndAdd = async (
		ownerType: ProjectReportItemOwnerType,
		parentId = ROOT_PARENT_ID
	) => {
		try {
			// multiple 让选择器返回数组，可一次选中多条批量添加。
			const params = { multiple: true };
			let picked: unknown;
			if (ownerType === "analysis") {
				picked = await invoke.analysisList.openDrawerAsync(params, {
					title: "Select Analysis",
					width: 720,
				});
			} else if (ownerType === "analysis_node") {
				picked = await invoke.analysisNodeList.openDrawerAsync(params, {
					title: "Select Analysis Node",
					width: 720,
				});
			} else if (ownerType === "ai_summary") {
				picked = await invoke.aiSummaryProject.openDrawerAsync(params, {
					title: "Select AI Summary",
					width: 720,
				});
			}

			// 兼容单选（对象）与多选（数组）两种回传形式。
			const pickedList: { id: string }[] = Array.isArray(picked)
				? (picked as { id: string }[])
				: picked
					? [picked as { id: string }]
					: [];
			if (pickedList.length === 0) {
				return;
			}

			// 已存在的同类型条目直接跳过，避免重复添加。
			const existing = existingOwnerIds(parentId, ownerType);
			const pending = pickedList.filter((item) => item?.id && !existing.has(String(item.id)));
			if (pending.length === 0) {
				message.warning("Selected items are already added");
				return;
			}

			// 逐条按顺序写入，保证 sort_order 连续且与选择顺序一致。
			let sortOrder = nextSortOrderFor(parentId);
			for (const item of pending) {
				await addProjectReportItemApi({
					project_report_id: reportId,
					parent_id: parentId,
					owner_type: ownerType,
					owner_id: String(item.id),
					sort_order: sortOrder,
				});
				sortOrder += 1;
			}

			expandParents(parentId);
			message.success(`Added ${pending.length} item(s)`);
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
				{/* 在当前节点下新增子条目：选择类型后以该节点 id 作为 parent_id 写入。 */}
				<Dropdown
					trigger={["click"]}
					menu={{
						items: ADD_OWNER_MENU_ITEMS,
						onClick: ({ key }) => void handleAddItem(key as ProjectReportItemOwnerType, node.key),
					}}
				>
					<Button
						type="text"
						size="small"
						icon={<PlusOutlined />}
						title="Add child item"
					/>
				</Dropdown>
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
					{ADD_OWNER_ACTIONS.map((action) => (
						<Button
							key={action.key}
							type="text"
							size="small"
							icon={action.icon}
							title={action.label}
							onClick={() => handleAddItem(action.key)}
						/>
					))}
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
					expandedKeys={expandedKeys}
					onExpand={(keys) => setExpandedKeys(keys as string[])}
					titleRender={titleRender}
					onDrop={handleDrop}
					onSelect={(_, info) => onOpenItem((info.node as unknown as ReportTreeNode).item)}
				/>
			)}

			<AddReportItemModal
				reportId={reportId}
				parentId={addParentId}
				sortOrder={nextSortOrderFor(addParentId)}
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				onAdded={async () => {
					expandParents(addParentId);
					await refetch();
					onChanged?.();
				}}
			/>
		</div>
	);
};

export default ProjectReportItemsPanel;

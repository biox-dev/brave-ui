import {
	getPlanDetailApi,
	savePlanApi,
	type AgentPlan,
	type PlanItem,
	type PlanSource,
} from "@/api/project";
import {
	BranchesOutlined,
	CloseOutlined,
	DeleteOutlined,
	PlusOutlined,
	ReloadOutlined,
} from "@ant-design/icons";
import { Button, Empty, Input, Popconfirm, Spin, Tree } from "antd";
import type { TreeProps } from "antd";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import {
	countPlanTreeNodes,
	flattenPlanTree,
	movePlanTreeNode,
	toPlanTreeNodes,
	type PlanTreeNode,
} from "./plan-tree-utils";

interface PlanDetailPanelProps {
	/** 计划 ID（由 leftMiddle 的 params 注入）。 */
	planId?: string;
	onClose?: () => void;
}

// newPlanItem 生成一个本地节点（ID 留空，保存时由后端补齐）。
const newPlanItem = (source: PlanSource = "custom"): PlanItem => ({
	id: "",
	parent_id: "0",
	title: source === "custom" ? "New section" : "",
	summary: "",
	source,
	source_id: "",
	sort_order: 0,
});

// PlanDetailPanel 展示单个计划的节点树：支持拖拽调整层级与顺序、新增 / 删除节点、编辑标题。
// 节点只带 source + source_id（不加载资源详情），给 agent 查询详情用的就是这些 ID。
const PlanDetailPanel: FC<PlanDetailPanelProps> = ({ planId, onClose }) => {
	const [plan, setPlan] = useState<AgentPlan>();
	const [tree, setTree] = useState<PlanTreeNode[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

	const load = useCallback(async () => {
		if (!planId) {
			setPlan(undefined);
			setTree([]);
			return;
		}
		setLoading(true);
		try {
			const resp = await getPlanDetailApi(planId);
			setPlan(resp.data);
			setTree(toPlanTreeNodes(resp.data?.items ?? []));
		} finally {
			setLoading(false);
		}
	}, [planId]);

	useEffect(() => {
		void load();
	}, [load]);

	const totalItems = useMemo(() => countPlanTreeNodes(tree), [tree]);

	// persist 把当前树写回后端（整体覆盖：标题 / 目标 / 节点树）。
	const persist = async (nextTree: PlanTreeNode[], title = plan?.title, goal = plan?.goal) => {
		if (!plan) {
			return;
		}
		setSaving(true);
		try {
			const resp = await savePlanApi({
				id: plan.id,
				title: title?.trim() || plan.title,
				goal,
				items: flattenPlanTree(nextTree),
			});
			setPlan(resp.data);
			setTree(toPlanTreeNodes(resp.data?.items ?? []));
		} finally {
			setSaving(false);
		}
	};

	const handleDrop: NonNullable<TreeProps<PlanTreeNode>["onDrop"]> = async (info) => {
		const dropKey = String(info.node.key);
		const dragKey = String(info.dragNode.key);
		const dropPos = String(info.node.pos).split("-");
		const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

		const nextTree = movePlanTreeNode(tree, dragKey, dropKey, info.dropToGap, dropPosition);
		if (!nextTree) {
			return;
		}
		setTree(nextTree);
		try {
			await persist(nextTree);
		} catch {
			await load();
		}
	};

	// addItem 在指定父节点下追加一个自定义节点。
	const addItem = async (parentId = "0") => {
		const node: PlanTreeNode = {
			key: `tmp-${Date.now()}`,
			title: "New section",
			source: "custom",
			item: { ...newPlanItem("custom"), parent_id: parentId },
		};
		const nextTree = parentId === "0" ? [...tree, node] : insertChild(tree, parentId, node);
		setExpandedKeys((prev) => (parentId === "0" || prev.includes(parentId) ? prev : [...prev, parentId]));
		setTree(nextTree);
		await persist(nextTree);
	};

	// removeItem 删除节点及其子树。
	const removeItem = async (key: string) => {
		const nextTree = removeNode(tree, key);
		setTree(nextTree);
		await persist(nextTree);
	};

	const renameItem = async (key: string, title: string) => {
		const nextTree = mapNode(tree, key, (node) => ({ ...node, title }));
		setTree(nextTree);
		await persist(nextTree);
	};

	const titleRender = (node: PlanTreeNode) => (
		<span className="plan-tree-title">
			<BranchesOutlined className="plan-tree-icon" />
			<Input
				size="small"
				variant="borderless"
				defaultValue={node.title}
				className="plan-tree-title-input"
				onBlur={(e) => {
					const value = e.target.value.trim();
					if (value && value !== node.title) {
						void renameItem(node.key, value);
					}
				}}
				onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
			/>
			<span className="plan-tree-meta">{node.source}</span>
			{node.sourceId ? <span className="plan-tree-meta">{node.sourceId}</span> : null}
			<span className="plan-tree-actions" onClick={(e) => e.stopPropagation()}>
				<Button type="text" size="small" icon={<PlusOutlined />} title="Add child" onClick={() => void addItem(node.key)} />
				<Popconfirm title="Delete this item and its children?" onConfirm={() => void removeItem(node.key)}>
					<Button type="text" size="small" danger icon={<DeleteOutlined />} />
				</Popconfirm>
			</span>
		</span>
	);

	return (
		<div className="plan-detail-panel">
			<div className="plan-detail-header">
				<span className="plan-detail-title">
					{plan?.title ?? "Plan"}
					{totalItems > 0 && <span className="plan-detail-count">{totalItems}</span>}
				</span>
				<span className="plan-detail-actions">
					<Button type="text" size="small" icon={<ReloadOutlined />} loading={saving} onClick={() => void load()} />
					<Button type="text" size="small" icon={<PlusOutlined />} title="Add root item" onClick={() => void addItem("0")} />
					{onClose ? (
						<Button type="text" size="small" icon={<CloseOutlined />} title="Close" onClick={onClose} />
					) : null}
				</span>
			</div>
			{plan?.goal ? <div className="plan-detail-goal">{plan.goal}</div> : null}
			{loading ? (
				<Spin size="small" />
			) : tree.length === 0 ? (
				<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No item" />
			) : (
				<Tree<PlanTreeNode>
					draggable
					blockNode
					showLine
					className="plan-tree"
					treeData={tree}
					expandedKeys={expandedKeys}
					onExpand={(keys) => setExpandedKeys(keys.map(String))}
					titleRender={titleRender}
					onDrop={handleDrop}
				/>
			)}
		</div>
	);
};

// insertChild 把 node 追加到 parentId 的子节点末尾。
function insertChild(nodes: PlanTreeNode[], parentId: string, node: PlanTreeNode): PlanTreeNode[] {
	return nodes.map((current) => {
		if (current.key === parentId) {
			return { ...current, isLeaf: false, children: [...(current.children ?? []), node] };
		}
		return current.children ? { ...current, children: insertChild(current.children, parentId, node) } : current;
	});
}

// removeNode 摘除 key 节点及其子树。
function removeNode(nodes: PlanTreeNode[], key: string): PlanTreeNode[] {
	return nodes
		.filter((node) => node.key !== key)
		.map((node) =>
			node.children ? { ...node, children: removeNode(node.children, key) } : node
		);
}

// mapNode 对 key 对应节点做变换，返回新树。
function mapNode(
	nodes: PlanTreeNode[],
	key: string,
	transform: (node: PlanTreeNode) => PlanTreeNode
): PlanTreeNode[] {
	return nodes.map((node) => {
		if (node.key === key) {
			return transform(node);
		}
		return node.children ? { ...node, children: mapNode(node.children, key, transform) } : node;
	});
}

export default PlanDetailPanel;

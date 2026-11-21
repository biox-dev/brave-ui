import type { PlanItem } from "@/api/project";

// PlanTreeNode 是 antd Tree 的数据节点：展示字段 + 原始节点，供拖拽后回写 source/source_id。
export interface PlanTreeNode {
	key: string;
	title: string;
	source: PlanItem["source"];
	sourceId?: string;
	item: PlanItem;
	isLeaf?: boolean;
	children?: PlanTreeNode[];
}

// toPlanTreeNodes 把后端返回的扁平节点列表（parent_id + sort_order）整理成 antd Tree 数据。
export const toPlanTreeNodes = (items: PlanItem[]): PlanTreeNode[] => {
	const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
	const byParent = new Map<string, PlanItem[]>();
	sorted.forEach((item) => {
		const parent = item.parent_id || "0";
		const bucket = byParent.get(parent) ?? [];
		bucket.push(item);
		byParent.set(parent, bucket);
	});

	const build = (parentId: string, visiting: Set<string>): PlanTreeNode[] => {
		const bucket = byParent.get(parentId) ?? [];
		return bucket.map((item) => {
			// 防御环引用：同一节点在一次递归路径上只展开一次。
			const loop = visiting.has(item.id);
			const next = loop ? visiting : new Set(visiting).add(item.id);
			const children = loop ? [] : build(item.id, next);
			return {
				key: item.id,
				title: item.title || item.id,
				source: item.source,
				sourceId: item.source_id,
				item,
				isLeaf: children.length === 0,
				children: children.length ? children : undefined,
			};
		});
	};

	const roots = build("0", new Set());
	// 孤儿节点（parent 不存在）提升为根，避免数据错误导致节点丢失。
	const seen = new Set<string>();
	const collect = (nodes: PlanTreeNode[]) =>
		nodes.forEach((node) => {
			seen.add(node.key);
			if (node.children) collect(node.children);
		});
	collect(roots);
	sorted.forEach((item) => {
		if (!seen.has(item.id)) {
			roots.push({
				key: item.id,
				title: item.title || item.id,
				source: item.source,
				sourceId: item.source_id,
				item,
			});
		}
	});
	return roots;
};

const clonePlanTree = (nodes: PlanTreeNode[]): PlanTreeNode[] =>
	nodes.map((node) => ({
		...node,
		children: node.children ? clonePlanTree(node.children) : undefined,
	}));

// takePlanNode 在当前树中摘除并返回 key 对应的节点。
function takePlanNode(nodes: PlanTreeNode[], key: string): PlanTreeNode | undefined {
	for (let i = 0; i < nodes.length; i += 1) {
		if (nodes[i].key === key) {
			return nodes.splice(i, 1)[0];
		}
		const children = nodes[i].children;
		if (children) {
			const found = takePlanNode(children, key);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

// findPlanTreeNode 按 key 在树中查找节点（含各级子节点）。
export function findPlanTreeNode(nodes: PlanTreeNode[], key: string): PlanTreeNode | undefined {
	for (const node of nodes) {
		if (node.key === key) {
			return node;
		}
		if (node.children) {
			const found = findPlanTreeNode(node.children, key);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

// insertAsSibling 将 dragNode 插入到 dropKey 节点之前或之后。
function insertAsSibling(nodes: PlanTreeNode[], dropKey: string, dragNode: PlanTreeNode, before: boolean): boolean {
	for (let i = 0; i < nodes.length; i += 1) {
		if (nodes[i].key === dropKey) {
			nodes.splice(before ? i : i + 1, 0, dragNode);
			return true;
		}
		if (nodes[i].children && insertAsSibling(nodes[i].children as PlanTreeNode[], dropKey, dragNode, before)) {
			return true;
		}
	}
	return false;
}

// movePlanTreeNode 依据 antd Tree 的拖拽结果移动节点，返回新树。
// 拖拽目标非法（例如把节点拖入自身子树）时返回 null，调用方应放弃本次移动。
export function movePlanTreeNode(
	nodes: PlanTreeNode[],
	dragKey: string,
	dropKey: string,
	dropToGap: boolean,
	dropPosition: number
): PlanTreeNode[] | null {
	const next = clonePlanTree(nodes);
	const dragNode = takePlanNode(next, dragKey);
	if (!dragNode) {
		return null;
	}

	if (!dropToGap) {
		// 放到节点内部，作为其第一个子节点；拖入自身子树不合法。
		const target = findPlanTreeNode(next, dropKey);
		if (!target || findPlanTreeNode(dragNode.children ?? [], dropKey)) {
			return null;
		}
		target.children = target.children ? [dragNode, ...target.children] : [dragNode];
		return next;
	}

	// 放到节点前后，与目标节点同级。
	const inserted = insertAsSibling(next, dropKey, dragNode, dropPosition < 0);
	return inserted ? next : null;
}

// flattenPlanTree 先序遍历树，生成带 parent_id / sort_order 的扁平节点，用于持久化拖拽结果。
export function flattenPlanTree(nodes: PlanTreeNode[], parentId = "0"): PlanItem[] {
	const items: PlanItem[] = [];
	nodes.forEach((node, index) => {
		items.push({
			...node.item,
			parent_id: parentId,
			sort_order: index,
		});
		if (node.children?.length) {
			items.push(...flattenPlanTree(node.children, node.key));
		}
	});
	return items;
}

// countPlanTreeNodes 统计树中全部节点数量（含各级子节点）。
export function countPlanTreeNodes(nodes: PlanTreeNode[]): number {
	return nodes.reduce(
		(total, node) => total + 1 + (node.children ? countPlanTreeNodes(node.children) : 0),
		0
	);
}

import type {
	ProjectReportItemNode,
	ProjectReportItemOwnerType,
	ReorderProjectReportItemEntry,
} from "@/api/project";

// ReportTreeNode 是 antd Tree 的数据节点，除展示字段外还保留原始条目。
export interface ReportTreeNode {
	key: string;
	title: string;
	ownerType: ProjectReportItemOwnerType;
	item: ProjectReportItemNode;
	isLeaf?: boolean;
	children?: ReportTreeNode[];
}

// toReportTreeNodes 将接口返回的条目树转换成 antd Tree 数据。
export const toReportTreeNodes = (items: ProjectReportItemNode[]): ReportTreeNode[] =>
	items.map((item) => ({
		key: item.id,
		title: item.title || item.id,
		ownerType: item.owner_type,
		item,
		isLeaf: !item.children?.length,
		children: item.children?.length ? toReportTreeNodes(item.children) : undefined,
	}));

const cloneReportTree = (nodes: ReportTreeNode[]): ReportTreeNode[] =>
	nodes.map((node) => ({
		...node,
		children: node.children ? cloneReportTree(node.children) : undefined,
	}));

// takeReportNode 在当前树中摘除并返回 key 对应的节点。
function takeReportNode(nodes: ReportTreeNode[], key: string): ReportTreeNode | undefined {
	for (let i = 0; i < nodes.length; i += 1) {
		if (nodes[i].key === key) {
			return nodes.splice(i, 1)[0];
		}
		const children = nodes[i].children;
		if (children) {
			const found = takeReportNode(children, key);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

function findReportNode(nodes: ReportTreeNode[], key: string): ReportTreeNode | undefined {
	for (const node of nodes) {
		if (node.key === key) {
			return node;
		}
		if (node.children) {
			const found = findReportNode(node.children, key);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

// insertAsSibling 将 dragNode 插入到 dropKey 节点之前或之后。
function insertAsSibling(
	nodes: ReportTreeNode[],
	dropKey: string,
	dragNode: ReportTreeNode,
	before: boolean
): boolean {
	for (let i = 0; i < nodes.length; i += 1) {
		if (nodes[i].key === dropKey) {
			nodes.splice(before ? i : i + 1, 0, dragNode);
			return true;
		}
		if (nodes[i].children && insertAsSibling(nodes[i].children as ReportTreeNode[], dropKey, dragNode, before)) {
			return true;
		}
	}
	return false;
}

// moveReportTreeNode 依据 antd Tree 的拖拽结果移动节点，返回新树。
// 当拖拽目标非法（例如把节点拖入自身子树）时返回 null，调用方应放弃本次移动。
export function moveReportTreeNode(
	nodes: ReportTreeNode[],
	dragKey: string,
	dropKey: string,
	dropToGap: boolean,
	dropPosition: number
): ReportTreeNode[] | null {
	const next = cloneReportTree(nodes);
	const dragNode = takeReportNode(next, dragKey);
	if (!dragNode) {
		return null;
	}

	if (!dropToGap) {
		// 放到节点内部，作为其第一个子节点。
		const target = findReportNode(next, dropKey);
		if (!target) {
			return null;
		}
		target.children = target.children ? [dragNode, ...target.children] : [dragNode];
		return next;
	}

	// 放到节点前后，与目标节点同级。
	const inserted = insertAsSibling(next, dropKey, dragNode, dropPosition < 0);
	return inserted ? next : null;
}

// flattenReportTreeOrders 先序遍历树，生成每个条目的父节点与同级顺序，用于持久化拖拽结果。
export function flattenReportTreeOrders(
	nodes: ReportTreeNode[],
	parentID = "0"
): ReorderProjectReportItemEntry[] {
	const orders: ReorderProjectReportItemEntry[] = [];
	nodes.forEach((node, index) => {
		orders.push({ id: node.key, parent_id: parentID, sort_order: index });
		if (node.children?.length) {
			orders.push(...flattenReportTreeOrders(node.children, node.key));
		}
	});
	return orders;
}

// countReportTreeNodes 统计树中全部节点数量（含各级子节点）。
export function countReportTreeNodes(nodes: ReportTreeNode[]): number {
	return nodes.reduce(
		(total, node) => total + 1 + (node.children ? countReportTreeNodes(node.children) : 0),
		0
	);
}

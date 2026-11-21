import { getPlanDetailApi, type AgentPlan, type PlanItem, type PlanItemStatus } from "@/api/project";
import {
	BranchesOutlined,
	CheckCircleFilled,
	CloseOutlined,
	LoadingOutlined,
	MinusCircleFilled,
	ReloadOutlined,
	StopOutlined,
} from "@ant-design/icons";
import { Button, Empty, Spin, Tag, Tooltip } from "antd";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useComponentStore } from "@/event-bus/stores/components";
import { formatRelativeTime } from "@/utils/time";

/** 后端「计划节点状态变化」事件的组件类目 / 方法名（与 agentservice.PlanRealtimeCategory 一致）。 */
const PLAN_REALTIME_CATEGORY = "agent-plan-progress";
const PLAN_REALTIME_METHOD = "planProgressChanged";

interface PlanDetailPanelProps {
	/** 计划 ID（表格展开行的记录或右侧工作区标签的 params 注入）。 */
	planId?: string;
	/** 关闭当前承载面板（工作区标签用）。 */
	onClose?: () => void;
}

/**
 * PlanDetailPanel 是计划的**唯一**只读渲染器。
 *
 * 只接收 planId，自己请求 `/project/plan-detail`：
 *   - 项目「计划」表格的展开行（`expandable.expandedRowRender`）；
 *   - 会话页右侧 SessionResourceStack 的「计划」分区（点击后在右侧工作区打开标签）。
 *
 * 两处复用同一个组件、同一个请求来源，因此不存在「列表传 items、详情再查一次」的
 * 两份数据路径：始终以计划 ID 为准，看到的就是数据库里的最新节点树。
 *
 * 节点树是只读的（计划由 agent 工具 create_plan / update_plan 维护），
 * 每行展示标题、来源资源 ID 与执行状态。
 */
const PlanDetailPanel: FC<PlanDetailPanelProps> = ({ planId, onClose }) => {
	const { locale } = useI18n();
	const [plan, setPlan] = useState<AgentPlan>();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	const load = useCallback(async () => {
		if (!planId) {
			setPlan(undefined);
			setError(false);
			return;
		}
		setLoading(true);
		setError(false);
		try {
			const resp = await getPlanDetailApi(planId);
			setPlan(resp.data);
		} catch {
			// 错误提示由 http 拦截器统一展示，这里只标记「未取到计划」。
			setPlan(undefined);
			setError(true);
		} finally {
			setLoading(false);
		}
	}, [planId]);

	useEffect(() => {
		void load();
	}, [load]);

	// 实时进度：agent 上报状态后后端推 component.invoke(category, id=plan_id)，
	// 这里按计划 ID 注册监听，收到后重新拉详情（状态已在后端合并）。
	// 兜底延迟一次：状态行可能略晚于事件提交，稍后再拉更稳。
	const { register, unregister } = useComponentStore();
	useEffect(() => {
		if (!planId) {
			return;
		}
		const instance = {
			[PLAN_REALTIME_METHOD]: (rawArgs?: unknown) => {
				const args = (Array.isArray(rawArgs) ? rawArgs[0] : rawArgs) as
					| { plan_id?: string }
					| undefined;
				if (args?.plan_id && String(args.plan_id) !== String(planId)) {
					return;
				}
				window.setTimeout(() => void load(), 200);
			},
		};
		register(PLAN_REALTIME_CATEGORY, planId, instance);
		return () => unregister(PLAN_REALTIME_CATEGORY, planId, instance);
	}, [planId, load, register, unregister]);

	// 完成进度：标题栏展示「completed / total」。
	const progress = useMemo(() => {
		const items = plan?.items ?? [];
		const done = items.filter((item) => item.status === "completed").length;
		return { done, total: items.length };
	}, [plan?.items]);

	// 按 parent_id 组织成缩进树：根节点为 parent_id 缺失或指向不存在的节点。
	const rows = useMemo(() => flattenPlanRows(plan?.items ?? []), [plan?.items]);

	if (!planId) {
		return (
			<Empty
				image={Empty.PRESENTED_IMAGE_SIMPLE}
				description={locale === "en_US" ? "No plan selected" : "未选择计划"}
			/>
		);
	}

	return (
		<div className="plan-detail-panel">
			<div className="plan-detail-header">
				<span className="plan-detail-title">
					<BranchesOutlined />
					{plan?.title || planId}
					{rows.length > 0 && (
						<span className="plan-detail-count">
							{progress.done}/{progress.total}
						</span>
					)}
				</span>
				<span className="plan-detail-actions">
					{plan?.updated_at && (
						<span className="plan-detail-time">{formatRelativeTime(plan.updated_at, locale)}</span>
					)}
					<Tooltip title={locale === "en_US" ? "Refresh" : "刷新"}>
						<Button
							type="text"
							size="small"
							icon={<ReloadOutlined />}
							loading={loading}
							onClick={() => void load()}
						/>
					</Tooltip>
					{onClose ? (
						<Button
							type="text"
							size="small"
							icon={<CloseOutlined />}
							title={locale === "en_US" ? "Close" : "关闭"}
							onClick={onClose}
						/>
					) : null}
				</span>
			</div>

			{plan?.goal ? <div className="plan-detail-goal">{plan.goal}</div> : null}

			{loading && !plan ? (
				<Spin size="small" />
			) : rows.length === 0 ? (
				<Empty
					image={Empty.PRESENTED_IMAGE_SIMPLE}
					description={
						error
							? locale === "en_US"
								? "Failed to load plan"
								: "计划加载失败"
							: locale === "en_US"
								? "No item"
								: "暂无节点"
					}
				/>
			) : (
				<div className="plan-detail-tree">
					{rows.map(({ item, depth }) => (
						<div
							key={item.id}
							className={`plan-detail-tree-row plan-status-${item.status ?? "pending"}`}
							style={{ paddingInlineStart: 8 + depth * 18 }}
						>
							<span className="plan-detail-tree-title">{item.title}</span>
							{item.source && item.source !== "custom" && item.source_id ? (
								<Tag color="blue">{`${item.source}:${item.source_id}`}</Tag>
							) : null}
							<PlanStatusTag status={item.status} locale={locale} />
						</div>
					))}
				</div>
			)}
		</div>
	);
};

/** 状态展示映射：颜色 / 图标 / 文案（未上报等价于 pending）。 */
const PLAN_STATUS_META: Record<
	PlanItemStatus,
	{ color?: string; icon: FC; zh: string; en: string }
> = {
	pending: { icon: () => <MinusCircleFilled />, zh: "待开始", en: "Pending" },
	in_progress: { color: "processing", icon: () => <LoadingOutlined />, zh: "进行中", en: "In progress" },
	completed: { color: "success", icon: () => <CheckCircleFilled />, zh: "已完成", en: "Completed" },
	skipped: { icon: () => <StopOutlined />, zh: "已跳过", en: "Skipped" },
};

/** PlanStatusTag 渲染单个节点的执行状态（图标 + 文案）。 */
const PlanStatusTag: FC<{ status?: PlanItemStatus; locale: string }> = ({ status, locale }) => {
	const meta = PLAN_STATUS_META[status ?? "pending"] ?? PLAN_STATUS_META.pending;
	const Icon = meta.icon;
	return (
		<Tag color={meta.color} icon={<Icon />} className="plan-status-tag">
			{locale === "en_US" ? meta.en : meta.zh}
		</Tag>
	);
};

/** flattenPlanRows 把扁平节点列表按 parent_id 深度优先展开为「行 + 深度」。 */
const flattenPlanRows = (items: PlanItem[]): { item: PlanItem; depth: number }[] => {
	if (items.length === 0) {
		return [];
	}
	const byParent = new Map<string, PlanItem[]>();
	const ids = new Set(items.map((item) => item.id));
	items.forEach((item) => {
		// 指向不存在父节点的节点按根处理，避免数据错误导致节点丢失。
		const parent = item.parent_id && ids.has(item.parent_id) ? item.parent_id : "0";
		const bucket = byParent.get(parent) ?? [];
		bucket.push(item);
		byParent.set(parent, bucket);
	});
	byParent.forEach((bucket) =>
		bucket.sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
	);

	const rows: { item: PlanItem; depth: number }[] = [];
	const push = (parentId: string, depth: number, visiting: Set<string>) => {
		(byParent.get(parentId) ?? []).forEach((item) => {
			if (visiting.has(item.id)) {
				return; // 防御环引用
			}
			rows.push({ item, depth });
			push(item.id, depth + 1, new Set(visiting).add(item.id));
		});
	};
	push("0", 0, new Set());
	return rows;
};

export default PlanDetailPanel;

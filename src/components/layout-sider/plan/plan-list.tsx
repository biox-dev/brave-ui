import { deletePlanApi, listPlanApi, type AgentPlan } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useI18n } from "@/hooks/useI18n";
import { useLeftMiddlePane, useLeftMiddlePaneState } from "@/hooks/useLeftMiddlePane";
import { openLeftMiddlePane } from "@/layout/left-middle-pane-store";
import { formatRelativeTime } from "@/utils/time";
import {
	BranchesOutlined,
	DeleteOutlined,
	PlusOutlined,
	ReloadOutlined,
	UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Empty, Popconfirm, Spin, Tooltip } from "antd";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { useSelector } from "react-redux";
import SiderPanelLayout from "../common/sider-panel-layout";

export interface PlanListProps {
	/** 纵向堆叠布局注入的折叠态：折叠时仅保留标题栏。 */
	collapsed?: boolean;
	/** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
	onToggleCollapse?: () => void;
}

// PlanList 是左侧栏的「计划」面板：列出当前项目的 agent 计划，
// 选中后把计划节点树声明到 leftMiddle（二级详情），由 PlanDetailPanel 渲染。
const PlanList: FC<PlanListProps> = ({ collapsed = false, onToggleCollapse }) => {
	const message = useGlobalMessage();
	const { locale } = useI18n();
	const location = useLocation();
	const { project } = useSelector((state: { user: { project?: { project_id?: string } | string } }) => state.user);
	const projectId = typeof project === "string" ? project : project?.project_id;

	const [plans, setPlans] = useState<AgentPlan[]>([]);
	const [loading, setLoading] = useState(false);
	const [selectedId, setSelectedId] = useState<string>();
	// 折叠时计划列表不渲染交互，但仍保留删除能力（列表内按钮）。

	// 选中态来自路由（/plan/:id），刷新后仍可恢复。
	useEffect(() => {
		const match = location.pathname.match(/\/plan\/([^/]+)/);
		setSelectedId(match ? decodeURIComponent(match[1]) : undefined);
	}, [location.pathname]);

	useLeftMiddlePane(
		"planDetail",
		collapsed || !selectedId ? null : { planId: selectedId }
	);

	const leftMiddlePane = useLeftMiddlePaneState();
	const isDetailOpen =
		Boolean(selectedId) &&
		leftMiddlePane?.view === "planDetail" &&
		leftMiddlePane.params?.planId === selectedId;
	const openDetail = () => {
		if (!selectedId) {
			return;
		}
		openLeftMiddlePane({ view: "planDetail", params: { planId: selectedId } });
	};

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const resp = await listPlanApi();
			setPlans(resp.data ?? []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		// 折叠时只保留标题栏，避免无谓请求；展开后重新拉取。
		if (!collapsed) {
			void reload();
		}
	}, [collapsed, projectId, reload]);

	const handleDelete = useCallback(
		async (plan: AgentPlan) => {
			await deletePlanApi({ id: plan.id });
			message.success("Deleted successfully");
			if (plan.id === selectedId) {
				setSelectedId(undefined);
			}
			await reload();
		},
		[message, reload, selectedId]
	);

	const body = useMemo(() => {
		if (loading) {
			return <Spin size="small" />;
		}
		if (plans.length === 0) {
			return (
				<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No plan yet. Ask the agent to create one." />
			);
		}
		return (
			<div className="plan-list">
				{plans.map((plan) => (
					<div
						key={plan.id}
						className={`plan-list-row${plan.id === selectedId ? " is-selected" : ""}`}
						onClick={() => openLeftMiddlePane({ view: "planDetail", params: { planId: plan.id } })}
					>
						<BranchesOutlined className="plan-list-icon" />
						<div className="plan-list-text">
							<span className="plan-list-title">{plan.title || plan.id}</span>
							<span className="plan-list-meta">
								{plan.items?.length ?? 0} items
								{plan.updated_at ? ` · ${formatRelativeTime(plan.updated_at, locale)}` : ""}
							</span>
						</div>
						<span className="plan-list-actions" onClick={(e) => e.stopPropagation()}>
							<Popconfirm title="Delete this plan?" onConfirm={() => handleDelete(plan)}>
								<Button type="text" size="small" danger icon={<DeleteOutlined />} />
							</Popconfirm>
						</span>
					</div>
				))}
			</div>
		);
	}, [loading, plans, selectedId, locale, handleDelete]);

	return (
		<SiderPanelLayout
			title="Plans"
			collapsed={collapsed}
			onToggleCollapse={onToggleCollapse}
			actions={
				<>
					{selectedId && !collapsed && !isDetailOpen ? (
						<Tooltip title="Show plan items">
							<Button type="text" size="small" icon={<UnorderedListOutlined />} onClick={openDetail} />
						</Tooltip>
					) : null}
					<Tooltip title="Plans are created by the agent (create_plan)">
						<Button type="text" size="small" icon={<PlusOutlined />} disabled />
					</Tooltip>
					<Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void reload()} />
				</>
			}
		>
			{body}
		</SiderPanelLayout>
	);
};

export default PlanList;

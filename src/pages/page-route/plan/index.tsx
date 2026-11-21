import { FC } from "react";
import { useParams } from "react-router";
import { Card, Empty } from "antd";
import PlanDetailPanel from "@/components/layout-sider/plan/plan-detail-panel";

/**
 * PlanPage 是「计划」的主区域页面：/plan/:plan-id。
 *
 * 左侧栏 PlanList 选中计划后，节点树渲染在 leftMiddle；主区域保留一个可深链的页面，
 * 用于刷新 / 分享链接后仍能确认当前计划（节点树本身仍在左侧二级面板中编辑）。
 */
const PlanPage: FC = () => {
	const { "plan-id": planId } = useParams<{ "plan-id": string }>();

	if (!planId) {
		return <Empty description="No plan selected" />;
	}

	return (
		<Card size="small" variant="borderless" style={{ height: "100%", overflowY: "auto" }}>
			<PlanDetailPanel planId={planId} />
		</Card>
	);
};

export default PlanPage;

import { listPlanApi, type AgentPlanSummary } from "@/api/project";
import PlanDetailPanel from "@/components/layout-sider/plan/plan-detail-panel";
import { useI18n } from "@/hooks/useI18n";
import { formatRelativeTime } from "@/utils/time";
import { BranchesOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FC, useCallback, useEffect, useState } from "react";

const { Text } = Typography;

/**
 * PlanTablePage 是项目「计划」列表页（`/plan`，从左侧布局菜单进入）。
 *
 * 计划是项目级产物（AgentPlan.ProjectID），由 agent 工具 create_plan / update_plan
 * 维护，这里是**只读**视图：表格展示标题 / 目标 / 节点数 / 更新时间，
 * 展开一行时复用 `PlanDetailPanel`（按 planId 请求详情）渲染节点树。
 *
 * 与会话页右侧 SessionResourceStack 的「计划」分区共用同一个详情组件，
 * 因此两处行为一致，不需要维护第二份渲染逻辑。
 */
const PlanTablePage: FC = () => {
	const { locale } = useI18n();
	const [plans, setPlans] = useState<AgentPlanSummary[]>([]);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const resp = await listPlanApi();
			setPlans(Array.isArray(resp.data) ? resp.data : []);
		} catch {
			// 错误提示由 http 拦截器统一展示。
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const columns: ColumnsType<AgentPlanSummary> = [
		{
			title: locale === "en_US" ? "Title" : "标题",
			dataIndex: "title",
			key: "title",
			render: (title: string, record) => (
				<Space size={6}>
					<BranchesOutlined />
					<Text strong>{title || record.id}</Text>
				</Space>
			),
		},
		{
			title: locale === "en_US" ? "Goal" : "目标",
			dataIndex: "goal",
			key: "goal",
			render: (goal?: string) => (goal ? <Text type="secondary">{goal}</Text> : "-"),
		},
		{
			title: locale === "en_US" ? "Items" : "节点数",
			key: "items",
			width: 100,
			render: (_: unknown, record) => <Tag color="blue">{record.item_count ?? 0}</Tag>,
		},
		{
			title: locale === "en_US" ? "Updated" : "更新时间",
			dataIndex: "updated_at",
			key: "updated_at",
			width: 160,
			render: (updatedAt?: string) => (updatedAt ? formatRelativeTime(updatedAt, locale) : "-"),
		},
	];

	return (
		<Card
			size="small"
			styles={{ body: { paddingTop: 12 } }}
			title={
				<Typography.Text strong style={{ fontSize: 15 }}>
					{locale === "en_US" ? "Plans" : "计划"}
				</Typography.Text>
			}
			extra={
				<Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
					{locale === "en_US" ? "Refresh" : "刷新"}
				</Button>
			}
		>
			<Table<AgentPlanSummary>
				rowKey="id"
				columns={columns}
				dataSource={plans}
				loading={loading}
				size="middle"
				pagination={false}
				scroll={{ x: 720 }}
				locale={{
					emptyText: (
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description={
								locale === "en_US"
									? "No plans in this project yet"
									: "当前项目还没有计划"
							}
						/>
					),
				}}
				expandable={{
					expandedRowRender: (record) => <PlanDetailPanel planId={record.id} />,
					rowExpandable: () => true,
				}}
			/>
		</Card>
	);
};

export default PlanTablePage;

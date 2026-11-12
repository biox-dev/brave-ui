import { useCallback, useEffect, useRef, useState } from "react";
import {
	Alert,
	Badge,
	Button,
	Card,
	Col,
	Descriptions,
	Flex,
	Progress,
	Popconfirm,
	Row,
	Space,
	Statistic,
	Steps,
	Tag,
	Typography,
} from "antd";
import type { DescriptionsProps } from "antd";
import {
	CloudDownloadOutlined,
	DeleteOutlined,
	PlayCircleOutlined,
	ReloadOutlined,
	ToolOutlined,
} from "@ant-design/icons";
import {
	downloadRuntimeProvisionApi,
	getRuntimeProvisionStatusApi,
	installRuntimeProvisionApi,
	RuntimeProvisionState,
	startRuntimeProvisionApi,
	uninstallRuntimeProvisionApi,
	type RuntimeProvisionProgress,
	type RuntimeProvisionStatus,
	type RuntimeProvisionStatusResponse,
} from "@/api/container-provision";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text, Paragraph } = Typography;

/** 轮询间隔：下载 / 安装进行中时用于刷新进度。 */
const POLL_INTERVAL_MS = 1500;

/** 状态对应的展示文案与颜色。 */
const STATE_META: Record<
	string,
	{ label: string; color: string; badge: "success" | "processing" | "default" | "warning" | "error" }
> = {
	[RuntimeProvisionState.NotInstalled]: { label: "未安装", color: "default", badge: "default" },
	[RuntimeProvisionState.Downloaded]: { label: "已下载", color: "blue", badge: "processing" },
	[RuntimeProvisionState.Installed]: { label: "已安装（未运行）", color: "orange", badge: "warning" },
	[RuntimeProvisionState.Running]: { label: "运行中", color: "green", badge: "success" },
};

/**
 * 状态机阶段对应的 Steps 下标，用于让安装向导一眼看出当前进度。
 * 顺序与 docs/container-runtime-provisioner.md 的状态图一致。
 */
const STATE_STEP_INDEX: Record<string, number> = {
	[RuntimeProvisionState.NotInstalled]: 0,
	[RuntimeProvisionState.Downloaded]: 1,
	[RuntimeProvisionState.Installed]: 2,
	[RuntimeProvisionState.Running]: 3,
};

const resolveStateMeta = (state: string) =>
	STATE_META[state] ?? { label: state || "-", color: "default", badge: "default" as const };

const percentText = (percent: number) => (percent < 0 ? "进行中" : `${percent}%`);

/**
 * 容器运行时安装管理页。
 *
 * 覆盖后端 5 个接口：
 * - GET  /container/runtime/provision/status    → 状态与进度（轮询）
 * - POST /container/runtime/provision/download  → 下载 rootfs（202，异步）
 * - POST /container/runtime/provision/install   → 导入并启动（202，异步）
 * - POST /container/runtime/provision/uninstall → 卸载（同步，需二次确认）
 * - POST /container/runtime/provision/start     → 启动自检（同步）
 *
 * 异步接口只返回 202，真实结果通过 status 接口的 progress 字段体现，
 * 因此这里在操作开始后启动轮询，直到 progress.running 变为 false。
 */
const ContainerRuntimeProvisionPage = () => {
	const [status, setStatus] = useState<RuntimeProvisionStatus | null>(null);
	const [progress, setProgress] = useState<RuntimeProvisionProgress | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string>();
	const [pendingAction, setPendingAction] = useState<string>();
	const [uninstalling, setUninstalling] = useState(false);

	// 轮询定时器与「组件是否仍挂载」标记，避免卸载后继续 setState。
	const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(true);

	const stopPolling = useCallback(() => {
		if (pollTimerRef.current) {
			clearTimeout(pollTimerRef.current);
			pollTimerRef.current = null;
		}
	}, []);

	/**
	 * 拉取一次状态。
	 * withPolling=true 时，如果后端仍在执行异步操作（progress.running），自动安排下一次轮询。
	 */
	const load = useCallback(
		async (withPolling = true) => {
			try {
				const res = await getRuntimeProvisionStatusApi();
				if (!mountedRef.current) return;
				const data: RuntimeProvisionStatusResponse = res.data;
				setStatus(data.status);
				setProgress(data.progress);
				setLoadError(undefined);

				if (withPolling && data.progress?.running) {
					stopPolling();
					pollTimerRef.current = setTimeout(() => {
						void load(true);
					}, POLL_INTERVAL_MS);
				}
			} catch (error) {
				if (!mountedRef.current) return;
				setLoadError(
					(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
						"获取容器运行时状态失败",
				);
			} finally {
				if (mountedRef.current) setLoading(false);
			}
		},
		[stopPolling],
	);

	useEffect(() => {
		mountedRef.current = true;
		void load();
		return () => {
			mountedRef.current = false;
			stopPolling();
		};
	}, [load, stopPolling]);

	/** 执行一个异步操作（download / install）：提交后立即开始轮询进度。 */
	const runAsyncAction = useCallback(
		async (action: "download" | "install") => {
			setPendingAction(action);
			try {
				if (action === "download") {
					await downloadRuntimeProvisionApi();
					getGlobalMessage()?.success("已开始下载运行时包，进度见下方");
				} else {
					await installRuntimeProvisionApi();
					getGlobalMessage()?.success("已开始安装容器运行时，进度见下方");
				}
				await load(true);
			} catch {
				// 错误提示已由 http 拦截器统一处理
				await load(false);
			} finally {
				setPendingAction(undefined);
			}
		},
		[load],
	);

	/** 手动启动自检（同步）；未安装时后端返回 409，由页面提示去安装。 */
	const handleStart = useCallback(async () => {
		setPendingAction("start");
		try {
			const res = await startRuntimeProvisionApi();
			if (res.data?.installed) {
				getGlobalMessage()?.success(
					res.data.endpoint ? `容器运行时已启动：${res.data.endpoint}` : "容器运行时已启动",
				);
			}
		} catch {
			// 409 与其它错误已由 http 拦截器提示
		} finally {
			setPendingAction(undefined);
			await load(false);
		}
	}, [load]);

	/** 卸载（同步，危险操作）：需二次确认，成功后状态回到 not_installed。 */
	const handleUninstall = useCallback(async () => {
		setUninstalling(true);
		try {
			await uninstallRuntimeProvisionApi(true);
			getGlobalMessage()?.success("容器运行时已卸载");
		} catch {
			// 错误提示已由 http 拦截器统一处理
		} finally {
			setUninstalling(false);
			await load(false);
		}
	}, [load]);

	const state = status?.state ?? "";
	const meta = resolveStateMeta(state);
	const busy = Boolean(progress?.running) || Boolean(pendingAction);

	const infoItems = (): DescriptionsProps["items"] => [
		{
			key: "state",
			label: "状态",
			children: <Tag color={meta.color}>{meta.label}</Tag>,
		},
		{
			key: "distro",
			label: "发行版 / Distro",
			children: status?.distro || "-",
		},
		{
			key: "version",
			label: "版本",
			children: status?.version || "-",
		},
		{
			key: "endpoint",
			label: "Endpoint",
			children: status?.endpoint ? <Text copyable>{status.endpoint}</Text> : "-",
		},
		{
			key: "data_dir",
			label: "数据目录",
			children: status?.data_dir ? <Text copyable>{status.data_dir}</Text> : "-",
		},
		{
			key: "download_url",
			label: "下载地址",
			children: status?.download_url ? (
				<Typography.Link href={status.download_url} target="_blank" rel="noreferrer" ellipsis>
					{status.download_url}
				</Typography.Link>
			) : (
				"-"
			),
			span: 2,
		},
		{
			key: "detail",
			label: "详情",
			children: status?.detail || "-",
			span: 2,
		},
	];

	return (
		<Space direction="vertical" size="middle" style={{ display: "flex", padding: 16 }}>
			<Card size="small">
				<Flex justify="space-between" align="center" wrap gap="small">
					<div>
						<Typography.Title level={4} style={{ margin: 0 }}>
							容器运行时
						</Typography.Title>
						<Paragraph type="secondary" style={{ marginBottom: 0 }}>
							管理自管容器运行时的下载、安装与启动。Windows 上对应 WSL 发行版，Linux
							上对应本机 dockerd。
						</Paragraph>
					</div>
					<Space>
						<Badge status={meta.badge} text={meta.label} />
						<Button
							icon={<ReloadOutlined />}
							onClick={() => void load(false)}
							loading={loading}
						>
							刷新
						</Button>
					</Space>
				</Flex>
			</Card>

			{/* 加载失败（如接口被禁用 / 鉴权失败）时只提示，不阻塞下面的状态卡片 */}
			{loadError && (
				<Alert
					type="error"
					showIcon
					message="无法获取容器运行时状态"
					description={loadError}
					action={
						<Button size="small" onClick={() => void load(false)}>
							重试
						</Button>
					}
				/>
			)}

			<Card size="small" title="安装进度">
				<Steps
					size="small"
					current={STATE_STEP_INDEX[state] ?? 0}
					items={[
						{ title: "未安装" },
						{ title: "已下载" },
						{ title: "已安装" },
						{ title: "运行中" },
					]}
					style={{ marginBottom: 16 }}
				/>

				{/* 异步操作进度：后端每完成一个阶段就更新一次，前端轮询读取 */}
				{(progress?.running || progress?.stage) && (
					<Alert
						type={progress?.error ? "error" : progress?.running ? "info" : "success"}
						showIcon
						style={{ marginBottom: 12 }}
						message={
							<Space size="small" wrap>
								<Text strong>{progress?.stage || "准备中"}</Text>
								<Text type="secondary">{progress?.message || "-"}</Text>
								{typeof progress?.percent === "number" && (
									<Text type="secondary">({percentText(progress.percent)})</Text>
								)}
							</Space>
						}
					/>
				)}
				{progress?.running && (
					<Progress
						percent={progress.percent < 0 ? undefined : progress.percent}
						status="active"
						showInfo={progress.percent >= 0}
						style={{ marginBottom: 12 }}
					/>
				)}
				{progress?.error && !progress.running && (
					<Alert
						type="error"
						showIcon
						style={{ marginBottom: 12 }}
						message="上一次操作失败"
						description={progress.error}
					/>
				)}

				<Space wrap>
					<Button
						type="primary"
						icon={<CloudDownloadOutlined />}
						disabled={busy || state === RuntimeProvisionState.Running}
						loading={pendingAction === "download"}
						onClick={() => void runAsyncAction("download")}
					>
						下载运行时包
					</Button>
					<Button
						icon={<ToolOutlined />}
						disabled={busy || state === RuntimeProvisionState.Running}
						loading={pendingAction === "install"}
						onClick={() => void runAsyncAction("install")}
					>
						安装
					</Button>
					<Button
						icon={<PlayCircleOutlined />}
						disabled={busy || state === RuntimeProvisionState.NotInstalled}
						loading={pendingAction === "start"}
						onClick={() => void handleStart()}
					>
						启动
					</Button>
					<Popconfirm
						title="确认卸载容器运行时？"
						description="将删除发行版及其中的全部容器与镜像，操作不可恢复。"
						okText="确认卸载"
						okButtonProps={{ danger: true, loading: uninstalling }}
						cancelText="取消"
						onConfirm={() => void handleUninstall()}
						disabled={state === RuntimeProvisionState.NotInstalled}
					>
						<Button
							danger
							icon={<DeleteOutlined />}
							disabled={busy || state === RuntimeProvisionState.NotInstalled}
							loading={uninstalling}
						>
							卸载
						</Button>
					</Popconfirm>
				</Space>
			</Card>

			<Row gutter={[16, 16]}>
				<Col xs={24} lg={10}>
					<Card size="small" title="运行时状态" loading={loading}>
						<Descriptions size="small" column={1} items={infoItems()} />
					</Card>
				</Col>
				<Col xs={24} lg={14}>
					<Card size="small" title="操作说明">
						<Space direction="vertical" size="small" style={{ display: "flex" }}>
							<Statistic
								title="当前阶段"
								value={progress?.stage || "-"}
								valueStyle={{ fontSize: 20 }}
							/>
							<Paragraph type="secondary" style={{ marginBottom: 0 }}>
								<Text strong>下载</Text>：把 rootfs 包下载到本地缓存（支持断点续传），
								进度通过状态接口轮询展示。
							</Paragraph>
							<Paragraph type="secondary" style={{ marginBottom: 0 }}>
								<Text strong>安装</Text>：导入发行版并启动 dockerd，要求先完成下载。
							</Paragraph>
							<Paragraph type="secondary" style={{ marginBottom: 0 }}>
								<Text strong>启动</Text>：与进程启动时的自检一致；未安装时返回 409，
								请先完成下载与安装。
							</Paragraph>
							<Paragraph type="secondary" style={{ marginBottom: 0 }}>
								<Text strong>卸载</Text>：注销发行版并删除数据目录，会连带删除其中的
								全部容器与镜像，需二次确认。
							</Paragraph>
							<Paragraph type="secondary" style={{ marginBottom: 0 }}>
								若提示 <Text code>ErrUnsupported</Text>，说明当前平台（如 Linux）
								不支持该操作。
							</Paragraph>
						</Space>
					</Card>
				</Col>
			</Row>
		</Space>
	);
};

export default ContainerRuntimeProvisionPage;

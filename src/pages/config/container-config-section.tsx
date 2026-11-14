import { useEffect, useState } from "react";
import { Alert, Button, Divider, Form, Input, InputNumber, Select, Space, Switch } from "antd";
import { ContainerOutlined, SaveOutlined } from "@ant-design/icons";
import type { ContainerConfig } from "@/api/config";
import type { ContainerTemplateItem } from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
import type { ConfigSectionProps } from "./types";

const RUNTIME_OPTIONS = [
	{ label: "Docker", value: "docker" },
	{ label: "Kubernetes (k8s)", value: "k8s" },
	{ label: "K3s", value: "k3s" },
];

/** 容器端口访问模式，与后端 config.ContainerNetworkMode* 常量对齐。 */
const NETWORK_MODE_OPTIONS = [
	{
		label: "container_ip（直连容器 IP，默认）",
		value: "container_ip",
	},
	{
		label: "host_port（随机发布到宿主机端口）",
		value: "host_port",
	},
];

/** 后端 provision 段默认值（config.DefaultRuntimeProvisionConfig）。 */
const DEFAULT_PROVISION_DISTRO = "gobrave-ubuntu-docker";

/** 预置段默认值：config.yml 缺少 docker.provision 时用它回填表单。 */
const DEFAULT_PROVISION = {
	enabled: false,
	distro: DEFAULT_PROVISION_DISTRO,
	download_url: "",
	endpoint: "",
};

/**
 * 把后端返回的 container 段补齐为表单可用的形状。
 *
 * docker / docker.provision 是可选的（config.yml 可能整段缺失），
 * 统一补上默认值，避免 Switch 之类受控组件拿到 undefined。
 */
const withDefaults = (value: ContainerConfig): ContainerConfig => ({
	...value,
	network_mode: value.network_mode || "container_ip",
	docker: {
		...value.docker,
		provision: {
			...DEFAULT_PROVISION,
			...(value.docker?.provision ?? {}),
		},
	},
});

/** bash 工具执行位置，与后端 config.BashExecutionMode* 常量对齐。 */
const BASH_EXECUTION_MODE_OPTIONS = [
	{ label: "host（宿主机）", value: "host" },
	{ label: "container（容器模板）", value: "container" },
];

/** 后端默认 bash 容器模板 ID（config.DefaultBashContainerTemplateID）。 */
const DEFAULT_BASH_CONTAINER_TEMPLATE_ID = "202606160002";

const CLEANUP_POLICY_OPTIONS = [
	{ label: "none（不处理）", value: "none" },
	{ label: "stop（停止容器）", value: "stop" },
	{ label: "delete（删除容器）", value: "delete" },
];

/** 开关型配置项，减少重复的 Form.Item 样板代码。 */
const SwitchField = ({
	name,
	label,
	tooltip,
}: {
	name: string | (string | number)[];
	label: string;
	tooltip?: string;
}) => (
	<Form.Item
		name={name}
		label={label}
		tooltip={tooltip}
		valuePropName="checked"
		style={{ marginBottom: 12 }}
	>
		<Switch />
	</Form.Item>
);

/**
 * container 段的可视化配置表单。
 * 表单项与后端 config.ContainerConfig 的 yaml/json 键一一对应。
 */
const ContainerConfigSection = ({ value, onSave }: ConfigSectionProps<ContainerConfig>) => {
	const [form] = Form.useForm<ContainerConfig>();
	const [saving, setSaving] = useState(false);
	const bashExecutionMode = Form.useWatch("bash_execution_mode", form);
	const provisionEnabled = Form.useWatch(["docker", "provision", "enabled"], form);

	useEffect(() => {
		form.setFieldsValue(withDefaults(value));
	}, [form, value]);

	/** 打开容器模板列表选择模板，把模板 ID 写回表单（只记录编号，不查名称）。 */
	const handleSelectBashTemplate = async () => {
		const selected = (await invoke.containerTemplatePage
			.openAsync({}, { title: "选择容器模板", width: 1200, footer: false })
			.catch(() => undefined)) as ContainerTemplateItem | undefined;
		if (selected?.id) {
			form.setFieldsValue({ bash_container_template_id: String(selected.id) });
		}
	};

	const handleSave = async (values: ContainerConfig) => {
		setSaving(true);
		try {
			form.setFieldsValue(withDefaults(await onSave(values)));
		} catch {
			// 错误提示已由 http 拦截器统一处理
		}
		setSaving(false);
	};

	return (
		<Form<ContainerConfig> form={form} layout="vertical" onFinish={handleSave}>
			<Divider orientation="left" plain>
				运行时
			</Divider>

			<Space size="large" wrap align="start">
				<Form.Item
					name="default_runtime"
					label="默认运行时 (default_runtime)"
					rules={[{ required: true, message: "请选择默认运行时" }]}
				>
					<Select options={RUNTIME_OPTIONS} style={{ width: 200 }} />
				</Form.Item>

				<Form.Item
					name="runtimes"
					label="启动时注册的运行时 (runtimes)"
					tooltip="必须包含 default_runtime，否则默认运行时不会被注册"
					dependencies={["default_runtime"]}
					rules={[
						{
							validator: (_rule, runtimes: string[]) => {
								const defaultRuntime = form.getFieldValue("default_runtime");
								if (runtimes?.length && defaultRuntime && !runtimes.includes(defaultRuntime)) {
									return Promise.reject(
										new Error(`runtimes 必须包含 default_runtime（${defaultRuntime}）`),
									);
								}
								return Promise.resolve();
							},
						},
					]}
				>
					<Select
						mode="multiple"
						options={RUNTIME_OPTIONS}
						placeholder="留空则只注册 default_runtime"
						style={{ width: 320 }}
					/>
				</Form.Item>
			</Space>

			<Divider orientation="left" plain>
				网络
			</Divider>

			<Form.Item
				name="network_mode"
				label="容器端口访问方式 (network_mode)"
				tooltip="container_ip：gobrave 直接访问容器 IP（docker0 / k8s Pod IP），不占用宿主机端口；host_port：容器端口随机发布到宿主机，适用于 gobrave 无法路由容器 IP 的场景（如 Windows + WSL2 自管 dockerd）"
			>
				<Select options={NETWORK_MODE_OPTIONS} style={{ width: 320 }} />
			</Form.Item>

			<Alert
				type="info"
				showIcon
				style={{ marginBottom: 16 }}
				message="network_mode 与 docker.provision 仅在新进程启动时生效，保存后需重启 gobrave。"
			/>

			<Divider orientation="left" plain>
				Docker 运行时预置
			</Divider>

			<SwitchField
				name={["docker", "provision", "enabled"]}
				label="启动时自检并拉起运行时 (docker.provision.enabled)"
				tooltip="Windows 上拉起自管 WSL 发行版内的 dockerd，Linux 上拉起本机 dockerd；未安装时不做任何安装，等待安装向导"
			/>

			<Space size="large" wrap align="start">
				<Form.Item name={["docker", "provision", "distro"]} label="发行版名 (distro)">
					<Input
						style={{ width: 240 }}
						disabled={!provisionEnabled}
						placeholder={DEFAULT_PROVISION_DISTRO}
					/>
				</Form.Item>

				<Form.Item
					name={["docker", "provision", "endpoint"]}
					label="daemon 地址 (endpoint)"
					tooltip="留空时由平台实现选择默认值（Windows: tcp://localhost:2375，Linux/macOS: 本机 unix socket）"
				>
					<Input
						style={{ width: 300 }}
						disabled={!provisionEnabled}
						placeholder="tcp://localhost:2375"
					/>
				</Form.Item>
			</Space>

			<Form.Item
				name={["docker", "provision", "download_url"]}
				label="rootfs 下载地址 (download_url)"
				tooltip="安装向导下载 rootfs 包使用，仅 Windows 生效；接管已存在的同名发行版时可为空"
			>
				<Input
					style={{ width: 560 }}
					disabled={!provisionEnabled}
					placeholder="https://example.com/gobrave-ubuntu-docker.tar.gz"
				/>
			</Form.Item>

			<Divider orientation="left" plain>
				Kubernetes
			</Divider>

			<Space size="large" wrap align="start">
				<Form.Item name={["kubernetes", "namespace"]} label="命名空间 (namespace)">
					<Input placeholder="default" style={{ width: 220 }} />
				</Form.Item>

				<Form.Item
					name={["kubernetes", "kubeconfig"]}
					label="kubeconfig 路径 (kubeconfig)"
					tooltip="in_cluster 为 true 时留空"
				>
					<Input placeholder="/home/user/.kube/config" style={{ width: 320 }} />
				</Form.Item>
			</Space>

			<SwitchField
				name={["kubernetes", "in_cluster"]}
				label="集群内运行 (in_cluster)"
				tooltip="在集群内以 ServiceAccount 访问 API Server 时开启"
			/>

			<Divider orientation="left" plain>
				启动与清理策略
			</Divider>

			<SwitchField name="refresh_image_status_on_start" label="启动时刷新镜像状态" />
			<SwitchField name="recover_running_dag_on_start" label="启动时恢复运行中的 DAG" />
			<SwitchField
				name="cleanup_dag_node_containers_before_start"
				label="DAG 节点启动前清理容器"
			/>
			<SwitchField name="delete_container_on_node_success" label="节点成功后删除容器" />

			<Space size="large" wrap align="start">
				<Form.Item name="dag_node_cleanup_on_failed" label="节点失败时清理 (dag_node_cleanup_on_failed)">
					<Select options={CLEANUP_POLICY_OPTIONS} style={{ width: 200 }} />
				</Form.Item>

				<Form.Item
					name="dag_node_cleanup_on_dag_finished"
					label="DAG 结束时清理 (dag_node_cleanup_on_dag_finished)"
				>
					<Select options={CLEANUP_POLICY_OPTIONS} style={{ width: 200 }} />
				</Form.Item>
			</Space>

			<Divider orientation="left" plain>
				容器创建队列
			</Divider>

			<Space size="large" wrap align="start">
				<Form.Item
					name="create_queue_max_concurrency"
					label="最大并发创建数 (create_queue_max_concurrency)"
					tooltip="0 表示沿用管理器内置默认值"
				>
					<InputNumber min={0} style={{ width: 200 }} />
				</Form.Item>

				<Form.Item
					name="create_queue_max_pending"
					label="最大排队数 (create_queue_max_pending)"
					tooltip="0 表示沿用管理器内置默认值"
				>
					<InputNumber min={0} style={{ width: 200 }} />
				</Form.Item>
			</Space>

			<Divider orientation="left" plain>
				bash 工具执行位置
			</Divider>

			<Space size="large" wrap align="start">
				<Form.Item
					name="bash_execution_mode"
					label="执行位置 (bash_execution_mode)"
					tooltip="host：在宿主机持久 shell 中执行；container：在容器模板的终端中执行"
				>
					<Select options={BASH_EXECUTION_MODE_OPTIONS} style={{ width: 220 }} />
				</Form.Item>

				<Form.Item
					name="bash_container_template_id"
					label="容器模板编号 (bash_container_template_id)"
					tooltip="仅 container 模式生效；留空或 0 时使用内置默认模板 202606160002"
					style={{ minWidth: 300 }}
				>
					<Input
						style={{ width: 200 }}
						disabled={bashExecutionMode !== "container"}
						placeholder={DEFAULT_BASH_CONTAINER_TEMPLATE_ID}
					/>
				</Form.Item>

				<Form.Item label=" ">
					<Button
						icon={<ContainerOutlined />}
						disabled={bashExecutionMode !== "container"}
						onClick={() => void handleSelectBashTemplate()}
					>
						选择容器模板
					</Button>
				</Form.Item>
			</Space>

			<Form.Item>
				<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
					保存到 config.yml
				</Button>
			</Form.Item>
		</Form>
	);
};

export default ContainerConfigSection;

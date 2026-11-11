import { useEffect, useState } from "react";
import { Button, Divider, Form, Input, InputNumber, Select, Space, Switch } from "antd";
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

/** bash 工具执行位置，与后端 config.BashExecutionMode* 常量对齐。 */
const BASH_EXECUTION_MODE_OPTIONS = [
	{ label: "host（宿主机）", value: "host" },
	{ label: "container（容器模板）", value: "container" },
];

/** 后端默认 bash 容器模板 ID（config.DefaultBashContainerTemplateID）。 */
const DEFAULT_BASH_CONTAINER_TEMPLATE_ID = 202606160002;

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

	useEffect(() => {
		form.setFieldsValue(value);
	}, [form, value]);

	/** 打开容器模板列表选择模板，把模板 ID 写回表单（只记录编号，不查名称）。 */
	const handleSelectBashTemplate = async () => {
		const selected = (await invoke.containerTemplatePage
			.openAsync({}, { title: "选择容器模板", width: 1200, footer: false })
			.catch(() => undefined)) as ContainerTemplateItem | undefined;
		const id = Number(selected?.id);
		if (Number.isFinite(id) && id > 0) {
			form.setFieldsValue({ bash_container_template_id: id });
		}
	};

	const handleSave = async (values: ContainerConfig) => {
		setSaving(true);
		try {
			form.setFieldsValue(await onSave(values));
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
					<InputNumber
						style={{ width: 200 }}
						precision={0}
						disabled={bashExecutionMode !== "container"}
						placeholder={String(DEFAULT_BASH_CONTAINER_TEMPLATE_ID)}
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

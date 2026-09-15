import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Space, Spin, Tabs, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import {
	getConfigFileApi,
	updateConfigSectionApi,
	type ConfigFileResponse,
	type ConfigSectionKey,
	type ConfigSections,
} from "@/api/config";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import DatabaseConfigSection from "./database-config-section";
import ContainerConfigSection from "./container-config-section";

const { Paragraph } = Typography;

/** 配置段的中文名，用于 Tab 标题和保存提示。 */
const SECTION_LABELS: Record<ConfigSectionKey, string> = {
	database: "数据库",
	container: "容器",
};

/**
 * 可视化配置页。
 *
 * 页面负责：加载 config.yml（含文件状态提示）与保存配置段；
 * 每个配置段只负责渲染自己的表单，因此新增配置段只需新增一个 section 组件 + 一个 Tab。
 */
const ConfigPage = () => {
	const [configPath, setConfigPath] = useState("");
	const [configExists, setConfigExists] = useState(true);
	const [sections, setSections] = useState<ConfigSections | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const resp = await getConfigFileApi();
			const data: ConfigFileResponse = resp.data;
			setConfigPath(data.config_path);
			setConfigExists(data.config_exists);
			setSections(data.sections);
		} catch {
			// 错误提示已由 http 拦截器统一处理
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function saveSection<K extends ConfigSectionKey>(
		section: K,
		value: ConfigSections[K],
	): Promise<ConfigSections[K]> {
		const resp = await updateConfigSectionApi(section, value);
		setConfigPath(resp.data.config_path);
		setConfigExists(true);
		setSections((prev) => (prev ? { ...prev, [section]: resp.data.value } : prev));
		getGlobalMessage()?.success(`${SECTION_LABELS[section]} 配置已保存到 config.yml`);
		return resp.data.value;
	}

	return (
		<Space direction="vertical" size="middle" style={{ display: "flex", padding: 16 }}>
			<Card size="small">
				<Typography.Title level={4} style={{ margin: 0 }}>
					可视化配置
				</Typography.Title>
				<Paragraph type="secondary" style={{ marginBottom: 0 }}>
					读取当前生效的 config.yml 进行回填，保存后写回该文件；文件不存在时会自动创建。
				</Paragraph>
			</Card>

			<Alert
				type={configExists ? "info" : "warning"}
				showIcon
				message={configExists ? "当前配置文件" : "未找到 config.yml"}
				description={
					configExists
						? `已加载 ${configPath}，保存后立即写回该文件（其余配置段保持不变）。`
						: `未找到 ${configPath}，当前表单展示的是代码中的默认配置；保存时会自动创建该文件。`
				}
				action={
					<Button
						icon={<ReloadOutlined />}
						onClick={() => void load()}
						loading={loading}
					>
						重新加载
					</Button>
				}
			/>

			<Card>
				<Spin spinning={loading}>
					{sections ? (
						<Tabs
							defaultActiveKey="database"
							items={[
								{
									key: "database",
									label: SECTION_LABELS.database,
									children: (
										<DatabaseConfigSection
											value={sections.database}
											onSave={(value) => saveSection("database", value)}
										/>
									),
								},
								{
									key: "container",
									label: SECTION_LABELS.container,
									children: (
										<ContainerConfigSection
											value={sections.container}
											onSave={(value) => saveSection("container", value)}
										/>
									),
								},
							]}
						/>
					) : null}
				</Spin>
			</Card>
		</Space>
	);
};

export default ConfigPage;

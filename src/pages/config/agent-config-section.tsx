import { useEffect, useState } from "react";
import {
	Button,
	Card,
	Divider,
	Empty,
	Form,
	Input,
	Space,
	Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import type { AgentConfig, ModelProviderConfig } from "@/api/config";
import type { ConfigSectionProps } from "./types";

const { Text } = Typography;

/** 表单中的一行模型提供商。name 是 providers 的 key（模型名）。 */
interface ProviderRow extends ModelProviderConfig {
	name: string;
	/** extra 在表单中以 "type=anthropic" 这样的单行文本编辑。 */
	extraText: string;
}

interface AgentFormValues {
	providers: ProviderRow[];
}

const toProviderRows = (providers: Record<string, ModelProviderConfig> = {}): ProviderRow[] =>
	Object.entries(providers ?? {}).map(([name, provider]) => ({
		name,
		model: provider.model ?? "",
		base_url: provider.base_url ?? "",
		api_key: provider.api_key ?? "",
		extra: provider.extra ?? {},
		extraText: Object.entries(provider.extra ?? {})
			.map(([key, value]) => `${key}=${value}`)
			.join("\n"),
	}));

/** 把 "key=value" 单行文本解析回 extra，忽略空行与没有 "=" 的行。 */
const parseExtraText = (text: string): Record<string, string> => {
	const extra: Record<string, string> = {};
	for (const line of (text ?? "").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const index = trimmed.indexOf("=");
		if (index <= 0) continue;
		extra[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
	}
	return extra;
};

const toAgentConfig = (values: AgentFormValues): AgentConfig => {
	const providers: Record<string, ModelProviderConfig> = {};
	for (const row of values.providers ?? []) {
		const name = row.name?.trim();
		if (!name) continue;
		providers[name] = {
			model: row.model?.trim() ?? "",
			base_url: row.base_url?.trim() ?? "",
			api_key: row.api_key?.trim() ?? "",
			extra: parseExtraText(row.extraText),
		};
	}
	return { providers };
};

/**
 * agent 段的可视化配置表单。
 * 表单项与后端 config.AgentConfig / config.ModelProviderConfig 的 yaml/json 键一一对应：
 * providers 是以模型名为 key 的配置表，这里用卡片列表编辑每一行。
 */
const AgentConfigSection = ({ value, onSave }: ConfigSectionProps<AgentConfig>) => {
	const [form] = Form.useForm<AgentFormValues>();
	const [saving, setSaving] = useState(false);

	// 外部值变化（首次加载 / 重新加载 / 保存后被归一化）时同步到表单。
	useEffect(() => {
		form.setFieldsValue({ providers: toProviderRows(value?.providers) });
	}, [form, value]);

	const handleSave = async (values: AgentFormValues) => {
		setSaving(true);
		try {
			const saved = await onSave(toAgentConfig(values));
			form.setFieldsValue({ providers: toProviderRows(saved?.providers) });
		} catch {
			// 错误提示已由 http 拦截器统一处理
		} finally {
			setSaving(false);
		}
	};

	return (
		<Form<AgentFormValues> form={form} layout="vertical" onFinish={handleSave}>
			<Divider orientation="left" plain>
				模型提供商 (providers)
			</Divider>
			<Text type="secondary">
				key 为模型名，与 Agent Profile 的 model 对应；一次请求据此查找 base_url / api_key 等配置。
			</Text>

			{/* 打开页面时若还没有任何 provider，给出一条空行方便填写。 */}
			<Form.List name="providers" initialValue={[toProviderRows({ "": {} as ModelProviderConfig })[0]]}>
				{(fields, { add, remove }) => (
					<>
						{fields.length === 0 ? (
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description="暂无模型提供商"
								style={{ margin: "16px 0" }}
							/>
						) : null}

						{fields.map((field) => (
							<Card
								key={field.key}
								size="small"
								style={{ marginTop: 12 }}
								title={`提供商 ${field.name + 1}`}
								extra={
									<Button
										type="text"
										danger
										icon={<DeleteOutlined />}
										onClick={() => remove(field.name)}
									>
										删除
									</Button>
								}
							>
								<Space size="large" wrap align="start">
									<Form.Item
										name={[field.name, "name"]}
										label="模型名 (providers key)"
										tooltip="同时作为代理的默认 model"
										rules={[
											{ required: true, whitespace: true, message: "请输入模型名" },
										]}
									>
										<Input placeholder="deepseek-v4-flash" style={{ width: 240 }} />
									</Form.Item>

									<Form.Item
										name={[field.name, "model"]}
										label="模型 (model)"
										tooltip="留空时使用 providers key"
									>
										<Input placeholder="留空则使用模型名" style={{ width: 240 }} />
									</Form.Item>

									<Form.Item name={[field.name, "base_url"]} label="接口地址 (base_url)">
										<Input
											placeholder="https://api.deepseek.com/anthropic"
											style={{ width: 320 }}
										/>
									</Form.Item>
								</Space>

								<Space size="large" wrap align="start">
									<Form.Item name={[field.name, "api_key"]} label="API Key (api_key)">
										<Input.Password style={{ width: 320 }} />
									</Form.Item>
								</Space>

								<Form.Item
									name={[field.name, "extraText"]}
									label="额外参数 (extra)"
									tooltip="每行一个 key=value，例如 type=anthropic、bearer_token=xxx"
								>
									<Input.TextArea
										autoSize={{ minRows: 1, maxRows: 4 }}
										placeholder={"type=anthropic\nbearer_token=xxx"}
									/>
								</Form.Item>
							</Card>
						))}

						<Button
							type="dashed"
							icon={<PlusOutlined />}
							onClick={() =>
								add({
									name: "",
									model: "",
									base_url: "",
									api_key: "",
									extra: {},
									extraText: "",
								})
							}
							style={{ marginTop: 12 }}
							block
						>
							添加模型提供商
						</Button>
					</>
				)}
			</Form.List>

			<Form.Item style={{ marginTop: 16 }}>
				<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
					保存到 config.yml
				</Button>
			</Form.Item>
		</Form>
	);
};

export default AgentConfigSection;

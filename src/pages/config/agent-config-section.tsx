import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Alert,
	AutoComplete,
	Button,
	Card,
	Divider,
	Empty,
	Form,
	Input,
	Select,
	Space,
	Tag,
	Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import {
	getModelProviderOptionsApi,
	type AgentConfig,
	type ModelProviderConfig,
	type ModelVendorPreset,
} from "@/api/config";
import type { ConfigSectionProps } from "./types";

const { Text, Paragraph } = Typography;

/**
 * 表单中的一行模型配置。
 *
 * 与后端 ModelProviderConfig 的差异：
 *   - `vendor` 是厂商类型（下拉框），对应 `provider`；
 *   - `modelName` 提供给厂商的真实模型名（下拉 + 可输入），既作为 providers 的 key，
 *     也作为 `api_model`；
 *   - `extraText` 是 extra 的单行文本编辑形式（高级选项）。
 */
interface ProviderRow {
	name: string;
	vendor: string;
	modelName: string;
	api_key: string;
	base_url: string;
	extraText: string;
}

interface AgentFormValues {
	providers: ProviderRow[];
}

const emptyRow = (): ProviderRow => ({
	name: "",
	vendor: "",
	modelName: "",
	api_key: "",
	base_url: "",
	extraText: "",
});

/** 后端 providers（按模型名索引）→ 表单行。 */
const toProviderRows = (providers: Record<string, ModelProviderConfig> = {}): ProviderRow[] =>
	Object.entries(providers ?? {}).map(([name, provider]) => ({
		name,
		vendor: provider.provider ?? "",
		modelName: provider.api_model ?? provider.model_id ?? name,
		api_key: provider.api_key ?? "",
		base_url: provider.base_url ?? "",
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

/**
 * 表单行 → 后端 providers 表。
 *
 * 只提交「厂商 + 模型名 + API Key（+ 可选 base_url / extra）」：providers 的 key 与
 * api_model 都用模型名，其余元信息（上下文窗口、最大输出、价格等）由后端按厂商预置表补齐。
 */
const toAgentConfig = (values: AgentFormValues): AgentConfig => {
	const providers: Record<string, ModelProviderConfig> = {};
	for (const row of values.providers ?? []) {
		const modelName = row.modelName?.trim();
		const vendor = row.vendor?.trim();
		if (!modelName || !vendor) continue;
		const key = modelName.toLowerCase();
		providers[key] = {
			model_id: key,
			provider: vendor,
			api_model: modelName,
			api_key: row.api_key?.trim() ?? "",
			base_url: row.base_url?.trim() ?? "",
			extra: parseExtraText(row.extraText),
		};
	}
	return { providers };
};

/**
 * agent 段的可视化配置表单。
 *
 * 交互目标是「选厂商 → 选/填模型 → 填 API Key」三步完成模型配置：
 *   - 厂商下拉框来自后端 /config/model/providers，选中后自动带出默认 base_url；
 *   - 模型下拉框给出该厂商的常见模型，也可以直接输入任意模型名；
 *   - 保存时后端会按厂商 + 模型自动补齐能力元信息与价格。
 */
const AgentConfigSection = ({ value, onSave }: ConfigSectionProps<AgentConfig>) => {
	const [form] = Form.useForm<AgentFormValues>();
	const [saving, setSaving] = useState(false);
	const [vendors, setVendors] = useState<ModelVendorPreset[]>([]);
	const [providers, setProviders] = useState<ProviderRow[]>([]);

	// 外部值变化（首次加载 / 重新加载 / 保存后被归一化）时同步到表单。
	useEffect(() => {
		const rows = toProviderRows(value?.providers);
		setProviders(rows);
		form.setFieldsValue({ providers: rows });
	}, [form, value]);

	// 厂商目录只在首次挂载时加载一次。
	const loadOptions = useCallback(async () => {
		try {
			const resp = await getModelProviderOptionsApi();
			setVendors(resp.data.vendors ?? []);
		} catch {
			// 错误提示已由 http 拦截器统一处理
		}
	}, []);

	useEffect(() => {
		void loadOptions();
	}, [loadOptions]);

	const vendorMap = useMemo(() => {
		const map: Record<string, ModelVendorPreset> = {};
		for (const vendor of vendors) {
			map[vendor.type] = vendor;
		}
		return map;
	}, [vendors]);

	const vendorOptions = vendors.map((vendor) => ({
		value: vendor.type,
		label: vendor.name,
	}));

	const handleSave = async (values: AgentFormValues) => {
		setSaving(true);
		try {
			const saved = await onSave(toAgentConfig(values));
			const rows = toProviderRows(saved?.providers);
			setProviders(rows);
			form.setFieldsValue({ providers: rows });
		} catch {
			// 错误提示已由 http 拦截器统一处理
		} finally {
			setSaving(false);
		}
	};

	/** 选择厂商时把默认 base_url 与首个常见模型填进当前行（用户仍可修改）。 */
	const handleVendorChange = (index: number, vendorType: string) => {
		const vendor = vendorMap[vendorType];
		const rows = [...providers];
		const current = rows[index] ?? emptyRow();
		rows[index] = {
			...current,
			vendor: vendorType,
			base_url: current.base_url || vendor?.base_url || "",
			modelName: current.modelName || vendor?.models?.[0] || "",
		};
		setProviders(rows);
		form.setFieldsValue({ providers: rows });
	};

	/**
	 * 模型下拉候选：该厂商的常见模型 + 当前行已填写的模型。
	 *
	 * 注意必须返回「完整候选列表」，不能按当前值过滤：AutoComplete 只有在输入框有搜索词时
	 * 才做过滤，这里的过滤条件会以当前已选中的模型名去匹配自己，导致下拉里只剩一个模型。
	 */
	const modelOptionsFor = (vendorType: string, currentModel: string) => {
		const vendor = vendorMap[vendorType];
		const options = (vendor?.models ?? []).map((model) => ({ value: model }));
		if (currentModel && !options.some((option) => option.value === currentModel)) {
			options.unshift({ value: currentModel });
		}
		return options;
	};

	/**
	 * 打开下拉时清空搜索词。
	 *
	 * AutoComplete（combobox 模式）会把当前值同步成搜索词，于是下拉列表只剩「与当前值匹配」
	 * 的那一条候选。进入下拉前清掉搜索词，即可看到该厂商的全部模型。
	 */
	const resetModelSearch = (fieldName: number) => {
		form.setFieldValue(["providers", fieldName, "modelName"], undefined);
	};

	return (
		<Form<AgentFormValues> form={form} layout="vertical" onFinish={handleSave}>
			<Divider orientation="left" plain>
				模型提供商 (providers)
			</Divider>
			<Paragraph type="secondary" style={{ marginBottom: 8 }}>
				选择模型厂商与模型，填入 API Key 即可完成配置；接口地址、上下文窗口、最大输出等参数会按厂商自动补齐。
				每一行的「模型名」同时也是 providers 的 key，与 Agent Profile 的 model 对应。
			</Paragraph>

			{/* 打开页面时若还没有任何 provider，给出一条空行方便填写。 */}
			<Form.List name="providers" initialValue={[emptyRow()]}>
				{(fields, { add, remove }) => (
					<>
						{fields.length === 0 ? (
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description="暂无模型提供商"
								style={{ margin: "16px 0" }}
							/>
						) : null}

						{fields.map((field) => {
							const row = providers[field.name] ?? emptyRow();
							return (
								<Card
									key={field.key}
									size="small"
									style={{ marginTop: 12 }}
									title={row.modelName ? `模型 ${row.modelName}` : `提供商 ${field.name + 1}`}
									extra={
										<Button
											type="text"
											danger
											icon={<DeleteOutlined />}
											onClick={() => {
												remove(field.name);
												setProviders((prev) => prev.filter((_, i) => i !== field.name));
											}}
										>
											删除
										</Button>
									}
								>
									<Space size="large" wrap align="start">
										<Form.Item
											name={[field.name, "vendor"]}
											label="模型厂商 (provider)"
											rules={[{ required: true, message: "请选择模型厂商" }]}
											tooltip="决定使用哪条厂商 SDK（openai / anthropic / deepseek …）"
										>
											<Select
												style={{ width: 220 }}
												placeholder="选择厂商"
												options={vendorOptions}
												showSearch
												optionFilterProp="label"
												onChange={(vendor: string) => handleVendorChange(field.name, vendor)}
											/>
										</Form.Item>

										<Form.Item
											name={[field.name, "modelName"]}
											label="模型 (api_model)"
											rules={[{ required: true, whitespace: true, message: "请选择或输入模型名" }]}
											tooltip="可直接输入任意模型名；该值同时作为 providers 的 key"
										>
											<AutoComplete
												style={{ width: 260 }}
												placeholder="deepseek-v4-flash"
												options={modelOptionsFor(row.vendor, row.modelName)}
												onDropdownVisibleChange={(open: boolean) => {
													if (open) resetModelSearch(field.name);
												}}
												onChange={(value: string) => {
													const rows = [...providers];
													rows[field.name] = { ...(rows[field.name] ?? emptyRow()), modelName: value };
													setProviders(rows);
												}}
											/>
										</Form.Item>

										<Form.Item name={[field.name, "api_key"]} label="API Key (api_key)">
											<Input.Password style={{ width: 300 }} placeholder="sk-..." />
										</Form.Item>
									</Space>

									<Space size="large" wrap align="start">
										<Form.Item
											name={[field.name, "base_url"]}
											label="接口地址 (base_url)"
											tooltip="留空则使用厂商默认地址（选择厂商时已自动带出）"
										>
											<Input style={{ width: 360 }} placeholder="https://api.deepseek.com/v1" />
										</Form.Item>

										<Form.Item name={[field.name, "extraText"]} label="额外参数 (extra)">
											<Input style={{ width: 260 }} placeholder="每行一个 key=value" />
										</Form.Item>
									</Space>

									{row.vendor && vendorMap[row.vendor]?.base_url ? (
										<Tag color="blue">默认接口：{vendorMap[row.vendor].base_url}</Tag>
									) : null}
									{row.vendor && !vendorMap[row.vendor]?.base_url ? (
										<Text type="secondary">该厂商需要显式填写接口地址（如 Azure 部署地址）。</Text>
									) : null}
								</Card>
							);
						})}

						<Button
							type="dashed"
							icon={<PlusOutlined />}
							onClick={() => {
								setProviders((prev) => [...prev, emptyRow()]);
								add(emptyRow());
							}}
							style={{ marginTop: 12 }}
							block
						>
							添加模型
						</Button>
					</>
				)}
			</Form.List>

			<Alert
				type="info"
				showIcon
				style={{ marginTop: 16 }}
				message="模型配置会写入 config.yml 的 agent.providers"
				description="未填写的参数（上下文窗口、最大输出、是否支持推理、价格等）会按厂商预置补齐；自定义模型直接输入模型名即可。"
			/>

			<Form.Item style={{ marginTop: 16 }}>
				<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
					保存到 config.yml
				</Button>
			</Form.Item>
		</Form>
	);
};

export default AgentConfigSection;

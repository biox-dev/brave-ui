import { useEffect, useState } from "react";
import { Button, Divider, Form, Input, Select, Space } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import type { DatabaseConfig } from "@/api/config";
import type { ConfigSectionProps } from "./types";

const DRIVER_OPTIONS = [
	{ label: "SQLite", value: "sqlite" },
	{ label: "PostgreSQL", value: "postgres" },
	{ label: "MySQL", value: "mysql" },
];

/** 需要连接信息的驱动（sqlite 使用本地文件路径，不需要）。 */
const NETWORK_DRIVERS = ["postgres", "mysql"];

/**
 * database 段的可视化配置表单。
 * 表单回填由父组件传入的 value 提供，保存通过 onSave 交给父组件统一写回 config.yml。
 */
const DatabaseConfigSection = ({ value, onSave }: ConfigSectionProps<DatabaseConfig>) => {
	const [form] = Form.useForm<DatabaseConfig>();
	const [saving, setSaving] = useState(false);

	const driver = Form.useWatch("driver", form) ?? "sqlite";
	const isNetworkDriver = NETWORK_DRIVERS.includes(driver);

	// 外部值变化（首次加载 / 重新加载 / 保存后被归一化）时同步到表单。
	useEffect(() => {
		form.setFieldsValue(value);
	}, [form, value]);

	const handleSave = async (values: DatabaseConfig) => {
		setSaving(true);
		try {
			form.setFieldsValue(await onSave(values));
		} catch {
			// 错误提示已由 http 拦截器统一处理
		} finally {
			setSaving(false);
		}
	};

	return (
		<Form<DatabaseConfig> form={form} layout="vertical" onFinish={handleSave}>
			<Form.Item
				name="driver"
				label="驱动 (driver)"
				rules={[{ required: true, message: "请选择数据库驱动" }]}
			>
				<Select options={DRIVER_OPTIONS} style={{ maxWidth: 240 }} />
			</Form.Item>

			{isNetworkDriver && (
				<>
					<Divider orientation="left" plain>
						连接信息
					</Divider>

					<Space size="large" wrap align="start">
						<Form.Item
							name="host"
							label="主机 (host)"
							rules={[{ required: true, message: "请输入数据库主机" }]}
						>
							<Input placeholder="127.0.0.1" style={{ width: 220 }} />
						</Form.Item>

						<Form.Item
							name="port"
							label="端口 (port)"
							rules={[{ required: true, message: "请输入数据库端口" }]}
						>
							<Input placeholder="5432" style={{ width: 160 }} />
						</Form.Item>

						<Form.Item
							name="name"
							label="数据库名 (name)"
							rules={[{ required: true, message: "请输入数据库名" }]}
						>
							<Input placeholder="gobrave" style={{ width: 220 }} />
						</Form.Item>
					</Space>

					<Space size="large" wrap align="start">
						<Form.Item
							name="user"
							label="用户名 (user)"
							rules={[{ required: true, message: "请输入数据库用户名" }]}
						>
							<Input style={{ width: 220 }} />
						</Form.Item>

						<Form.Item name="password" label="密码 (password)">
							<Input.Password style={{ width: 220 }} />
						</Form.Item>

						{driver === "postgres" && (
							<Form.Item name="ssl_mode" label="SSL 模式 (ssl_mode)">
								<Input placeholder="disable" style={{ width: 220 }} />
							</Form.Item>
						)}
					</Space>
				</>
			)}

			{!isNetworkDriver && (
				<>
					<Divider orientation="left" plain>
						SQLite
					</Divider>

					<Form.Item
						name="path"
						label="数据库文件路径 (path)"
						tooltip="留空时使用 storage.base_dir/db/gobrave.db"
					>
						<Input placeholder="留空则使用 storage.base_dir/db/gobrave.db" />
					</Form.Item>
				</>
			)}

			<Form.Item>
				<Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
					保存到 config.yml
				</Button>
			</Form.Item>
		</Form>
	);
};

export default DatabaseConfigSection;

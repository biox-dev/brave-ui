import { FC, useMemo, useState } from "react";
import { Button, Card, ConfigProvider, Divider, Form, Input, Select, Space, Tag, Typography, theme as antdTheme } from "antd";
import { LockOutlined, MailOutlined, MoonOutlined, SunOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { registerApi } from "@/api/auth";
import { setUserItem } from "@/store/userSlice";
import { useI18n } from "@/hooks/useI18n";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

type RegisterFormValues = {
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
};

const Register: FC = () => {
	const navigate = useNavigate();
	const dispatch = useDispatch();
	const { locale, changeLanguage, t } = useI18n();
	const { theme } = useSelector((state: any) => state.user);
	const [form] = Form.useForm<RegisterFormValues>();
	const [loading, setLoading] = useState(false);
	const message = useGlobalMessage();
	const isDark = theme === "dark";

	const pageStyle = useMemo(
		() => ({
			minHeight: "100vh",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: 24,
			position: "relative" as const,
			overflow: "hidden",
			background: isDark
				? "radial-gradient(circle at 20% 20%, rgba(46, 105, 255, 0.28) 0%, rgba(10, 14, 28, 0.98) 42%, rgba(3, 8, 20, 1) 100%)"
				: "radial-gradient(circle at 20% 20%, rgba(24, 144, 255, 0.16) 0%, rgba(245, 247, 255, 1) 44%, rgba(255, 248, 232, 1) 100%)",
		}),
		[isDark]
	);

	const cardStyle = useMemo(
		() => ({
			width: "100%",
			maxWidth: 480,
			borderRadius: 24,
			border: isDark ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(15, 23, 42, 0.06)",
			boxShadow: isDark
				? "0 26px 70px rgba(0,0,0,0.42)"
				: "0 22px 60px rgba(15, 23, 42, 0.10)",
			backdropFilter: "blur(18px)",
			background: isDark
				? "linear-gradient(180deg, rgba(18,24,41,0.94) 0%, rgba(8,12,24,0.96) 100%)"
				: "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.82) 100%)",
		}),
		[isDark]
	);

	const onFinish = async (values: RegisterFormValues) => {
		setLoading(true);
		try {
			const { data } = await registerApi({
				username: values.username,
				email: values.email,
				password: values.password,
			});

			if (!data?.success) {
				message.error(data?.message || t("register.submit") + " failed");
				return;
			}

			message.success(t("register.successMessage"));
			setTimeout(() => {
				navigate("/login");
			}, 1500);
		} catch (error: any) {
			const serverMessage = error?.response?.data?.message || error?.response?.data?.detail;
			message.error(serverMessage || "Registration failed, please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ConfigProvider theme={{ algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm }}>
			<div style={pageStyle}>
				<div
					style={{
						position: "absolute",
						inset: 0,
						background:
							"radial-gradient(circle at 10% 10%, rgba(255,255,255,0.18) 0, transparent 26%), radial-gradient(circle at 90% 20%, rgba(255,255,255,0.14) 0, transparent 22%), radial-gradient(circle at 85% 85%, rgba(255,255,255,0.10) 0, transparent 24%)",
						pointerEvents: "none",
					}}
				/>

				<Card style={cardStyle} styles={{ body: { padding: 28 } }}>
					<Space direction="vertical" size={18} style={{ width: "100%" }}>
						<div style={{ textAlign: "center" }}>
							<Tag color="geekblue" style={{ border: "none", marginBottom: 10 }}>
								{t("register.brand")}
							</Tag>
							<Typography.Title level={2} style={{ margin: 0 }}>
								{t("register.title")}
							</Typography.Title>
							<Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
								{t("register.subtitle")}
							</Typography.Paragraph>
						</div>

						<Divider style={{ margin: "8px 0 16px" }} />

						<Form<RegisterFormValues>
							form={form}
							layout="vertical"
							onFinish={onFinish}
							initialValues={{ username: "", email: "", password: "", confirmPassword: "" }}
							size="large"
						>
							<Form.Item
								label={t("register.usernameLabel")}
								name="username"
								rules={[{ required: true, message: t("register.usernameRequired") }]}
							>
								<Input prefix={<UserOutlined />} placeholder={t("register.usernamePlaceholder")} />
							</Form.Item>

							<Form.Item
								label={t("register.emailLabel")}
								name="email"
								rules={[
									{ required: true, message: t("register.emailRequired") },
									{ type: "email", message: t("register.emailInvalid") },
								]}
							>
								<Input prefix={<MailOutlined />} placeholder={t("register.emailPlaceholder")} />
							</Form.Item>

							<Form.Item
								label={t("register.passwordLabel")}
								name="password"
								rules={[
									{ required: true, message: t("register.passwordRequired") },
									{ min: 6, message: t("register.passwordMinLength") },
								]}
							>
								<Input.Password prefix={<LockOutlined />} placeholder={t("register.passwordPlaceholder")} />
							</Form.Item>

							<Form.Item
								label={t("register.confirmPasswordLabel")}
								name="confirmPassword"
								dependencies={["password"]}
								rules={[
									{ required: true, message: t("register.confirmPasswordRequired") },
									({ getFieldValue }) => ({
										validator(_, value) {
											if (!value || getFieldValue("password") === value) {
												return Promise.resolve();
											}
											return Promise.reject(new Error(t("register.passwordMismatch")));
										},
									}),
								]}
							>
								<Input.Password prefix={<LockOutlined />} placeholder={t("register.confirmPasswordPlaceholder")} />
							</Form.Item>

							<Form.Item style={{ marginBottom: 0 }}>
								<Button type="primary" htmlType="submit" block loading={loading} style={{ height: 44, borderRadius: 12 }}>
									{t("register.submit")}
								</Button>
							</Form.Item>
						</Form>

						<div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
							<Space size={8}>
								<Button
									type="text"
									icon={isDark ? <SunOutlined /> : <MoonOutlined />}
									onClick={() => dispatch(setUserItem({ theme: isDark ? "light" : "dark" }))}
								/>
								<Typography.Text type="secondary">{t("login.themeTag")}</Typography.Text>
							</Space>

							<Select
								size="small"
								value={locale}
								style={{ width: 110 }}
								onChange={changeLanguage}
								options={[
									{ value: "zh_CN", label: "中文" },
									{ value: "en_US", label: "English" },
								]}
							/>
						</div>

						<div style={{ textAlign: "center", paddingTop: 4 }}>
							<Button type="link" onClick={() => navigate("/login")}>
								{t("register.loginLink")}
							</Button>
						</div>
					</Space>
				</Card>
			</div>
		</ConfigProvider>
	);
};

export default Register;

import {
	getStoreApi,
	publishStoreRemoteApi,
	type StoreDetail,
} from "@/api/pipeline/store";
import type { GitRemote } from "@/api/pipeline/git";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Space, Spin, Tag, Tooltip, Typography } from "antd";
import { FC, useEffect, useState } from "react";

/**
 * 「发布到远程」抽屉：把 store 裸仓库的地址配置成 git remote（github / gitee ...）。
 *
 * store 表已删除 url 列，目标地址保存在 store 裸仓库的 git remote 配置里，所以本组件：
 *   - 读出 store 详情，列出仓库当前已配置的所有 remote（可点击回填、便于再次发布）；
 *   - 提交后把新 remote 追加进列表，并按后端返回的 remote_added 如实提示
 *     （新增 / 已存在跳过添加；真正的 push 还没实现）。
 *
 * 支持配置多个远端（一次发布到 github + gitee）：同一个地址重复提交会被识别为已存在。
 *
 * 通过 `invoke.publishStore.open({ store_id })` 打开（注册见 ./index.ts），
 * 抽屉以 `footer: null` 打开，因此按钮由本组件自己渲染。
 */
export interface PublishStoreRemoteProps {
	/** store 表 int64 主键（后端 `json:"id,string"`，前端拿到的是字符串）。 */
	store_id?: string | number;
	/** 提交成功回调（`invoke.xxx.openDrawerAsync` 模式下用于 resolve 结果）。 */
	onOk?: (data?: unknown) => void;
	onCancel?: () => void;
	/** 由 UI 容器注入：关闭抽屉。 */
	close?: () => void;
}

/** 把 git 地址转成可在浏览器打开的网页地址；无法转换时返回空串。 */
const toWebURL = (raw: string): string => {
	const url = (raw ?? "").trim();
	if (!url) {
		return "";
	}
	const ssh = url.match(/^git@([^:]+):(.+)$/);
	if (ssh) {
		return `https://${ssh[1]}/${ssh[2].replace(/\.git$/, "")}`;
	}
	if (/^https?:\/\//i.test(url)) {
		return url.replace(/\.git$/, "");
	}
	return "";
};

/** 从 axios / 后端统一错误结构里取可读文案。 */
const getErrorText = (error: unknown, fallback: string): string => {
	const resp = (error as { response?: { data?: { message?: string; detail?: string } } })?.response;
	return resp?.data?.message || resp?.data?.detail || (error as Error)?.message || fallback;
};

const PublishStoreRemote: FC<PublishStoreRemoteProps> = ({ store_id, onOk, onCancel, close }) => {
	const message = useGlobalMessage();
	const [form] = Form.useForm<{ url: string }>();
	const [detail, setDetail] = useState<StoreDetail | null>(null);
	const [loading, setLoading] = useState(false);
	const [publishing, setPublishing] = useState(false);

	const hasStoreID = store_id !== undefined && store_id !== null && store_id !== "";
	/** store 裸仓库上当前配置的 remote（后端从磁盘实时读取，不落库）。 */
	const remotes: GitRemote[] = detail?.remotes ?? [];

	useEffect(() => {
		if (!hasStoreID) {
			return;
		}

		let alive = true;
		setLoading(true);
		getStoreApi(store_id)
			.then((data) => {
				if (!alive) {
					return;
				}
				setDetail(data);
			})
			.catch((error) => {
				if (alive) {
					message.error(getErrorText(error, "Load store failed"));
				}
			})
			.finally(() => {
				if (alive) {
					setLoading(false);
				}
			});

		return () => {
			alive = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store_id]);

	const publish = async () => {
		if (!hasStoreID) {
			message.error("store_id is required");
			return;
		}

		let values: { url: string };
		try {
			values = await form.validateFields();
		} catch {
			// 表单校验失败：antd 已在字段下方给出提示，这里不再重复弹 toast。
			return;
		}

		setPublishing(true);
		try {
			const resp = await publishStoreRemoteApi(store_id, values.url);
			// 后端返回写入后的完整 remote 列表，直接用它刷新展示。
			setDetail((prev) => (prev ? { ...prev, remotes: resp.remotes ?? prev.remotes } : prev));
			if (resp.published) {
				message.success(`Published to ${resp.url}`);
			} else if (resp.remote_added) {
				// 只写了 remote 配置：如实告知，避免误以为已经推送到 github/gitee。
				message.warning(`Remote "${resp.remote}" added. Pushing to github/gitee is not implemented yet.`);
			} else {
				message.warning(`Remote "${resp.remote}" already configured; skipping add. Pushing is not implemented yet.`);
			}
			onOk?.(resp);
			close?.();
		} catch (error) {
			message.error(getErrorText(error, "Publish to remote failed"));
		} finally {
			setPublishing(false);
		}
	};

	return (
		<Spin spinning={loading}>
			<Alert
				type="info"
				showIcon
				style={{ marginBottom: 16 }}
				message="Publish store to remote"
				description="The url below is added as a git remote of the store repository (a bare repo). Pushing the store to GitHub/Gitee is not implemented yet."
			/>

			<Form form={form} layout="vertical">
				<Form.Item
					label="Remote URL"
					name="url"
					rules={[{ required: true, message: "Please input the remote repository url" }]}
				>
					<Input placeholder="https://github.com/owner/repo.git" allowClear />
				</Form.Item>
			</Form>

			{remotes.length > 0 ? (
				<div style={{ marginTop: 8 }}>
					<Typography.Text type="secondary">
						Remotes configured in the store repository ({remotes.length})
					</Typography.Text>
					<Space direction="vertical" size={4} style={{ width: "100%", marginTop: 8 }}>
						{remotes.map((remote) => (
							<div key={remote.name}>
								<Tag color="blue" style={{ marginInlineEnd: 8 }}>
									{remote.name}
								</Tag>
								{remote.urls.map((url) => {
									const webURL = toWebURL(url);
									return (
										<span key={url}>
											<Tooltip title="Click to fill in the url above">
												<Typography.Link
													onClick={() => form.setFieldValue("url", url)}
													style={{ marginInlineEnd: 4, wordBreak: "break-all" }}
												>
													{url}
												</Typography.Link>
											</Tooltip>
											{webURL && (
												<Tooltip title={webURL}>
													<Button
														type="text"
														size="small"
														icon={<LinkOutlined />}
														onClick={() => window.open(webURL, "_blank")}
													/>
												</Tooltip>
											)}
										</span>
									);
								})}
							</div>
						))}
					</Space>
				</div>
			) : (
				<Typography.Text type="secondary">
					No remote configured in the store repository yet. Add one above to publish to multiple targets (e.g. GitHub + Gitee).
				</Typography.Text>
			)}

			<Space style={{ width: "100%", justifyContent: "flex-end", marginTop: 24 }}>
				<Button
					onClick={() => {
						onCancel?.();
						close?.();
					}}
				>
					Cancel
				</Button>
				<Button color="cyan" variant="solid" loading={publishing} onClick={publish}>
					Publish
				</Button>
			</Space>
		</Spin>
	);
};

export default PublishStoreRemote;
import { FC, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, Descriptions, Empty, Flex, Skeleton, Tag, Tooltip, Typography } from "antd";
import { FileTextOutlined, InfoCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import PanelLayout from "@/components/common/panel-layout";
import { ParamsPanelDock, ParamsPanelLayout } from "@/components/edit-params/params-panel";
import FilePreviewPanel from "@/components/file-view/file-preview-panel";
import type { FilePreviewResponse, PreviewFileInfo } from "@/api/sheet";

const formatBytes = (size?: number) => {
	if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
		return "-";
	}
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = size;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

/**
 * 文件查看详情页：`/dataset-file/:id`（:id 为 go_file 主键）。
 *
 * 采用统一的 `ParamsPanelLayout`：左侧是文件预览（表格 / 文本 / 不可预览提示），
 * 右侧停靠面板展示文件元信息。预览内容完全由前端解析后端返回的原始文本。
 *
 * 主区标题栏使用统一的 `PanelLayout`（固定高度 `--sharp-head-height`），
 * 与工作流 / 脚本等路由页头部保持同高，不再由预览组件自绘更高一截的工具栏。
 *
 * 视图注册为 `filePreview`，Agent 会话页右侧标签、`invoke.filePreview` 弹窗
 * 都直接复用本页面：这些场景没有路由参数，id 由 `file_id` prop 传入。
 */
export type FileViewPageProps = {
	/** go_file 主键 id（标签 / 弹窗视图用 prop 传入，路由页仍从 URL 取）。 */
	file_id?: string;
};

const FileViewPage: FC<FileViewPageProps> = ({ file_id }) => {
	const params = useParams<{ id: string }>();
	// 路由页取 URL 参数，标签 / 弹窗视图取 props。
	const id = file_id ?? params.id;
	const navigate = useNavigate();
	const [fileMeta, setFileMeta] = useState<PreviewFileInfo>();
	const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);
	// 默认收起文件详情：标签视图本来就窄，需要时点标题栏的 Info 按钮展开。
	const [infoOpen, setInfoOpen] = useState(false);

	// 切换文件时先清空上一个文件的元信息，避免侧栏短暂显示旧数据。
	useEffect(() => {
		setFileMeta(undefined);
		setPreview(null);
	}, [id]);

	return (
		<ParamsPanelLayout
			open={infoOpen && Boolean(id)}
			side="right"
			panel={
				<ParamsPanelDock
					side="right"
					title="File Info"
					onClose={() => setInfoOpen(false)}
					storageKey="fileViewInfoPanelWidth"
				>
					{fileMeta ? (
						<Descriptions column={1} size="small" bordered>
							<Descriptions.Item label="Name">{fileMeta.file_name || "-"}</Descriptions.Item>
							<Descriptions.Item label="Format">{fileMeta.format || "-"}</Descriptions.Item>
							<Descriptions.Item label="Size">{formatBytes(fileMeta.size)}</Descriptions.Item>
							<Descriptions.Item label="Path">
								<span style={{ wordBreak: "break-all" }}>{fileMeta.path || "-"}</span>
							</Descriptions.Item>
							<Descriptions.Item label="MD5">
								<span style={{ wordBreak: "break-all" }}>{fileMeta.md5 || "-"}</span>
							</Descriptions.Item>
							<Descriptions.Item label="Description">
								{fileMeta.description || "-"}
							</Descriptions.Item>
						</Descriptions>
					) : (
						<Skeleton active paragraph={{ rows: 6 }} />
					)}
				</ParamsPanelDock>
			}
		>
			{id ? (
				<PanelLayout
					title={
						<>
							<FileTextOutlined />
							<Typography.Text strong ellipsis style={{ maxWidth: 480 }}>
								{fileMeta?.file_name || id}
							</Typography.Text>
							{preview?.format || fileMeta?.format ? (
								<Tag color="cyan">{preview?.format || fileMeta?.format}</Tag>
							) : null}
							{preview?.truncated ? <Tag color="orange">truncated</Tag> : null}
						</>
					}
					extra={
						<>
							<Tooltip title={infoOpen ? "Hide file info" : "Show file info"}>
								<Button
									size="small"
									icon={<InfoCircleOutlined />}
									type={infoOpen ? "primary" : "default"}
									onClick={() => setInfoOpen((prev) => !prev)}
								>
									Info
								</Button>
							</Tooltip>
							<Tooltip title="Reload">
								<Button
									size="small"
									icon={<ReloadOutlined />}
									loading={previewLoading}
									onClick={() => setReloadKey((key) => key + 1)}
								/>
							</Tooltip>
						</>
					}
					/* 标题栏负责头部，预览组件只渲染内容区，避免出现两层头。 */
					bodyStyle={{ padding: 0, overflow: "hidden" }}
				>
					<FilePreviewPanel
						fileId={id}
						showHeader={false}
						reloadKey={reloadKey}
						onFileLoaded={setFileMeta}
						onPreviewLoaded={setPreview}
						onLoadingChange={setPreviewLoading}
					/>
				</PanelLayout>
			) : (
				<Flex align="center" justify="center" style={{ height: "100%" }}>
					<Empty description="Missing file id">
						<Button onClick={() => navigate(-1)}>Back</Button>
					</Empty>
				</Flex>
			)}
		</ParamsPanelLayout>
	);
};

export default FileViewPage;

// src/components/common/component-image.tsx
// 组件封面（script / workflow 的 img 列）的显示与上传，供多个表单/卡片复用。

import { PlusOutlined } from "@ant-design/icons";
import { Upload } from "antd";
import type { UploadFile } from "antd";
import type { CSSProperties, FC } from "react";
import { useEffect, useState } from "react";
import { http } from "@/api/client/http";
import { useComponentImageUrl } from "@/hooks/useComponentImageUrl";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { componentImageApiUrl, type ComponentImageKind } from "@/utils/component-image";

const ACCEPT_IMAGE = "image/png,image/jpeg,image/webp,image/gif";

/**
 * 组件封面图片。
 * 走 http（带 Authorization header）拉 blob 后再给 `<img>`，所以不受 Cookie/跨域限制。
 */
export const ComponentImage: FC<{
	kind: ComponentImageKind;
	/** 组件 int64 主键 */
	id?: number | string | null;
	/** DB img 列（纯文件名，或历史完整路径） */
	img?: string | null;
	alt?: string;
	style?: CSSProperties;
	className?: string;
}> = ({ kind, id, img, alt, style, className }) => {
	const url = useComponentImageUrl(kind, id, img);
	return <img src={url} alt={alt} style={style} className={className} />;
};

export type ComponentImageUploadProps = {
	/** 区分 script（pipeline_components）/ workflow（pipeline_components_relation） */
	kind: ComponentImageKind;
	/** 组件 int64 主键；没有主键（尚未保存）时不渲染上传入口 */
	id?: number | string | null;
	/** 受控值：DB img 列，只保存纯文件名 image.<ext> */
	value?: string;
	onChange?: (value?: string) => void;
	label?: string;
	disabled?: boolean;
};

/**
 * 组件封面上传。
 *
 * 上传用 `http.post(url, FormData)`（而不是 antd Upload 的 action 属性），
 * 这样会自动复用 axios 实例的请求拦截器 => 带上 `Authorization: Bearer <token>`；
 * 表单字段名固定为 `file`，与后端 `GET/POST /api/v1/{kind}/{id}/image` 约定一致。
 */
export const ComponentImageUpload: FC<ComponentImageUploadProps> = ({
	kind,
	id,
	value,
	onChange,
	label = "Upload",
	disabled,
}) => {
	const message = useGlobalMessage();
	const [reloadKey, setReloadKey] = useState(0);
	const [uploading, setUploading] = useState(false);
	const [fileList, setFileList] = useState<UploadFile[]>([]);
	// 文件名固定（image.<ext>），覆盖上传后 URL 不变，用 reloadKey 强制重新拉取
	const previewUrl = useComponentImageUrl(kind, id, value, reloadKey);

	// 预览地址就绪（或刷新）后，用「已上传」的条目替换掉 antd 临时的上传中条目
	useEffect(() => {
		setFileList(
			previewUrl
				? [
						{
							uid: "-1",
							name: value || `${kind}-cover`,
							status: "done",
							url: previewUrl,
						},
					]
				: [],
		);
	}, [previewUrl, value, kind]);

	if (id === undefined || id === null || id === "") {
		return null;
	}

	return (
		<Upload
			accept={ACCEPT_IMAGE}
			disabled={disabled || uploading}
			fileList={fileList}
			listType="picture-card"
			showUploadList={{ showPreviewIcon: true, showRemoveIcon: false }}
			// 只保留当前选中的一张，让上传中的状态立即可见
			onChange={({ fileList: list }) => setFileList(list.slice(-1))}
			customRequest={({ file, onSuccess, onError, onProgress }) => {
				const formData = new FormData();
				formData.append("file", file as File);

				setUploading(true);
				http
					.post(componentImageApiUrl(kind, id), formData, {
						// 覆盖 axios 实例默认的 application/json；
						// 浏览器会自动补上 multipart boundary
						headers: { "Content-Type": "multipart/form-data" },
						onUploadProgress: (event) => {
							if (event.total) {
								onProgress?.({ percent: Math.round((event.loaded / event.total) * 100) });
							}
						},
					})
					.then((resp) => {
						onSuccess?.(resp.data);
						// 表单里只保存文件名（后端 Img 列语义）
						onChange?.(resp.data?.img);
						setReloadKey((key) => key + 1);
						message.success("Upload success!");
					})
					.catch((error) => {
						onError?.(error as Error);
						message.error(
							error?.response?.data?.detail ?? error?.message ?? "Upload failed!"
						);
					})
					.finally(() => setUploading(false));
			}}
		>
			<button type="button" style={{ border: 0, background: "none", cursor: "pointer" }}>
				<PlusOutlined />
				<div style={{ marginTop: 8 }}>{label}</div>
			</button>
		</Upload>
	);
};

export default ComponentImageUpload;

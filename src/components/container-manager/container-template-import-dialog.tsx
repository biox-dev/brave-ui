import { FC, useState } from "react";
import { Button, Flex, Input, Typography, message } from "antd";
import type {
    ContainerTemplateBundleItem,
    ContainerTemplateDefinitionItem,
    ContainerTemplateSpecItem,
} from "@/api/container";
import { importContainerTemplateApi } from "@/api/container";

const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null) {
        const maybeResponse = (error as { response?: { data?: { message?: string; error?: string } } }).response;
        const msg = maybeResponse?.data?.message || maybeResponse?.data?.error;
        if (msg) {
            return msg;
        }
    }
    return fallback;
};

/** 后端用 string 序列化 int64；导出文件里可能是数字，这里统一转成字符串。 */
const toIdString = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
};

/** 给数组条目的 id 字段做统一规整（id 是实体间唯一的引用键，必须保留）。 */
function normalizeIds<T>(items: unknown): T[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
        const record: Record<string, unknown> = { ...(item as Record<string, unknown>) };
        if (record.id !== undefined) {
            record.id = toIdString(record.id);
        }
        return record as T;
    });
}

/**
 * 校验并规整导入格式 { container_template_specs, container_template_definitions }：
 * - 两个字段都可缺省，但不能同时为空；
 * - 每层的 id 统一转成字符串（id 是绑定行 ↔ 运行配置之间唯一的引用键）。
 */
const normalizePayload = (raw: unknown): ContainerTemplateBundleItem => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid JSON. Please paste a valid container template export.");
    }
    const obj = raw as Record<string, unknown>;

    const payload: ContainerTemplateBundleItem = {
        container_template_specs: normalizeIds<ContainerTemplateSpecItem>(obj.container_template_specs),
        container_template_definitions:
            normalizeIds<ContainerTemplateDefinitionItem>(obj.container_template_definitions),
    };

    if (
        payload.container_template_specs.length === 0 &&
        payload.container_template_definitions.length === 0
    ) {
        throw new Error(
            "Nothing to import. Expected container_template_specs / container_template_definitions."
        );
    }

    return payload;
};

export interface ContainerTemplateImportDialogProps {
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerTemplateBundleItem) => void;
    onCancel?: () => void;
    // close is injected by UIContainer
    close?: () => void;
}

const ContainerTemplateImportDialog: FC<any> = ({
    onOk,
    onCancel,
    close,
}) => {
    const [messageApi, contextHolder] = message.useMessage();
    const [json, setJson] = useState("");
    const [importing, setImporting] = useState(false);

    const handleImport = async () => {
        const trimmed = json.trim();
        if (!trimmed) {
            messageApi.warning("Please paste the container template JSON");
            return;
        }

        let payload: ContainerTemplateBundleItem;
        try {
            payload = normalizePayload(JSON.parse(trimmed));
        } catch (error) {
            messageApi.error(getErrorMessage(error, "Failed to parse container template JSON"));
            return;
        }

        setImporting(true);
        try {
            const resp = await importContainerTemplateApi(payload);
            messageApi.success("Container template imported successfully");
            onOk?.(resp.data);
            close?.();
        } catch (error) {
            messageApi.error(getErrorMessage(error, "Failed to import container template"));
            setImporting(false);
        }
    };

    const handleCancel = () => {
        onCancel?.();
        close?.();
    };

    return (
        <div>
            {contextHolder}
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                Paste an exported container template JSON. The format is the same flat structure used by
                workflow / script exports:{" "}
                <Typography.Text code>container_template_specs</Typography.Text> and{" "}
                <Typography.Text code>container_template_definitions</Typography.Text>. Records are upserted by{" "}
                <Typography.Text code>id</Typography.Text>.
            </Typography.Paragraph>
            <Input.TextArea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={14}
                placeholder={`{
  "container_template_specs": [ { "id": "...", "name": "...", "command": "", "port": 8787, ... } ],
  "container_template_definitions": [ { "id": "...", "spec_id": "...", "image_name": "docker.io/rocker/rstudio:4.4", "pull_policy": "IfNotPresent", "display_name": "", "is_default": false } ]
}`}
                style={{ fontFamily: "monospace", fontSize: 12 }}
            />
            <Flex justify="end" gap="small" style={{ marginTop: 12 }}>
                <Button onClick={handleCancel} disabled={importing}>
                    Cancel
                </Button>
                <Button type="primary" loading={importing} onClick={handleImport}>
                    Import
                </Button>
            </Flex>
        </div>
    );
};

export default ContainerTemplateImportDialog;

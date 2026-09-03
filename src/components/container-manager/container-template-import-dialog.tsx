import { FC, useState } from "react";
import { Button, Flex, Input, Typography, message } from "antd";
import type { ContainerTemplateExportItem } from "@/api/container";
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

export interface ContainerTemplateImportDialogProps {
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerTemplateExportItem) => void;
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

        let payload: ContainerTemplateExportItem;
        try {
            payload = JSON.parse(trimmed) as ContainerTemplateExportItem;
        } catch {
            messageApi.error("Invalid JSON. Please paste a valid container template export.");
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
                Paste the exported container template JSON below.
            </Typography.Paragraph>
            <Input.TextArea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={12}
                placeholder='{ "name": "...", "image": { ... }, ... }'
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

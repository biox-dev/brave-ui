import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Select, Button, Flex, App } from "antd";
import type { ContainerImageItem } from "@/api/container";
import { createContainerImageApi, updateContainerImageApi } from "@/api/container";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

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

export interface ContainerImageFormProps {
    // When editing, pass the existing item
    item?: ContainerImageItem;
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerImageItem) => void;
    onCancel?: () => void;
    // close is injected by UIContainer
    close?: () => void;
}

const ContainerImageForm = ({
    item,
    onOk,
    onCancel,
    close,
}: ContainerImageFormProps) => {
    const [form] = Form.useForm();
    const messageApi = useGlobalMessage();
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(item?.id);

    useEffect(() => {
        if (isEdit && item) {
            form.setFieldsValue(item);
        } else {
            form.resetFields();
        }
    }, [item, isEdit, form]);

    const buildPayload = (values: Record<string, unknown>) => {
        // Build payload: for update, only include id + non-nil/non-empty fields
        const payload: Record<string, unknown> = {};

        if (isEdit) {
            payload.id = item!.id;
        }

        for (const [key, val] of Object.entries(values)) {
            // Skip undefined, null, or empty string (do not send nil values)
            if (val === undefined || val === null || val === "") {
                continue;
            }
            // Skip zero values for optional numeric fields when not explicitly set
            if (key === "size" && (val === 0 || val === undefined)) {
                continue;
            }
            payload[key] = val;
        }

        return payload;
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            const payload = buildPayload(values);

            if (isEdit) {
                await updateContainerImageApi(payload as unknown as ContainerImageItem & { id: string });
                messageApi.success("Container image updated successfully");
                onOk?.(item!);
            } else {
                const created = await createContainerImageApi(payload);
                messageApi.success("Container image created successfully");
                onOk?.(created.data);
            }
        } catch (error) {
            if (error && typeof error === "object" && "errorFields" in error) {
                // Form validation error — let antd show field errors
                setSaving(false);
                return;
            }
            messageApi.error(getErrorMessage(error, "Failed to save container image"));
            setSaving(false);
        }
    };

    const handleCancel = () => {
        onCancel?.();
        close?.();
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={{
                pull_policy: "IfNotPresent",
                status: "pending",
            }}
        >
            <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter the image name" }]}
            >
                <Input placeholder="e.g. rocker/rstudio" />
            </Form.Item>
            <Form.Item name="library_version" label="Library Version">
                <Input placeholder="e.g. R 4.4 / Python 3.11" />
            </Form.Item>
            <Form.Item
                name="full_name"
                label="Full Name"
                rules={[{ required: true, message: "Please enter the full image name" }]}
            >
                <Input placeholder="e.g. docker.io/rocker/rstudio:4.4" />
            </Form.Item>



            <Form.Item
                initialValue={"registry.cn-hangzhou.aliyuncs.com"}
                name="registry"
                label="Registry"
                rules={[{ required: true, message: "Please enter the registry" }]}
            >
                <Input placeholder="e.g. docker.io" />
            </Form.Item>

            <Form.Item name="namespace" label="Namespace" initialValue="wybioinfo">
                <Input placeholder="e.g. rocker" />
            </Form.Item>


            <Form.Item name="digest" label="Digest">
                <Input placeholder="Image digest hash" />
            </Form.Item>
            <Form.Item
                name="tag"
                label="Tag"
                rules={[{ required: true, message: "Please enter the image tag" }]}
            >
                <Input placeholder="e.g. 4.4" />
            </Form.Item>


            <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} placeholder="Image description" />
            </Form.Item>

            <Form.Item name="size" label="Size (bytes)">
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder="Image size in bytes"
                    min={0}
                />
            </Form.Item>

            {/* <Form.Item name="status" label="Status">
                <Select
                    options={[
                        { label: "Pending", value: "pending" },
                        { label: "Pulling", value: "pulling" },
                        { label: "Ready", value: "ready" },
                        { label: "Failed", value: "failed" },
                        { label: "Deleted", value: "deleted" },
                        { label: "Disabled", value: "disabled" },
                    ]}
                />
            </Form.Item> */}

            <Form.Item name="pull_policy" label="Pull Policy">
                <Select
                    options={[
                        { label: "Always", value: "Always" },
                        { label: "IfNotPresent", value: "IfNotPresent" },
                        { label: "Never", value: "Never" },
                    ]}
                />
            </Form.Item>

            <Flex justify="end" gap="small" style={{ marginTop: 16 }}>
                <Button onClick={handleCancel} disabled={saving}>
                    Cancel
                </Button>
                <Button type="primary" loading={saving} onClick={handleSubmit}>
                    {isEdit ? "Update" : "Create"}
                </Button>
            </Flex>
        </Form>
    );
};

export default ContainerImageForm;

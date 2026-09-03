import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Select, Button, Flex, Space, Card, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ContainerTemplateItem } from "@/api/container";
import { createContainerTemplateApi, updateContainerTemplateApi } from "@/api/container";
import { invoke } from "@/core/ui-system/invokeV2";
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

const { Text } = Typography;

/** Convert Record<string,string> to Form.List entries */
const envToEntries = (env: Record<string, unknown> | null | undefined) => {
    if (!env || typeof env !== "object") return [];
    return Object.entries(env).map(([key, value]) => ({ key, value: String(value ?? "") }));
};

/** Convert Form.List entries to Record<string,string> */
const entriesToEnv = (entries: { key: string; value: string }[]) => {
    const env: Record<string, string> = {};
    for (const { key, value } of entries) {
        if (key.trim()) {
            env[key.trim()] = value;
        }
    }
    return env;
};

export interface ContainerTemplateFormProps {
    // When editing, pass the existing item
    item?: ContainerTemplateItem;
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerTemplateItem) => void;
    onCancel?: () => void;
    // close is injected by UIContainer
    close?: () => void;
}

const ContainerTemplateForm = ({
    item,
    onOk,
    onCancel,
    close,
}: ContainerTemplateFormProps) => {
    const [form] = Form.useForm();
    const messageApi = useGlobalMessage();
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(item?.id);

    useEffect(() => {
        if (isEdit && item) {
            form.setFieldsValue({
                ...item,
                env: envToEntries(item.env as Record<string, unknown> | null),
                mounts: item.mounts && Array.isArray(item.mounts) ? item.mounts : [],
            });
        } else {
            form.resetFields();
        }
    }, [item, isEdit, form]);

    const buildPayload = (values: Record<string, unknown>) => {
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
            if ((key === "cpu" || key === "memory" || key === "port") && val === 0) {
                continue;
            }
            // Convert env entries array to object
            if (key === "env" && Array.isArray(val)) {
                const envObj = entriesToEnv(val as { key: string; value: string }[]);
                if (Object.keys(envObj).length > 0) {
                    payload[key] = envObj;
                }
                continue;
            }
            // Keep mounts as-is (already an array of objects)
            if (key === "mounts" && Array.isArray(val)) {
                const filtered = (val as { source: string; target: string; mode: string }[]).filter(
                    (m) => m.source || m.target
                );
                if (filtered.length > 0) {
                    payload[key] = filtered;
                }
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
                await updateContainerTemplateApi(payload as unknown as ContainerTemplateItem & { id: string });
                messageApi.success("Container template updated successfully");
                onOk?.(item!);
            } else {
                const created = await createContainerTemplateApi(payload);
                messageApi.success("Container template created successfully");
                onOk?.(created.data);
            }
        } catch (error) {
            if (error && typeof error === "object" && "errorFields" in error) {
                setSaving(false);
                return;
            }
            messageApi.error(getErrorMessage(error, "Failed to save container template"));
            setSaving(false);
        }
    };

    const handleCancel = () => {
        onCancel?.();
        close?.();
    };

    const handleSelectImage = async () => {
        try {
            const selected = await invoke.containerImagePage.openAsync(
                {},
                { title: "Select Container Image", width: "80%", footer: false }
            );
            if (selected?.id) {
                form.setFieldsValue({
                    image_id: selected.id,
                    image_name: selected.full_name || selected.name,
                });
            }
        } catch {
            // User cancelled selection
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={{
                type: "app",
                port: 8787,
                cpu: 0,
                memory: 0,
            }}
        >
            <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter the template name" }]}
            >
                <Input placeholder="e.g. RStudio Server" />
            </Form.Item>

            {/* <Form.Item
                name="type"
                label="Type"
                rules={[{ required: true, message: "Please select the template type" }]}
            >
                <Select
                    options={[
                        { label: "Workflow", value: "workflow" },
                        { label: "App", value: "app" },
                        { label: "Service", value: "service" },
                    ]}
                />
            </Form.Item> */}

            <Form.Item
                name="image_id"
                label="Image"
                rules={[{ required: true, message: "Please select a container image" }]}
            >
                <Input
                    readOnly
                    placeholder="Click to select container image"
                    onClick={handleSelectImage}
                    style={{ cursor: "pointer" }}
                />
            </Form.Item>

            <Form.Item name="app_type" label="App Type">
                <Input placeholder="e.g. rstudio, jupyter, vscode" />
            </Form.Item>
            
            <Form.Item name="image_name" hidden>
                <Input />
            </Form.Item>

            <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} placeholder="Template description" />
            </Form.Item>

            <Form.Item name="command" label="Command">
                <Input.TextArea rows={2} placeholder="Container command" />
            </Form.Item>

            <Form.Item name="work_dir" label="Work Directory">
                <Input placeholder="e.g. /home/rstudio" />
            </Form.Item>


            <Form.Item name="port" label="Port">
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder="Exposed port"
                    min={0}
                    max={65535}
                />
            </Form.Item>

            <Form.Item name="cpu" label="CPU (cores)">
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder="CPU cores"
                    min={0}
                    step={0.1}
                />
            </Form.Item>

            <Form.Item name="memory" label="Memory (bytes)">
                <InputNumber
                    style={{ width: "100%" }}
                    placeholder="Memory limit in bytes"
                    min={0}
                />
            </Form.Item>

            {/* Environment Variables */}
            <Card
                size="small"
                title={<Text strong>Environment Variables</Text>}
                style={{ marginBottom: 16 }}
            >
                <Form.List name="env">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...rest }) => (
                                <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                                    <Form.Item {...rest} name={[name, "key"]} rules={[{ required: true, message: "Key required" }]}>
                                        <Input placeholder="Key (e.g. NB_GID)" style={{ width: 180 }} />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "value"]} rules={[{ required: true, message: "Value required" }]}>
                                        <Input placeholder="Value (e.g. $DOCKER_GID)" style={{ width: 220 }} />
                                    </Form.Item>
                                    <DeleteOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f", cursor: "pointer" }} />
                                </Space>
                            ))}
                            <Button type="dashed" onClick={() => add({ key: "", value: "" })} block icon={<PlusOutlined />}>
                                Add Env
                            </Button>
                        </>
                    )}
                </Form.List>
            </Card>

            {/* Mounts */}
            <Card
                size="small"
                title={<Text strong>Mounts</Text>}
                style={{ marginBottom: 16 }}
            >
                <Form.List name="mounts">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...rest }) => (
                                <Space key={key} style={{ display: "flex", marginBottom: 8, flexWrap: "wrap" }} align="baseline">
                                    <Form.Item {...rest} name={[name, "source"]} rules={[{ required: true, message: "Source required" }]}>
                                        <Input placeholder="Source (e.g. $R_PROFILE)" style={{ width: 180 }} />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "target"]} rules={[{ required: true, message: "Target required" }]}>
                                        <Input placeholder="Target (e.g. /home/rstudio/.Rprofile)" style={{ width: 220 }} />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "mode"]} initialValue="rw">
                                        <Select style={{ width: 100 }}
                                            options={[
                                                { label: "rw", value: "rw" },
                                                { label: "ro", value: "ro" },
                                            ]}
                                        />
                                    </Form.Item>
                                    <DeleteOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f", cursor: "pointer" }} />
                                </Space>
                            ))}
                            <Button type="dashed" onClick={() => add({ source: "", target: "", mode: "rw" })} block icon={<PlusOutlined />}>
                                Add Mount
                            </Button>
                        </>
                    )}
                </Form.List>
            </Card>

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

export default ContainerTemplateForm;

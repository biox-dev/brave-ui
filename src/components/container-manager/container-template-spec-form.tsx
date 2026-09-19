import { useEffect, useState } from "react";
import { Form, Input, InputNumber, Select, Switch, Button, Flex, Space, Card, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ContainerTemplateSpecItem } from "@/api/container";
import { createContainerTemplateSpecApi, updateContainerTemplateSpecApi } from "@/api/container";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

const { Text } = Typography;

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

/** Record<string,string> -> Form.List entries */
const envToEntries = (env: Record<string, unknown> | null | undefined) => {
    if (!env || typeof env !== "object") return [];
    return Object.entries(env).map(([key, value]) => ({ key, value: String(value ?? "") }));
};

/** Form.List entries -> Record<string,string> */
const entriesToEnv = (entries: { key: string; value: string }[]) => {
    const env: Record<string, string> = {};
    for (const { key, value } of entries) {
        if (key.trim()) {
            env[key.trim()] = value;
        }
    }
    return env;
};

/** JSON object -> pretty text */
const jsonToText = (value: Record<string, unknown> | null | undefined) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    return Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : "";
};

/** pretty text -> JSON object (invalid text keeps the raw string for the backend to reject) */
const textToJson = (text: string | undefined) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return undefined;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // fall through
    }
    return trimmed;
};

export interface ContainerTemplateSpecFormProps {
    // When editing, pass the existing spec
    item?: ContainerTemplateSpecItem;
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerTemplateSpecItem) => void;
    onCancel?: () => void;
    // close is injected by UIContainer
    close?: () => void;
}

/**
 * 共享运行配置（ContainerTemplateSpec）表单：只维护“怎么跑”的字段，不含镜像。
 * 镜像通过 ContainerTemplateDefinition 绑定行关联，见 container-template-form。
 */
const ContainerTemplateSpecForm = ({
    item,
    onOk,
    onCancel,
    close,
}: ContainerTemplateSpecFormProps) => {
    const [form] = Form.useForm();
    const messageApi = useGlobalMessage();
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(item?.id);

    useEffect(() => {
        if (isEdit && item) {
            form.setFieldsValue({
                ...item,
                env: envToEntries(item.env),
                mounts: item.mounts && Array.isArray(item.mounts) ? item.mounts : [],
                scheduling_constraint: jsonToText(item.scheduling_constraint),
                labels: jsonToText(item.labels),
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
            if (val === undefined || val === null || val === "") {
                continue;
            }
            if ((key === "cpu" || key === "memory" || key === "port") && val === 0) {
                continue;
            }
            if (key === "env" && Array.isArray(val)) {
                const envObj = entriesToEnv(val as { key: string; value: string }[]);
                if (Object.keys(envObj).length > 0) {
                    payload[key] = envObj;
                }
                continue;
            }
            if (key === "mounts" && Array.isArray(val)) {
                const filtered = (val as { source: string; target: string }[]).filter((m) => m.source || m.target);
                if (filtered.length > 0) {
                    payload[key] = filtered;
                }
                continue;
            }
            if (key === "scheduling_constraint" || key === "labels") {
                const parsed = textToJson(val as string);
                if (parsed !== undefined) {
                    payload[key] = parsed;
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
                const updated = await updateContainerTemplateSpecApi(
                    payload as unknown as Partial<ContainerTemplateSpecItem> & { id: string }
                );
                messageApi.success("Container template spec updated successfully");
                onOk?.(updated.data);
            } else {
                const created = await createContainerTemplateSpecApi(payload);
                messageApi.success("Container template spec created successfully");
                onOk?.(created.data);
            }
            close?.();
        } catch (error) {
            if (error && typeof error === "object" && "errorFields" in error) {
                setSaving(false);
                return;
            }
            messageApi.error(getErrorMessage(error, "Failed to save container template spec"));
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
                port: 8787,
                cpu: 0,
                memory: 0,
                change_uid: false,
            }}
        >
            <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: "Please enter the spec name" }]}
            >
                <Input placeholder="e.g. RStudio Runtime Spec" />
            </Form.Item>

            <Form.Item name="description" label="Description">
                <Input.TextArea rows={2} placeholder="Runtime spec description" />
            </Form.Item>

            <Form.Item name="app_type" label="App Type">
                <Input placeholder="e.g. rstudio, jupyter, vscode" />
            </Form.Item>

            <Form.Item name="command" label="Command">
                <Input.TextArea rows={2} placeholder="Container command" />
            </Form.Item>

            <Form.Item name="work_dir" label="Work Directory">
                <Input placeholder="e.g. /home/rstudio" />
            </Form.Item>

            <Form.Item name="port" label="Port">
                <InputNumber style={{ width: "100%" }} placeholder="Exposed port" min={0} max={65535} />
            </Form.Item>

            <Form.Item name="cpu" label="CPU (cores)">
                <InputNumber style={{ width: "100%" }} placeholder="CPU cores" min={0} step={0.1} />
            </Form.Item>

            <Form.Item name="memory" label="Memory (bytes)">
                <InputNumber style={{ width: "100%" }} placeholder="Memory limit in bytes" min={0} />
            </Form.Item>

            <Form.Item name="change_uid" label="Change UID" valuePropName="checked">
                <Switch />
            </Form.Item>

            {/* Environment Variables */}
            <Card size="small" title={<Text strong>Environment Variables</Text>} style={{ marginBottom: 16 }}>
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
            <Card size="small" title={<Text strong>Mounts</Text>} style={{ marginBottom: 16 }}>
                <Form.List name="mounts">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...rest }) => (
                                <Space key={key} style={{ display: "flex", marginBottom: 8, flexWrap: "wrap" }} align="baseline">
                                    <Form.Item {...rest} name={[name, "type"]} initialValue="file">
                                        <Select
                                            style={{ width: 90 }}
                                            options={[
                                                { label: "file", value: "file" },
                                                { label: "dir", value: "dir" },
                                            ]}
                                        />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "owner"]} initialValue="app_session">
                                        <Select
                                            style={{ width: 140 }}
                                            options={[
                                                { label: "dag_node", value: "dag_node" },
                                                { label: "app_session", value: "app_session" },
                                                { label: "service", value: "service" },
                                            ]}
                                        />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "source"]} rules={[{ required: true, message: "Source required" }]}>
                                        <Input placeholder="Source (e.g. $R_PROFILE)" style={{ width: 180 }} />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "target"]} rules={[{ required: true, message: "Target required" }]}>
                                        <Input placeholder="Target (e.g. /home/rstudio/.Rprofile)" style={{ width: 220 }} />
                                    </Form.Item>
                                    <Form.Item {...rest} name={[name, "mode"]} initialValue="rw">
                                        <Select
                                            style={{ width: 100 }}
                                            options={[
                                                { label: "rw", value: "rw" },
                                                { label: "ro", value: "ro" },
                                            ]}
                                        />
                                    </Form.Item>
                                    <DeleteOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f", cursor: "pointer" }} />
                                </Space>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add({ type: "file", owner: "app_session", source: "", target: "", mode: "rw" })}
                                block
                                icon={<PlusOutlined />}
                            >
                                Add Mount
                            </Button>
                        </>
                    )}
                </Form.List>
            </Card>

            {/* Scheduling constraint / Labels (JSON) */}
            <Card size="small" title={<Text strong>Scheduling Constraint (JSON)</Text>} style={{ marginBottom: 16 }}>
                <Form.Item name="scheduling_constraint" noStyle>
                    <Input.TextArea rows={3} placeholder='{"constraints":[{"type":"node","key":"gpu","operator":"In","values":["true"]}]}' />
                </Form.Item>
            </Card>

            <Card size="small" title={<Text strong>Labels (JSON)</Text>} style={{ marginBottom: 16 }}>
                <Form.Item name="labels" noStyle>
                    <Input.TextArea rows={3} placeholder='{"app":"rstudio"}' />
                </Form.Item>
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

export default ContainerTemplateSpecForm;

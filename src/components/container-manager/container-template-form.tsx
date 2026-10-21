import { useEffect, useState } from "react";
import { Form, Input, Select, Switch, Button, Flex, Space, Typography } from "antd";
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

export interface ContainerTemplateFormProps {
    // When editing, pass the existing item (a ContainerTemplate read model = definition + spec + image)
    item?: ContainerTemplateItem;
    // 从 Spec 列表“Bind Image”进入时预置要复用的运行配置（新增绑定行）。
    initialSpecId?: string;
    initialSpecName?: string;
    // openAsync injects onOk/onCancel into params
    onOk?: (result: ContainerTemplateItem) => void;
    onCancel?: () => void;
    // close is injected by UIContainer
    close?: () => void;
}

/**
 * ContainerTemplateDefinition（运行配置 × 镜像 绑定行）表单。
 * 一条绑定行 = 一个可直接运行的容器模板：对外 ID 即绑定行主键。
 *
 * 本表单只提交绑定行自身的字段：
 *   - spec_id：要复用的共享运行配置（ContainerTemplateSpec）；
 *   - image_name：要运行的完整镜像名；
 *   - pull_policy：镜像拉取策略（Always / IfNotPresent / Never）；
 *   - display_name：该绑定行的展示名（为空时回退到配置名）；
 *   - is_default：是否作为系统唯一默认容器模板。
 *
 * 运行配置的内部字段（命令、资源、端口、环境变量、挂载等）在「Container Template Spec」
 * 页面维护 —— 同一套配置可被多个镜像绑定复用，所以不在这里重复编辑。
 */
const ContainerTemplateForm = ({
    item,
    initialSpecId,
    initialSpecName,
    onOk,
    onCancel,
    close,
}: ContainerTemplateFormProps) => {
    const [form] = Form.useForm();
    const messageApi = useGlobalMessage();
    const [saving, setSaving] = useState(false);
    const isEdit = Boolean(item?.id);

    const specIdValue = Form.useWatch<string | undefined>("spec_id", form);
    const specLabel = Form.useWatch<string | undefined>("spec_label", form);

    useEffect(() => {
        if (isEdit && item) {
            form.setFieldsValue({
                id: item.id,
                spec_id: item.spec_id,
                image_name: item.image_name,
                pull_policy: item.pull_policy || "IfNotPresent",
                // 用绑定行自己的 display_name，而不是 item.name（后者可能是配置名回退值），
                // 否则保存时会把配置名误写成该绑定行的展示名。
                display_name: item.display_name || undefined,
                // 绑定行自身的长描述；与共享运行配置的 description 相互独立。
                definition_description: item.definition_description || undefined,
                is_default: Boolean(item.is_default),
                spec_label: item.spec_id,
            });
            return;
        }

        form.resetFields();
        if (initialSpecId) {
            form.setFieldsValue({
                spec_id: initialSpecId,
                spec_label: initialSpecName || initialSpecId,
            });
        }
    }, [item, isEdit, form, initialSpecId, initialSpecName]);

    /** 只提交绑定行（ContainerTemplateDefinition）的字段，运行配置仅以 id 引用。 */
    const buildPayload = (values: Record<string, unknown>) => {
        const payload: Record<string, unknown> = {
            spec_id: values.spec_id,
            image_name: typeof values.image_name === "string" ? values.image_name.trim() : "",
            pull_policy: values.pull_policy || "IfNotPresent",
            is_default: Boolean(values.is_default),
            display_name: typeof values.display_name === "string" ? values.display_name.trim() : "",
            definition_description:
                typeof values.definition_description === "string"
                    ? values.definition_description.trim()
                    : "",
        };
        if (isEdit) {
            payload.id = item!.id;
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

    // 选择要复用的运行配置（ContainerTemplateSpec）。
    const handleSelectSpec = async () => {
        try {
            const selected = await invoke.containerTemplateSpecPage.openAsync(
                {},
                { title: "Select Container Template Spec", width: "80%", footer: false }
            );
            if (selected?.id) {
                form.setFieldsValue({
                    spec_id: selected.id,
                    spec_label: selected.name || selected.id,
                });
            }
        } catch {
            // User cancelled selection
        }
    };

    return (
        <Form form={form} layout="vertical">
            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                A container template binds one runtime spec (how to run) to one image (what to run).
                Command, resources, ports, env and mounts belong to the spec and can be shared across images.
            </Text>

            <Form.Item
                label="Runtime Spec"
                tooltip="Shared runtime configuration (ContainerTemplateSpec). Its command / resources / env are managed on the Container Template Spec page."
            >
                <Space.Compact style={{ width: "100%" }}>
                    <Form.Item
                        name="spec_id"
                        noStyle
                        rules={[{ required: true, message: "Please select a runtime spec" }]}
                    >
                        <Input
                            readOnly
                            placeholder="Click to select a runtime spec"
                            onClick={handleSelectSpec}
                            style={{ cursor: "pointer" }}
                        />
                    </Form.Item>
                    <Button onClick={handleSelectSpec}>Select Spec</Button>
                </Space.Compact>
            </Form.Item>
            <Form.Item name="spec_label" hidden>
                <Input />
            </Form.Item>
            {specIdValue && (
                <Text type="secondary" style={{ display: "block", marginTop: -12, marginBottom: 12 }}>
                    Spec: {specLabel || specIdValue}
                </Text>
            )}

            <Form.Item
                name="image_name"
                label="Image Name"
                rules={[{ required: true, message: "Please enter the full container image name" }]}
                tooltip="Full image reference including registry and tag, e.g. docker.io/rocker/rstudio:4.4."
            >
                <Input placeholder="e.g. docker.io/rocker/rstudio:4.4" />
            </Form.Item>

            <Form.Item
                name="pull_policy"
                label="Pull Policy"
                tooltip="Always: pull before every run. IfNotPresent: reuse local image when available. Never: only use the local image."
            >
                <Select
                    options={[
                        { label: "Always", value: "Always" },
                        { label: "IfNotPresent", value: "IfNotPresent" },
                        { label: "Never", value: "Never" },
                    ]}
                />
            </Form.Item>

            <Form.Item
                name="display_name"
                label="Display Name"
                tooltip="Overrides the spec name for this binding only. Leave empty to use the spec name."
            >
                <Input placeholder="Optional display name for this image binding" />
            </Form.Item>

            <Form.Item
                name="definition_description"
                label="Description"
                tooltip="Long description of this runnable template (what it is used for). Returned to the agent when the user references @container:<id>."
            >
                <Input.TextArea
                    placeholder="Describe what this runnable template is used for"
                    autoSize={{ minRows: 2, maxRows: 6 }}
                />
            </Form.Item>

            <Form.Item
                name="is_default"
                label="Default Template"
                valuePropName="checked"
                tooltip="Only one template can be default. Scripts created by the agent without an explicit container template use it."
            >
                <Switch />
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

export default ContainerTemplateForm;

import { useEffect, useState } from "react";
import { Form, Input, Select, Button, Flex, Space, Switch, Typography } from "antd";
import type {
    ContainerTemplateDefinitionItem,
    ContainerTemplateItem,
    ContainerTemplateLanguageOption,
} from "@/api/container";
import {
    createContainerTemplateDefinitionApi,
    listContainerTemplateLanguagesApi,
    updateContainerTemplateDefinitionApi,
} from "@/api/container";
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
    onOk?: (result?: ContainerTemplateItem | ContainerTemplateDefinitionItem) => void;
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
 *   - languages：支持的程序语言（R / PYTHON / CONDA），决定注入哪些包目录变量；
 *   - use_shared_dir：包目录是否放在共享目录（<baseDir>/shared/package）；
 *   - name：该绑定行的展示名；
 *   - description：该绑定行自身的描述。
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
    const [languageOptions, setLanguageOptions] = useState<ContainerTemplateLanguageOption[]>([]);
    const isEdit = Boolean(item?.id);

    // 语言选项由后端提供（与 Role 一样是枚举），拉取失败时回退到内置三项目语。
    useEffect(() => {
        let cancelled = false;
        listContainerTemplateLanguagesApi()
            .then((res) => {
                if (!cancelled) {
                    setLanguageOptions(res.data ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLanguageOptions([
                        { label: "R", value: "R" },
                        { label: "Python", value: "PYTHON" },
                        { label: "Conda", value: "CONDA" },
                    ]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const specIdValue = Form.useWatch<string | undefined>("spec_id", form);
    const specLabel = Form.useWatch<string | undefined>("spec_label", form);

    useEffect(() => {
        if (isEdit && item) {
            form.setFieldsValue({
                id: item.id,
                spec_id: item.spec_id,
                image_name: item.image_name,
                pull_policy: item.pull_policy || "IfNotPresent",
                // 绑定行自己的展示名（ContainerTemplateDefinition.Name）。
                name: item.name || undefined,
                // 绑定行自身的描述（ContainerTemplateDefinition.Description）。
                description: item.description || undefined,
                // 支持的程序语言与是否使用共享包目录。
                languages: item.languages || [],
                use_shared_dir: item.use_shared_dir || false,
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
    const buildPayload = (values: Record<string, unknown>): Partial<ContainerTemplateDefinitionItem> => {
        const payload: Partial<ContainerTemplateDefinitionItem> = {
            spec_id: typeof values.spec_id === "string" ? values.spec_id : undefined,
            image_name: typeof values.image_name === "string" ? values.image_name.trim() : "",
            pull_policy: typeof values.pull_policy === "string" ? values.pull_policy : "IfNotPresent",
            name: typeof values.name === "string" ? values.name.trim() : "",
            description: typeof values.description === "string" ? values.description.trim() : "",
            languages: Array.isArray(values.languages) ? (values.languages as string[]) : [],
            use_shared_dir: Boolean(values.use_shared_dir),
        };
        if (isEdit && item?.id) {
            payload.id = item.id;
        }
        return payload;
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            const payload = buildPayload(values);

            if (isEdit) {
                await updateContainerTemplateDefinitionApi(payload as Partial<ContainerTemplateDefinitionItem> & {
                    id: string;
                });
                messageApi.success("Container template updated successfully");
                onOk?.(item!);
            } else {
                const created = await createContainerTemplateDefinitionApi(payload);
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
                name="languages"
                label="Languages"
                tooltip="Package languages this template supports. Each selected language gets its own package directory variable (R_PACKAGE_DIR / PYTHON_PACKAGE_DIR / CONDA_PACKAGE_DIR)."
            >
                <Select
                    mode="multiple"
                    allowClear
                    placeholder="Select supported languages"
                    options={languageOptions.map((option) => ({ label: option.label, value: option.value }))}
                />
            </Form.Item>

            <Form.Item
                name="use_shared_dir"
                label="Shared Package Directory"
                valuePropName="checked"
                tooltip="When enabled, package directories live under <baseDir>/shared/package (shared across projects); otherwise under the project data directory."
            >
                <Switch />
            </Form.Item>

            <Form.Item
                name="name"
                label="Name"
                tooltip="Display name for this template."
            >
                <Input placeholder="Optional display name for this template" />
            </Form.Item>

            <Form.Item
                name="description"
                label="Description"
                tooltip="Long description of this runnable template (what it is used for). Returned to the agent when the user references @container:<id>."
            >
                <Input.TextArea
                    placeholder="Describe what this runnable template is used for"
                    autoSize={{ minRows: 2, maxRows: 6 }}
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

export default ContainerTemplateForm;

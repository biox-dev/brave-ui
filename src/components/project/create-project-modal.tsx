import { Button, Flex, Form, Input } from "antd";
import { FC, useState } from "react";
import { createProjectApi, type ProjectItem } from "@/api/project";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

interface CreateProjectModalProps {
    onOk?: (value?: ProjectItem) => void;
    onCancel?: () => void;
}

interface CreateProjectFormValues {
    project_name: string;
    metadata_form?: string;
    research?: string;
    parameter?: string;
    description?: string;
}

const DEFAULT_METADATA_FORM = '[{"name":"group","label":"group"}]';

const CreateProjectModal: FC<CreateProjectModalProps> = ({ onOk, onCancel }) => {
    const [form] = Form.useForm<CreateProjectFormValues>();
    const [loading, setLoading] = useState(false);

    const handleFinish = async (values: CreateProjectFormValues) => {
        setLoading(true);
        try {
            const resp = await createProjectApi({
                project_name: values.project_name.trim(),
                metadata_form: values.metadata_form ?? DEFAULT_METADATA_FORM,
                research: values.research,
                parameter: values.parameter,
                description: values.description,
            });
            getGlobalMessage()?.success("Project created successfully");
            onOk && onOk(resp.data);
        } catch (error) {
            // API errors are shown globally by the http interceptor.
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form<CreateProjectFormValues>
            form={form}
            layout="vertical"
            initialValues={{ metadata_form: DEFAULT_METADATA_FORM }}
            onFinish={handleFinish}
        >
            <Form.Item
                name="project_name"
                label="Project Name"
                rules={[{ required: true, whitespace: true, message: "Please enter the project name" }]}
            >
                <Input placeholder="Enter project name" autoFocus />
            </Form.Item>
            <Form.Item name="metadata_form" label="Metadata Form">
                <Input.TextArea rows={4} placeholder={DEFAULT_METADATA_FORM} />
            </Form.Item>
            <Form.Item name="research" label="Research">
                <Input.TextArea rows={3} placeholder="Enter research info" />
            </Form.Item>
            <Form.Item name="parameter" label="Parameter">
                <Input.TextArea rows={3} placeholder="Enter parameter info" />
            </Form.Item>
            <Form.Item name="description" label="Description">
                <Input.TextArea rows={3} placeholder="Enter description" />
            </Form.Item>
            <Flex justify="end" gap="small">
                <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                    Create
                </Button>
            </Flex>
        </Form>
    );
};

export default CreateProjectModal;

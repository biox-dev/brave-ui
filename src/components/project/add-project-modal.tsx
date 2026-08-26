import { Button, Flex, Form, Input } from "antd";
import { FC, useState } from "react";
import { addUserProjectApi } from "@/api/project";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

interface AddProjectModalProps {
    onOk?: () => void;
    onCancel?: () => void;
}

interface AddProjectFormValues {
    share_code: string;
}

const AddProjectModal: FC<AddProjectModalProps> = ({ onOk, onCancel }) => {
    const [form] = Form.useForm<AddProjectFormValues>();
    const [loading, setLoading] = useState(false);

    const handleFinish = async (values: AddProjectFormValues) => {
        setLoading(true);
        try {
            await addUserProjectApi({ share_code: values.share_code.trim() });
            getGlobalMessage()?.success("Project added successfully");
            onOk && onOk();
        } catch (error) {
            // API errors are shown globally by the http interceptor.
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form<AddProjectFormValues>
            form={form}
            layout="vertical"
            onFinish={handleFinish}
        >
            <Form.Item
                name="share_code"
                label="Share Code"
                rules={[{ required: true, whitespace: true, message: "Please enter the share code" }]}
            >
                <Input placeholder="Enter share code" autoFocus />
            </Form.Item>
            <Flex justify="end" gap="small">
                <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                    Add
                </Button>
            </Flex>
        </Form>
    );
};

export default AddProjectModal;

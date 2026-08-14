import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { ActionDispatcher } from "@/event-bus/dispatcher";
import { Button, Form, Input, Space } from "antd";
import TextArea from "antd/es/input/TextArea";
import axios from "axios";
import { FC, useEffect, useMemo, useState } from "react";

interface CreateUpdateStoreProps {
    onOk?: (data?: any) => void;
    onCancel?: () => void;
    store_id?: string;
}

const CreateUpdateStore: FC<CreateUpdateStoreProps> = ({ onOk, onCancel, store_id }) => {
    const message = useGlobalMessage();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const isUpdate = useMemo(() => !!store_id, [store_id]);

    const loadStoreDetail = async () => {
        if (!store_id) {
            form.resetFields();
            return;
        }

        setLoading(true);
        try {
            // Reuse the existing list endpoint and locate the selected store.
            const resp = await axios.get(`/find-store-by-id/${store_id}`);
            if (resp.data.publish_urls) {
                resp.data.publish_urls = JSON.stringify(resp.data.publish_urls, null, 2);
            }
            form.setFieldsValue(resp.data);
        } catch (error: any) {
            message.error(error.response?.data?.detail || error.message || "Load store failed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStoreDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store_id]);

    const saveStore = async () => {
        const values = await form.validateFields();
        setLoading(true);
        try {
            // if (isUpdate && store_id) {
            //     await axios.post(`/update-store/${store_id}`, values);
            //     message.success("Updated successfully");
            // } else {
            //     await axios.post(`/create-store`, values);
            //     message.success("Created successfully");
            // }
            if (values.publish_urls) {
                values.publish_urls = JSON.parse(values.publish_urls)
            }
            await axios.post(`/save-store`, {
                ...values,
                store_id: store_id || undefined,
            })

            if (isUpdate) {
                message.success("Updated successfully");
            } else {
                message.success("Created successfully");
            }

            const data = {
                action: "component.invoke",
                payload: {
                    category: "tables",
                    id: "tools-details",
                    method: "reload",
                }
            }

            ActionDispatcher.dispatch(data.action, data.payload);

            onOk?.(true);
        } catch (error: any) {
            message.error(error.response?.data?.detail || error.message || "Save store failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Form form={form} layout="vertical">
                <Form.Item
                    label="URL"
                    name="url"
                    rules={[{ required: true, message: "Please input URL" }]}
                >
                    <Input placeholder="http://github.com/owner/repo" />
                </Form.Item>

                <Form.Item
                    label="Name"
                    name="name"

                >
                    <Input placeholder="Store name" />
                </Form.Item>

                <Form.Item label="Category" name="category">
                    <Input placeholder="Category" />
                </Form.Item>
                <Form.Item label="Version" name="version" >
                    <Input placeholder="Version" disabled />
                </Form.Item>
                <Form.Item label="Update Info" name="update_info">
                    <TextArea placeholder="Update Info" />
                </Form.Item>

                {/* <Form.Item label="Publish URLs" name="publish_urls">
                    <TextArea placeholder="Publish URLs" />
                </Form.Item> */}
            </Form>

            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                <Button onClick={() => onCancel?.()}>Cancel</Button>
                <Button color="cyan" variant="solid" loading={loading} onClick={saveStore}>
                    {isUpdate ? "Update" : "Create"}
                </Button>
            </Space>
        </>
    );
};

export default CreateUpdateStore;
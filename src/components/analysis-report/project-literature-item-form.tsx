import { addLiteratureApi, updateLiteratureApi, type ProjectLiteratureDetailItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { Button, Form, Input, Select, Space } from "antd";
import { FC, useEffect, useMemo } from "react";

type Mode = "create" | "update";

interface ProjectLiteratureItemFormProps {
  mode?: Mode;
  literature?: ProjectLiteratureDetailItem;
  onOk?: (data?: any) => void;
  onCancel?: () => void;
}

const ProjectLiteratureItemForm: FC<ProjectLiteratureItemFormProps> = ({
  mode,
  literature,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();
  const currentMode: Mode = useMemo(() => {
    if (mode) return mode;
    return literature?.id ? "update" : "create";
  }, [mode, literature?.id]);

  useEffect(() => {
    if (currentMode === "update" && literature) {
      form.setFieldsValue({
        title: literature.title,
        content: literature.content || "",
        content_source: literature.content_source || "file",
        filename: literature.filename || "fulltext.md",
      });
      return;
    }

    form.setFieldsValue({
      title: "",
      content: "",
      content_source: "file",
      filename: "fulltext.md",
    });
  }, [currentMode, form, literature]);

  const submit = async () => {
    const values = await form.validateFields();

    if (currentMode === "create") {
      const resp = await addLiteratureApi({
        title: values.title,
        content: values.content || "",
        content_source: values.content_source,
        filename: values.filename,
      });
      message.success("Created successfully");
      onOk?.(resp.data);
      return;
    }

    if (!literature?.id) {
      message.error("Missing literature id");
      return;
    }

    await updateLiteratureApi({
      id: literature.id,
      title: values.title,
      content: values.content || "",
      content_source: values.content_source,
      filename: values.filename,
    });
    message.success("Updated successfully");
    onOk?.(true);
  };

  return (
    <>
      <Form form={form} layout="vertical">
        <Form.Item label="Title" name="title" rules={[{ required: true, message: "Please input title" }]}>
          <Input placeholder="Input literature title" />
        </Form.Item>

        <Form.Item label="Content Source" name="content_source" rules={[{ required: true, message: "Please select content source" }]}>
          <Select
            options={[
              { label: "File", value: "file" },
              { label: "Database", value: "database" },
            ]}
          />
        </Form.Item>

        <Form.Item label="Filename" name="filename" rules={[{ required: true, message: "Please input filename" }]}>
          <Input placeholder="fulltext.md" />
        </Form.Item>

        <Form.Item label="Full Text" name="content">
          <Input.TextArea rows={6} placeholder="Full text content (only persisted for file source)" />
        </Form.Item>
      </Form>

      <Space style={{ width: "100%", justifyContent: "flex-end" }}>
        <Button onClick={() => onCancel?.()}>Cancel</Button>
        <Button color="cyan" variant="solid" onClick={submit}>
          {currentMode === "create" ? "Create" : "Update"}
        </Button>
      </Space>
    </>
  );
};

export default ProjectLiteratureItemForm;

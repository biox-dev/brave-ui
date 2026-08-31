import { updateLiteratureApi } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { Button, Flex, Form } from "antd";
import { FC, useEffect } from "react";
import { MonacoEditor } from "../react-monaco-editor";

const ProjectLiteratureEditor: FC<any> = ({ literature, onSaved }) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();

  useEffect(() => {
    form.setFieldsValue({ content: literature?.content || "" });
  }, [form, literature?.content]);

  const save = async () => {
    if (!literature?.id) {
      message.error("Please select literature item first");
      return;
    }

    const values = await form.validateFields();
    await updateLiteratureApi({
      id: literature.id,
      title: literature.title,
      content: values.content || "",
      content_source: literature.content_source,
      filename: literature.filename,
    });
    message.success("Saved");
    onSaved?.();
  };

  return (
    <div>
      <Flex gap="small" justify="end" style={{ margin: "0.5rem 0" }}>
        <Button size="small" color="cyan" variant="solid" onClick={save}>
          Save Full Text
        </Button>
      </Flex>
      <Form form={form}>
        <Form.Item name="content" noStyle>
          <MonacoEditor />
        </Form.Item>
      </Form>
    </div>
  );
};

export default ProjectLiteratureEditor;

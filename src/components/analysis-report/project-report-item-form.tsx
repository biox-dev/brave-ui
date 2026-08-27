import { addProjectReportApi, updateProjectReportApi, type ProjectReportDetailItem } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { Button, Form, Input, InputNumber, Select, Space } from "antd";
import { FC, useEffect, useMemo } from "react";

type Mode = "create" | "update";

interface ProjectReportItemFormProps {
  mode?: Mode;
  project_id?: string;
  report?: ProjectReportDetailItem;
  onOk?: (data?: any) => void;
  onCancel?: () => void;
}

const ProjectReportItemForm: FC<ProjectReportItemFormProps> = ({
  mode,
  project_id,
  report,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();
  const currentMode: Mode = useMemo(() => {
    if (mode) return mode;
    return report?.id ? "update" : "create";
  }, [mode, report?.id]);

  useEffect(() => {
    if (currentMode === "update" && report) {
      form.setFieldsValue({
        title: report.title,
        sort_order: report.sort_order,
        content_source: report.content_source || "file",
        filename: report.filename || "output.md",
      });
      return;
    }

    form.setFieldsValue({
      title: "",
      sort_order: 0,
      content_source: "file",
      filename: "output.md",
    });
  }, [currentMode, form, report]);

  const submit = async () => {
    const values = await form.validateFields();
    const pid = project_id || report?.project_id;
    if (!pid) {
      message.error("Missing project_id");
      return;
    }

    if (currentMode === "create") {
      const resp = await addProjectReportApi({
        project_id: pid,
        title: values.title,
        sort_order: values.sort_order ?? 0,
        content: "",
        content_source: values.content_source,
        filename: values.filename,
      });
      message.success("Created successfully");
      onOk?.(resp.data);
      return;
    }

    if (!report?.id) {
      message.error("Missing report id");
      return;
    }

    await updateProjectReportApi({
      id: report.id,
      project_id: pid,
      title: values.title,
      sort_order: values.sort_order ?? 0,
      content: report.content || "",
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
          <Input placeholder="Input report title" />
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
          <Input placeholder="output.md" />
        </Form.Item>

        <Form.Item label="Sort Order" name="sort_order" rules={[{ required: true, message: "Please input sort order" }]}>
          <InputNumber style={{ width: "100%" }} />
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

export default ProjectReportItemForm;

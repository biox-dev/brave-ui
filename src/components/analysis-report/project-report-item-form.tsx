import { addProjectReportApi, updateProjectReportApi, type ProjectReportDetail } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { Button, Form, Input, Select, Space } from "antd";
import { FC, useEffect, useMemo } from "react";
import { useQuery } from "react-query";
import { listPlanApi } from "@/api/project";

type Mode = "create" | "update";

interface ProjectReportItemFormProps {
  mode?: Mode;
  report?: ProjectReportDetail;
  onOk?: (data?: any) => void;
  onCancel?: () => void;
}

const ProjectReportItemForm: FC<ProjectReportItemFormProps> = ({
  mode,
  report,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const message = useGlobalMessage();
  // 可选：把报告绑定到某个 agent 计划（撰写时按计划取素材）。
  const { data: plans } = useQuery(["plan-list-form"], async () => (await listPlanApi()).data, {
    enabled: true,
  });
  const currentMode: Mode = useMemo(() => {
    if (mode) return mode;
    return report?.id ? "update" : "create";
  }, [mode, report?.id]);

  useEffect(() => {
    if (currentMode === "update" && report) {
      form.setFieldsValue({ title: report.title, plan_id: report.plan_id });
      return;
    }

    form.setFieldsValue({ title: "", plan_id: undefined });
  }, [currentMode, form, report]);

  const submit = async () => {
    const values = await form.validateFields();

    if (currentMode === "create") {
      // 后端根据当前用户解析激活项目，前端不再传 project_id。
      const resp = await addProjectReportApi({
        title: values.title,
        plan_id: values.plan_id,
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
      title: values.title,
      plan_id: values.plan_id,
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
        <Form.Item label="Source Plan (optional)" name="plan_id">
          <Select
            allowClear
            placeholder="Write the report from a plan"
            options={(plans ?? []).map((plan) => ({ value: plan.id, label: plan.title || plan.id }))}
          />
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

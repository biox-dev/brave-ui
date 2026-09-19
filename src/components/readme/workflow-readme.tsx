import { FC } from "react"
import ReadmeView from "./readme-view"

/**
 * 工作流目录（GetWorkflowFileDir）下 README.md 的查看 / 编辑视图。
 * 作为 workflow-panel 的 Segmented 选项（views）之一，由 ViewResolver 内联渲染。
 * id 兼容 workflow_id / component.id / workflow.id 三种传参写法。
 */
const WorkflowReadme: FC<any> = ({ workflow_id, component, workflow }) => (
	<ReadmeView entity="workflow" id={workflow_id ?? component?.id ?? workflow?.id} />
)

export default WorkflowReadme

import { FC } from "react"
import ReadmeView from "./readme-view"

/**
 * 脚本目录（GetScriptFileDir）下 README.md 的查看 / 编辑视图。
 * 作为 script-panel 的 Segmented 选项（views）之一，由 ViewResolver 内联渲染。
 * id 兼容 script_id / component_id / component.id 三种传参写法。
 */
const ScriptReadme: FC<any> = ({ script_id, component_id, component }) => (
	<ReadmeView entity="script" id={script_id ?? component_id ?? component?.id} />
)

export default ScriptReadme

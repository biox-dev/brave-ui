import { ActionDispatcher } from "@/event-bus/dispatcher";
import ScriptPageView from "./components/script-page";
import { Empty } from "antd";
import { useStoreRender } from "@/context/render/RenderProvider";
import axios from "axios";
import type { ScriptItem } from "@/api/workflow";


const ScriptPageSide = () => {
    const { relation } = useStoreRender()
    if (!relation) return <Empty description="No tools found"></Empty>


    const addScriptToNode = async (scriptId: any) => {
        // /tools/script-to-node/{component_id}
        if (!relation.relation_id) {
            console.error("relation_id 不存在！")
            return
        }
        const resp = await axios.get(`/tools/script-to-node/${scriptId}/${relation.relation_id}`)
        // return resp.data
        // console.log("Response from script-to-node API", resp.data)
        const data = {
            action: "component.invoke",
            payload: {
                category: "graph",
                id: relation.relation_id,
                method: "addNode",
                args: resp.data
            }
        }
        ActionDispatcher.dispatch(data.action, data.payload);
    }
    return (
        <ScriptPageView
            title="Script List"
            onOk={(record: ScriptItem) => {
                addScriptToNode(record.component_id)
            }}
        />
    )
}
export default ScriptPageSide
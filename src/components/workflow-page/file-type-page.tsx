import { ActionDispatcher } from "@/event-bus/dispatcher";
import ComponentsPage from "./component/page"
import { Button, Empty } from "antd";
import { useStoreRender } from "@/context/render/RenderProvider";
import axios from "axios";
import { FC } from "react";


const FileTypePage: FC<any> = (params) => {
    // const { relation } = useStoreRender()
    // if (!relation) return <Empty description="No tools found"></Empty>
    const {onOk,onCancel} = params


    const addScriptToNode = async (scriptId: any) => {
        // /tools/script-to-node/{component_id}
        const resp = await axios.get(`/tools/script-to-node/${scriptId}`)
        // return resp.data
        // console.log("Response from script-to-node API", resp.data)
        const data = {
            action: "component.invoke",
            payload: {
                category: "graph",
                // id: relation.relation_id,
                method: "addNode",
                args: resp.data
            }
        }
        ActionDispatcher.dispatch(data.action, data.payload);
    }
    return <div>
   
        <ComponentsPage component_type="file" setComponent={(record: any) => {
            // console.log("Selected component in FileTypePage", record)
            // console.log("Params in FileTypePage", params)
            onOk(record)
            // addScriptToNode(record.component_id)
            // console.log("Selected component in ScriptPage", record)
        }} />
    </div>
}
export default FileTypePage
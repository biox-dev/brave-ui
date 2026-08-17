import { invoke } from '@/core/ui-system/invokeV2';
import { Button, Space } from 'antd';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import ScriptPage from './components/script-page';
import BorderlessCard from '@/components/common/borderless-card';
import { useStoreRender } from '@/context/render/RenderProvider';
import axios from 'axios';
import { ActionDispatcher } from '@/event-bus/dispatcher';
const ScriptPageLeftPanel: FC<any> = () => {
    const navigate = useNavigate();

    const { relation } = useStoreRender()

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
    return <BorderlessCard
        styles={{ body: { padding: "0" } }}
        extra={<Space>
            <Button size="small" color="cyan" variant="solid" onClick={async () => {
                await invoke.installComponentsV2.openAsync({
                    storeType: "script",
                }, {
                    width: "80%",
                    title: `Install script`,
                    footer: null,
                })
            }}>Install</Button>
            <Button size="small" color="cyan" variant="solid" onClick={async () => {
                await invoke.createOrUpdateComponent.openAsync({})
            }}>Create</Button>
        </Space>}
    >
        <ScriptPage onOk={(script) => {
            if (!script?.id) {
                return;
            }
            navigate(`/c/scripts/${encodeURIComponent(script.id)}`);
        }}
        
        // onAddScriptToNode={relation ? addScriptToNode : undefined}
        ></ScriptPage>
    </BorderlessCard>
}

export default ScriptPageLeftPanel;
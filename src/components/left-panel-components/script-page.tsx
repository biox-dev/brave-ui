import { invoke } from '@/core/ui-system/invokeV2';
import { Button, Space } from 'antd';
import type { FC } from 'react';
import { useNavigate } from 'react-router';
import ScriptPage from '../workflow-page/script-page';
import BorderlessCard from '@/components/common/borderless-card';
const ScriptPageLeftPanel: FC<any> = () => {
    const navigate = useNavigate();

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
        }}></ScriptPage>
    </BorderlessCard>
}

export default ScriptPageLeftPanel;
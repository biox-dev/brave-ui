import { FC } from 'react';
import { Space, Button } from 'antd';
import { invoke } from '@/core/ui-system/invokeV2';
import { useNavigate } from 'react-router';
import WorkflowPage from '../workflow-page/workflow-page';
import BorderlessCard from '@/components/common/borderless-card';
const WorkflowPageLeftPanel: FC<any> = () => {
    const navigate = useNavigate();
    return <BorderlessCard
        styles={{ body: { padding: "0" } }}
        extra={<Space>
            <Button size="small" color="cyan" variant="solid" onClick={async () => {
                await invoke.installComponentsV2.openAsync({
                    storeType: "workflow",
                }, {
                    width: "80%",
                    title: `Install Workflow`,
                    footer: null,
                })
                // loadDataRef.current()
            }}>Intsall</Button>
            <Button size="small" color="cyan" variant="solid" onClick={() => {
                invoke.createOrUpdateRelation.openAsync({})
            }}>Create</Button>
        </Space>}
    >
        <WorkflowPage onOk={(relation) => {
            if (!relation?.relation_id) {
                return;
            }
            navigate(`/c/tools/${encodeURIComponent(String(relation.id))}`);
        }}></WorkflowPage>
    </BorderlessCard>
}

export default WorkflowPageLeftPanel;
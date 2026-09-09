import PipelineFlow from "@/components/pipeline-flow/indexV2"
import { Button, Card, Space, Spin } from "antd"
import axios from "axios"
import { FC, useEffect, useMemo, useState } from "react"
import { ReloadOutlined } from '@ant-design/icons'
import { colors } from "@/utils/utils"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { useComponentStore } from "@/event-bus/stores/components"
import { http } from "@/api/client/http"
type Prop = {
    relation_id: string
}
const WorkflowVisComponent: FC<Prop> = ({ relation_id }) => {

    const componentColorMap: Record<string, string> = {
        qc: '#2F54EB',
        align: '#08979C',
        mapping: '#08979C',
        variant: '#722ED1',
        annotation: '#13A8A8',
        expression: '#52C41A',
        report: '#D48806',
        script: '#1D39C4',
    }

    const getStableColor = (node: any) => {
        const type = String(node?.component_type || node?.type || '').toLowerCase();
        if (componentColorMap[type]) {
            return componentColorMap[type];
        }

        const key = String(node?.id || node?.script_id || node?.name || 'node');
        const hash = key.split('').reduce((acc: number, ch: string) => acc + ch.charCodeAt(0), 0);
        const presetColor = colors[hash % colors.length] || 'blue';
        const antColorMap: Record<string, string> = {
            magenta: '#C41D7F',
            red: '#CF1322',
            volcano: '#D4380D',
            orange: '#D46B08',
            gold: '#D48806',
            lime: '#7CB305',
            green: '#389E0D',
            cyan: '#08979C',
            blue: '#1D39C4',
            geekblue: '#2F54EB',
            purple: '#722ED1',
        };
        return antColorMap[presetColor] || '#1D39C4';
    };

    // const [data, setData] = useState<any>(null)





    const [nodes, setNodes] = useState<any[]>([]);
    const [edges, setEdges] = useState<any[]>([]);
    const [loading, setLoading] = useState(false)
    const message = useGlobalMessage()
    const loadData = async () => {
        setLoading(true)
        const resp = await http.get(`/tools/get-workflow-vis/${relation_id}`)
        // setData(resp.data)
        if (resp.data?.nodes) {
            const nodes = getInitialNodesV2(resp.data.nodes)
            setNodes(nodes)
            setEdges(resp.data.edges || [])
        }

        setLoading(false)

    }
    useEffect(() => {
        loadData()
    }, [])

    const formatNode = (node: any, index: number) => {
        const label = node.name;
        const position = node.position || { x: 0, y: index * 100 };
        const color = node.color || getStableColor(node)
        const inputs = Object.entries(node.inputs || {}).map(([key, value]: [string, any]) => ({
            id: key, // 将原本的键保存下来
            ...value // 展开原本的值
        }));
        // const inputs = (|| []).map((inputs: any) => inputs);
        const outputs = Object.entries(node.outputs || {}).map(([key, value]: [string, any]) => ({
            id: key, // 将原本的键保存下来
            ...value // 展开原本的值
        }));
        // const outputs = (node.outputs || []).map((outputs: any) => outputs);

        return {
            id: node.node_id,
            script_id: node.script_id,
            node_id:node.node_id,
            type: 'custom',
            position: position,
            scatter:node?.scatter,
            // {
            //     x: index * 300, // 你可以根据需要布局位置
            //     y: 100,
            // },
            data: {
                label,
                color,
                inputs,
                outputs,
                script_id: node.script_id,
                componentType: node.component_type || node.type || 'script',
                bioMeta: {
                    assay: node?.assay || node?.meta?.assay,
                    organism: node?.organism || node?.meta?.organism,
                    reference: node?.reference || node?.meta?.reference,
                    runtime: node?.runtime || node?.meta?.runtime,
                },
            },
        };
    }

    const instance = useMemo(() => {
        return {
            addNode: (args: any) => {

                console.log("Adding node to workflow vis", args);
                const node = formatNode(args, 0)
                setNodes((prevNodes) => [...prevNodes, node]);
            }

        }
    }, [])
    const { register, unregister } = useComponentStore();
    useEffect(() => {
        register("graph", relation_id, instance);
        return () => {
            // debugger
            unregister("graph", relation_id, instance);
        }
    }, []);
    const getInitialNodesV2 = (nodes: any) => {
        // const nodes = data?.nodes
        if (!nodes) return []

        // console.log(positionMap) 
        const initialNodes = nodes.map((node: any, index: number) => {
            return formatNode(node, index)
        });
        return initialNodes || []
    }

    const save = async () => {
        // const edgesParams = edges.map(edge => ({
        //     source: edge.source,
        //     sourceHandle: edge.sourceHandle,
        //     target: edge.target,
        //     targetHandle: edge.targetHandle,
        // }));
        console.log(nodes)
        const nodesParams = nodes.map(node => ({
            node_id: node.node_id,
            script_id:node.script_id,
            scatter: node?.scatter,
            position: node.position,
            // color: node.data.color,
        }));

        const params = {
            nodes: nodesParams,
            edges: edges,
        }
        const resp = await axios.post("/save-pipeline-relation", {
            relation_id: relation_id,
            dag_definition: JSON.stringify(params)
        })
        message.success("Structure saved")


    }


    return <Card
        size="small"
        extra={<Space>
            <Button size="small" color="cyan" variant="solid" onClick={save}>保存</Button>
            <Button size="small" color="cyan" variant="solid" onClick={loadData} icon={<ReloadOutlined />}></Button>
        </Space>}
    >
        {/* {JSON.stringify(edges)} */}
        {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
        {/* {JSON.stringify(nodes)} */}
        <Spin spinning={loading}>
            <PipelineFlow
                nodes={nodes}
                edges={edges}
                setNodes={setNodes}
                setEdges={setEdges}
            ></PipelineFlow>
        </Spin>

    </Card>
}

export default WorkflowVisComponent;
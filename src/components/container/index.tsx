import { useModal } from "@/hooks/useModal"
import { Alert, Button, Card, Flex, List, Popconfirm, Skeleton, Space, Table, Tooltip } from "antd"
import axios from "axios"
import { FC, useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { ExportOutlined, RedoOutlined } from "@ant-design/icons"
import { InspectPanel } from "@/pages/container"
import { E } from "node_modules/@faker-js/faker/dist/airline-CLphikKp"
const RunningContainer: FC<any> = ({ analysis_id, onClose }) => {
    const [data, setData] = useState<any>([])
    const [loading, setLoading] = useState<boolean>(false)
    const { baseURL } = useSelector((state: any) => state.user)
    const [event, setEvent] = useState<any>()
    const sseData = useSelector((state: any) => state.global.sseData)
    const { modal, openModal, closeModal } = useModal();
    const [toolsContainers, setToolsContainers] = useState<any>([])

    useEffect(() => {
        try {
            const sseData_ = sseData
            if (sseData_.event == "analysis_complete" || sseData_.event == "analysis_failed" || sseData_.event == "analysis_started") {
                loadData()
                setEvent(sseData_)
            }
        } catch (error) {

        }

    }, [sseData])
    const loadData = async () => {
        setLoading(true)
        if (analysis_id) {
            const resp = await axios.get(`/analysis/list-tools-containers/${analysis_id}`)
            setToolsContainers(resp.data.tools_containers)
            setData(resp.data.running_containers)
        } else {
            const resp = await axios.post(`/container/find-running-container`, {
                analysis_id: analysis_id,
            })
            setData(resp.data)

        }
        setLoading(false)
        // const resp = await axios.get(`/container/list-running-container?force=${force}`)

    }

    useEffect(() => {
        loadData()
    }, [baseURL])




    return <Card size="small" title={<>
        <Flex justify={"space-between"} align={"center"}>
            <div>Running Container ({analysis_id})</div>

        </Flex>

    </>}
        extra={<Space>
            {/* {JSON.stringify(event)} */}
            {onClose && <Button size="small" color="blue" variant="solid" onClick={() => onClose()}>Close</Button>}
            {/* <RedoOutlined style={{ cursor: "pointer" }} ></RedoOutlined> */}
            <Button size="small" icon={<RedoOutlined />} color="cyan" variant="solid" onClick={() => loadData()}>Refresh</Button>
        </Space>}
        style={{ marginBottom: "1rem" }}>
        {event && <Alert message={`${event.run_id}: ${event.event}`} type="success" />}
        {/* {JSON.stringify(toolsContainers)} */}
        <Space style={{ marginBottom: "1rem" }}>
            {Array.isArray(toolsContainers) && toolsContainers?.map((item: any, index: any) =>
                <Tooltip key={index} title={`${item.image}`}>
                    <Popconfirm title={`Run tool container ${item.name}?`} onConfirm={async () => {
                        await axios.post(`/run-analysis-v2/${analysis_id}?run_type=tools&tool_container_id=${item.container_id}`)
                        // loadData(true)
                    }}>

                        <Button
                            size="small" variant="solid" color={item.status === "running" ? "red" : "green"} key={index}>
                            {/* Tool Container: <a href={`${item.url}`} target="_blank" rel="noreferrer">{item.name}</a> */}
                            {item.name} {item.status}
                        </Button>
                    </Popconfirm>
                </Tooltip>)}
            {/* {toolsContainers.length > 0 && <RedoOutlined style={{ cursor: "pointer" }} onClick={loadToolsContainer}></RedoOutlined>} */}
        </Space>

        {/* 
        <a onClick={async () => {
            await axios.post(`/run-analysis-v2/c5e07823-6c12-47d7-a78a-9a8eacbe5d9f?run_type=tools&tool_container_id=941d6427-9b9f-4a5a-a2c2-5a0b6df8b6c8`)
        }} >test </a> */}

        {/* <List
            className="demo-loadmore-list"
            loading={loading}
            itemLayout="vertical"
            dataSource={data}
            renderItem={(item: any) => (
                <List.Item
                    actions={[
                        <Flex gap={"small"}>
                            <Popconfirm title="Stop?" onConfirm={async () => {
                                await axios.post(`/container/stop-container-by-run-id/${item.name}`)
                            }}>
                                <Button size="small" color="cyan" variant="solid">Stop</Button>
                            </Popconfirm>
                            <Button size="small" color="cyan" variant="solid"
                                onClick={() => {
                                    openModal("inspectPanel", {
                                        inspect: "inspect",
                                        id: item.name
                                    })
                                }}  >Inspect</Button>
                            <Button size="small" color="cyan" variant="solid"
                                onClick={() => {
                                    openModal("inspectPanel", {
                                        inspect: "image-inspect",
                                        id: item.image_id
                                    })
                                }}  >Image Inspect</Button>
                        </Flex>


                    ]}
                >
                    <Skeleton avatar title={false} loading={item.loading} active>
                        <List.Item.Meta

                            title={<p style={{ wordWrap: "break-word" }}>{item.image}</p>}
                            description={item.name}
                        />
                    </Skeleton>
                </List.Item>
            )}
        /> */}

        <ContainerTable
            data={data}
            loading={loading}
            openModal={openModal}
        ></ContainerTable>
        <InspectPanel
            visible={modal.key == "inspectPanel" && modal.visible}
            params={modal.params}
            onClose={closeModal}
        ></InspectPanel>


    </Card>
}
export default RunningContainer;



// interface ContainerItem {
//     analysis_id: string;
//     image: string;
//     run_id: string;
//     name: string;
//     id: string;
//     image_id: string;
//     status: string;
// }

interface Props {
    data: any[];
    loading: boolean;
    openModal: (key: string, params: any) => void;
}

const ContainerTable: React.FC<Props> = ({ data, loading, openModal }) => {
    const { containerURL } = useSelector((state: any) => state.user);

    const columns:any = [
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            ellipsis: true,
        }, {
            title: "Image",
            dataIndex: "image",
            key: "image",
            ellipsis: true,
            render: (text: string) => (
                <p style={{ wordBreak: "break-all", margin: 0 }}>{text}</p>
            ),
        },
        {
            title: "Container Name",
            dataIndex: "name",
            key: "name",
            render: (text: string) => (
                <span style={{ fontFamily: "monospace" }}>{text}</span>
            ),
        },
        {
            title: "Analysis ID",
            dataIndex: "analysis_id",
            key: "analysis_id",
            ellipsis: true,
        },
        {
            title: "Actions",
            key: "actions",
            fixed: "right",
            ellipsis: true,
            width: 200,
            render: (_: any, item: any) => (
                <Flex gap="small">
                    <Popconfirm
                        title="Stop?"
                        onConfirm={async () => {
                            await axios.post(`/container/stop-container-by-run-id/${item.name}`);
                        }}
                    >
                        <Button size="small" color="red" variant="solid">
                            Stop
                        </Button>
                    </Popconfirm>
                    <Tooltip title={<>
                        {`${containerURL}/container/${item.name}/`}
                    </>}>
                        <ExportOutlined style={{ cursor: "pointer" }} onClick={() => {

                            window.open(`${containerURL}/container/${item.name}/`, "_blank")
                        }} />
                    </Tooltip>

                    <Button
                        size="small"
                        color="cyan"
                        variant="solid"
                        onClick={() =>
                            openModal("inspectPanel", { inspect: "inspect", id: item.name })
                        }
                    >
                        Inspect
                    </Button>
                </Flex>
            ),
        },
    ];

    return (
        <Table
            scroll={{ x: 'max-content', y: 55 * 5 }}
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={data}
            pagination={false}
            bordered
            size="small"
            footer={() => <>
                A total of {data.length} running container{data.length > 1 ? "s" : ""}
            </>}
        />
    );
};


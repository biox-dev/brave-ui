import { FC, useEffect, useMemo, useState } from "react"
import { Alert, Button, Card, Col, Flex, List, message, Popconfirm, Row, Skeleton, Tabs, Tag } from "antd"
import { containerData } from '@/pages/container/container.ts'
import { CloseOutlined, RedoOutlined } from '@ant-design/icons'
import { useSelector } from "react-redux"
import { useModal } from "@/hooks/useModal"
import { useStickyTop } from "@/hooks/useStickyTop"
import axios from "axios"
import { ContainerOpt, InspectPanel } from "../../../pages/container"
import { useComponentStore } from "@/event-bus/stores/components"

const ContainerApp: FC<any> = ({ keys = [] }) => {
    const [data, setData] = useState<any>()
    const [loading, setLoading] = useState<boolean>(false)
    const { baseURL, project } = useSelector((state: any) => state.user)



    const [messageApi, contextHolder] = message.useMessage();


    // }, [eventSourceRef.current]);
    // const sseData = useSelector((state: any) => state.global.sseData)
    const [containerIds, setContainerIds] = useState<any>([])
    // useEffect(() => {
    //     try {
    //         // const sseData_ = JSON.parse(sseData)
    //         if (containerIds.includes(sseData.analysis_id)) {
    //             // if (data.event == "container_pulled" || data.event == "analysis_complete" || data.event == "analysis_failed" || data.event == "analysis_started") {
    //             loadData()
    //             // }
    //         }
    //     } catch (error) {

    //     }

    // }, [sseData])
    const { register, unregister } = useComponentStore();

    const instance = useMemo(() => {
        // const analysis_node_id = selectedSample?.analysis_node_id

        return {
            analysisDone: (args: any) => {
                console.log("AnalysisNodes analysisDone", args, data)
                if (args.id) {
                    // 判断data 是否都是当前analysis_node_id，如果是则reload，否则不处理
                    // const allMatch = (data as AnalysisNode[]).every(node => node.analysis_node_id === analysis_node_id);
                    const findRecord = (containerIds as any[]).find(x => x === args.id);
                    if (findRecord) {
                        loadData()
                    }
                }

            },
            analysisStarted: (args: any) => {
                console.log("AnalysisNodes analysisStarted", args, data)

                if (args.id) {
                    // 判断data 是否都是当前analysis_node_id，如果是则reload，否则不处理
                    // const allMatch = (data as AnalysisNode[]).every(node => node.analysis_node_id === analysis_node_id);
                    const findRecord = (containerIds as any[]).find(x => x === args.id);
                    if (findRecord) {
                        loadData()
                    }
                }
            }
        }
    }, [containerIds])

    useEffect(() => {

        register("analysis", "*", instance);
        return () => {
            unregister("analysis", "*", instance);
        }
    }, [containerIds]);


    const loadData = async () => {
        setLoading(true)
        const resp = await axios.post(`/container/list-container-key`, {
            container_key: keys
        })
        setContainerIds(resp.data.map((item: any) => item.container_id))
        const obj = Object.fromEntries(resp.data.map((item: any) => [item.container_key, item]));
        const appList = keys.map((item: any) => {
            if (!obj[item]) {
                return { key: item }
            } else {
                return obj[item]
            }
        })
        setData(appList)
        setLoading(false)


        // console.log(obj)
    }


    useEffect(() => {
        loadData()
    }, [baseURL])

    return <Card title="Cloud App" size="small" loading={loading} extra={<>
        <RedoOutlined style={{ cursor: "pointer" }} onClick={() => loadData()}></RedoOutlined>
    </>}>
        {contextHolder}
        {/* {JSON.stringify(containerIds)}
        {JSON.stringify(sseData)} */}
        {/* {JSON.stringify(data)} */}
        <List
            className="demo-loadmore-list"
            loading={loading}
            itemLayout="vertical"
            // loadMore={loadMore}
            dataSource={data}

            renderItem={(item: any) => (

                <>
                    {!item?.name ? <Flex align="center" style={{ padding: "1rem 0" }}>
                        <Popconfirm title="Install?" onConfirm={async () => {

                            const templete: any = containerData.find((it: any) => it.container_key == item?.key)
                            // console.log(containerData)
                            if (!templete) {
                                messageApi.error(`${name} templete not exist!`)
                            }
                            const newParams = JSON.parse(JSON.stringify(templete));

                            newParams.envionment = JSON.stringify(templete.envionment)
                            newParams.labels = JSON.stringify(templete.labels)
                            if(newParams.volumes){
                                newParams.volumes = JSON.stringify(newParams.volumes)
                            }
                            console.log(newParams)

                            await axios.post(`/container/add-or-update-container`, newParams)
                            loadData()

                        }}>
                            <Button size="small" color="cyan" variant="solid">Install {item?.key}</Button>
                        </Popconfirm>
                    </Flex> : <>
                        <List.Item

                            actions={[
                                // <Popconfirm title="Stop?" onConfirm={async () => {
                                //     await axios.post(`/container/stop-container-by-run-id/${item.name}`)
                                // }}>
                                //     <a >Stop</a>
                                // </Popconfirm>
                                <ContainerOpt record={item} reload={loadData} traefikUI={item.name == "traefik"}></ContainerOpt>
                                ,

                                // <a
                                //     onClick={() => {
                                //         openModal("inspectPanel", {
                                //             inspect: "inspect",
                                //             id: item.name
                                //         })
                                //     }}  >Inspect</a>
                            ]}
                        >

                            <Skeleton avatar title={false} loading={item.loading} active>
                                <List.Item.Meta
                                    avatar={<img
                                        draggable={false}
                                        width={100}
                                        alt="logo"
                                        src={item.img}
                                    />}
                                    title={<p style={{ wordWrap: "break-word" }}>{item.image}</p>}
                                    description={item.name}
                                />
                                {/* <div>content</div> */}
                            </Skeleton>
                        </List.Item>
                    </>}
                </>

            )}
        />

        {/* 
        {keys.map((name: any, index: any) => (<div key={index} style={{ marginBottom: "1rem" }}>
            {data && data[name] ? <>

            
                <div style={{ marginBottom: "1rem" }}>
                    <Tag>{data[name].image}</Tag>
                </div>
                <Flex gap="small">
                    <ContainerOpt record={data[name]} reload={loadData} traefikUI={name == "traefik"}></ContainerOpt>

                </Flex>



            </> : <>
                <Popconfirm title="Install?" onConfirm={async () => {

                    const templete: any = containerData.find((item: any) => item.container_key == name)
                    if (!templete) {
                        messageApi.error(`${name} templete not exist!`)
                    }
                    const newParams = JSON.parse(JSON.stringify(templete));

                    newParams.envionment = JSON.stringify(templete.envionment)
                    newParams.labels = JSON.stringify(templete.labels)
                    console.log(newParams)

                    await axios.post(`/container/add-or-update-container`, newParams)
                    loadData()

                }}>
                    <Button size="small" color="cyan" variant="solid">Install {name}</Button>
                </Popconfirm>
            </>}

        </div>))} */}

    </Card>


}


export default ContainerApp
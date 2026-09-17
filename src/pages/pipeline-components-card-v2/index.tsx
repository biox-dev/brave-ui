import { Button, Card, Col, Empty, Flex, Input, List, message, Modal, notification, Pagination, Popconfirm, Row, Segmented, Skeleton, Spin, Tabs, Tag, Tooltip } from "antd"
import Item from "antd/es/list/Item"
import { FC, use, useEffect, useMemo, useRef, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useNavigate, useOutletContext, useParams } from "react-router"
import { ApartmentOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, RedoOutlined, ReloadOutlined } from '@ant-design/icons';

import Meta from "antd/es/card/Meta"
import { colors } from '@/utils/utils'
import { pageComponentsRelation } from '@/api/pipeline'
import CreateORUpdatePipelineCompnentRelation, { CreateOrUpdatePipelineComponent } from '@/components/create-pipeline'
import axios from "axios"
import { useModal } from "@/hooks/useModal"
import { usePagination } from "@/hooks/usePagination"
import { CreateOrUpdateNamespace, InstallNamespace } from "../../components/namespace-operature"
import DependComponent from "../../components/depend-component"
import "./index.css"
import { base } from "@faker-js/faker"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { ComponentImage } from "@/components/common/component-image"
import { add } from "@dnd-kit/utilities"
import { useStickyTop } from "@/hooks/useStickyTop"
import ToolsLLMRender from "./tools-llm-render"
import { invoke } from "@/core/ui-system/invokeV2"
const PipelineComponentsCard: FC<any> = ({ params, map }) => {
    const { Search } = Input;
    // const [searchText, setSearchText] = useState("");
    const navigate = useNavigate();
    const { messageApi } = useOutletContext<any>()
    const { modal, openModal, closeModal } = useModal();
    const [activeCategory, setActiveCategory] = useState<string | null>("all");
    const { ref: containerRef, top, isSticky } = useStickyTop(576);

    // "action": "create_analysis_tools",
    // "target": "analysis_tools_card",
    // "value":"",
    // "message": f"分析工具{name}创建成功"
    const sseData = useSelector((state: any) => state.global.sseData)
    useEffect(() => {
        // debugger
        if (sseData && sseData?.action && sseData?.target == "analysis_tools_card") {
            switch (sseData.action) {
                case "create_analysis_tools":
                    reload()
                    messageApi.success(sseData?.message || "Component relation updated!")
                    break;
                case "update_component_relation":
                case "delete_component_relation":
                
            }
        }

    }, [sseData])
    // const [pipelineComponents, setPipelineComponents] = useState<any>([])
    const { relation_type } = params
    // const params = {relation_type:"tools"}
    const mapFun = (item: any) => {
        // if (map) {
        //     item = map(item)
        // }
        // if (item["tags"]) {
        //     item["tags"] = JSON.parse(item["tags"])
        // }
        // console.log(item)
        return {
            ...item,
            path: `/relation/${relation_type}/${item.relation_id}`,
            // id: item.id,
            // component_id: item.component_id,
            // name: item.component_name,
            // category: item.category,
            // img: item.img,
            // tags: item.tags,
            // component_type: item.component_type,
            // // description: item.description,
            // order: item.order_index,
            // path: `/component/${component_type}/${item.component_id}`,
            // namespace: item.namespace,
            // namespace_name: item.namespace_name
        }

    }
    // const params_ = {
    //     ...params,
    //     keywords:searchText

    // }
    const { data: pipelineComponents, pageNumber, totalPage, loading, reload, pageSize, setPageNumber, search } = usePagination({
        pageApi: pageComponentsRelation,
        params: { category: activeCategory, ...params },
        map: mapFun,
        initialPageSize: 12
    })
    const [category, setCategory] = useState<any[]>([])
    const [categoryLoading, setCategoryLoading] = useState(false)
    const loadCateory = async () => {
        setCategoryLoading(true)
        const resp = await axios.get(`/component/get-all-relation-category`)
        setCategory(["all", ...resp.data])
        setCategoryLoading(false)
    }
    useEffect(() => {
        loadCateory()
    }, [])
    // useEffect(() => {
    //     const loadData = async () => {

    // result = {
    //     "id":item.id,
    //     "component_id":item.component_id,
    //     "path":item.component_id,
    //     "name":data['name'],
    //     "category":data['category'],
    //     "img":f"/brave-api/img/{data['img']}",
    //     "tags":data['tags'],
    //     "description":data['description'] if 'description' in data else "",
    //     "order":item.order_index
    // }


    // const menuItems = useSelector((state: any) => state.menu.items)
    // const sseData = useSelector((state: any) => state.global.sseData)

    // const loadPipeine = async () => {
    //     const resp: any = await pagePipelineComponents({})
    //     // console.log(data)
    //     // const menu = data.map((group: any) => ({
    //     //     name: group.name,
    //     //     items: group.items.map((item: any) => {
    //     //         const { path, name, ...rest } = item
    //     //         return {
    //     //             key: `pipeline/${path}`,
    //     //             label: name,
    //     //             ...rest
    //     //         }
    //     //     })
    //     // }));
    //     console.log(resp)

    //     // setMenu(menu)
    // }
    // const datelePipeline = async (pipelineId: any) => {
    //     try {
    //         const resp = await axios.delete(`/delete-pipeline/${pipelineId}`)
    //         messageApi.success("删除成功!")
    //         loadPipeine()
    //     } catch (error: any) {
    //         console.log(error)
    //     }
    // }
    // useEffect(() => {
    //     loadPipeine()
    //     // console.log(menu)
    // }, [])

    // indivi
    return <div style={{ maxWidth: "1800px", margin: "1rem auto", padding: `${isSticky ? '0 16px 0 16px' : '0'}` }}>
        {/* {JSON.stringify(sseData)} */}

        {/* <div style={{ marginBottom: "2rem" }}>
        </div> */}

        {/* {JSON.stringify(pipelineComponents)} */}

        <Row
            ref={containerRef}
            gutter={[isSticky ? 16 : 0, 16]}>
            <Col lg={18} sm={18} xs={24}
                style={{

                    display: "flex",
                    flexDirection: "column", // 让 Card 撑满高度
                    height: "100%",          // 关键：继承 Row 的高度
                }}
            >
                <Card size="small"
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        height: " 100%"
                    }}
                    styles={{
                        body: {
                            // height: "90%",
                            flex: 1,
                            overflowY: "auto"
                        }
                    }}
                    extra={<>
                        <Flex gap="small">
                            <Button size="small" color="cyan" variant="solid" onClick={async () => {
                                // openModal("installComponents", { relation_type: "tools" })
                                await invoke.installComponentsV2.openAsync({
                                    relation_type: "tools",
                                })
                                reload()
                            }}>Intsall {relation_type} </Button>

                            <Button size="small" color="cyan" variant="solid" onClick={() => {

                                openModal("createORUpdateCompnentRelation", {
                                    data: undefined,
                                    pipelineStructure: {
                                        relation_type: relation_type,
                                    }
                                })
                            }}>Create Components </Button>



                            {/* <Button size="small" color="cyan" variant="solid" onClick={() => {
                    openModal("modalB")
                }}>Create/Update  namespace</Button> */}
                            {/* <Button size="small" color="cyan" variant="solid" onClick={() => {
                    openModal("modalC")
                }}>Install namespace</Button> */}
                            <Button icon={<ReloadOutlined />} size="small" color="primary" variant="solid" onClick={reload}>Refresh</Button>
                        </Flex>
                    </>}
                    title={<>
                        <Search
                            size="small"
                            placeholder="Search Components"
                            allowClear
                            enterButton
                            onSearch={(value) => { search(value) }}
                            style={{ width: 400 }}
                        />
                    </>}
                >
                    <div style={{ marginBottom: "1rem" }}>
                        {categoryLoading ? (
                            <Skeleton active paragraph={{ rows: 5 }} />
                        ) : (
                            <List
                                dataSource={category}
                                split={false}
                                renderItem={(item) => (
                                    <Tag color={activeCategory === item ? "blue" : "default"} style={{ cursor: "pointer" }} onClick={() => setActiveCategory(item)}>
                                        {item}
                                    </Tag>
                                    // <List.Item
                                    //     style={{
                                    //         padding: "6px 0",
                                    //         border: "none",
                                    //     }}
                                    // >
                                    //     <Button
                                    //         block
                                    //         type={activeCategory === item ? "primary" : "default"}
                                    //         onClick={() => setActiveCategory(item)}
                                    //         style={{
                                    //             textAlign: "left",
                                    //             borderRadius: "8px",
                                    //             transition: "all 0.2s",
                                    //         }}
                                    //         className="hover:shadow-md"
                                    //     >
                                    //         {item}

                                    //     </Button>
                                    // </List.Item>
                                )}
                            />
                        )}
                    </div>

                    <Spin spinning={loading}>
                        {Array.isArray(pipelineComponents) && pipelineComponents.length != 0 ? <Row gutter={16} style={{ position: "relative" }}>

                            {pipelineComponents.map((item: any, index: any) => (
                                <Col key={index} lg={6} sm={4} xs={24} style={{ marginBottom: "1rem", cursor: "pointer" }}>
                                    <Card hoverable
                                        size="small"
                                        className="custom-card"
                                        // title={item.label}
                                        // variant="borderless" 
                                        variant="borderless"
                                        style={{
                                            height: "100%",
                                            border: "1px solid #f0f0f0",   // 默认灰色边框
                                            borderRadius: "12px",          // 圆角
                                            overflow: "hidden",
                                            transition: "all 0.3s ease",   // 平滑过渡
                                            // boxShadow: "none"

                                        }}
                                        bodyStyle={{
                                            padding: "12px 16px",          // 内边距更紧凑
                                        }}
                                        cover={<div style={{ height: "15rem" }}>
                                            <ComponentImage kind="workflow" id={item.id} img={item.img} alt={item.name} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
                                        </div>}
                                        onClick={() => navigate(`${item.path}`)}>


                                        <Meta title={<Flex gap={"small"}>
                                            <span>{item.name}</span>
                                            {/* <Popconfirm title="Copy component ?" onConfirm={async (e: any) => {
                                                e.stopPropagation()
                                                await axios.post(`/copy-component/${item.component_id}`)
                                                message.success("Component copied!")
                                                reload()
                                            }}>

                                                <CopyOutlined onClick={(e) => {
                                                    e.stopPropagation()

                                                }} />

                                            </Popconfirm> */}
                                            {/* <Tooltip title={item?.namespace}>
                                    <span style={{ margin: "0", color: "rgba(0, 0, 0, 0.45)", fontSize: "0.5rem" }}> {item?.namespace_name}</span>
                                </Tooltip> */}
                                        </Flex>} description={item?.description} style={{ marginBottom: "1rem" }} />
                                        {item?.category && <Tag style={{
                                            wordBreak: "break-word",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            maxWidth: 100,
                                            display: "inline-block",
                                            cursor: "default"
                                        }} color="blue">
                                            {item?.category}
                                        </Tag>}

                                        {item.tags && Array.isArray(item.tags) && item.tags.map((tag: any, index: any) => (
                                            <Tooltip key={index} title={tag}>
                                                <Tag style={{
                                                    wordBreak: "break-word",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    maxWidth: 100,
                                                    display: "inline-block",
                                                    cursor: "default"
                                                }} color={colors[index]}>{tag}</Tag>
                                            </Tooltip>

                                        ))}
                                        {/* {JSON.stringify(item)} */}

                                        <div onClick={(e) => {
                                            e.stopPropagation()
                                            openModal("modalG", item)
                                            // setCreateOpen(true)
                                            // console.log(item)
                                            // setRecord(item)
                                        }} style={{
                                            position: "absolute",
                                            right: 10,
                                            bottom: 10,
                                            fontSize: 15,
                                            // color: "rgba(0,0,0,0.45)",
                                            cursor: "pointer",
                                        }}>
                                            <ApartmentOutlined />
                                        </div>
                                        {/* <div style={{
                                position: "absolute",
                                right: 40,
                                bottom: 10,
                                fontSize: 15,
                                color: "rgba(0,0,0,0.45)",
                                cursor: "pointer",
                            }}>
                                <Tooltip title={item.namespace}>
                                    {item.namespace_name}
                                </Tooltip>
                            </div> */}
                                        {/* <EditOutlined
                                onClick={(e) => {
                                    e.stopPropagation()
                                    openModal("modalA", {
                                        data: item,
                                        structure: {
                                            component_type: "pipeline",
                                        }
                                    })
                                    // setCreateOpen(true)
                                    // console.log(item)
                                    // setRecord(item)
                                }}
                                style={{
                                    position: "absolute",
                                    right: 40,
                                    bottom: 10,
                                    fontSize: 15,
                                    color: "rgba(0,0,0,0.45)",
                                    cursor: "pointer",
                                }}
                            />
                            <Popconfirm title="是否删除?" onConfirm={(e: any) => {
                                e.stopPropagation();
                                datelePipeline(item.pipeline_id)
                            }} onCancel={(e: any) => { e.stopPropagation() }} >
                                <DeleteOutlined
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        position: "absolute",
                                        right: 10,
                                        bottom: 10,
                                        fontSize: 15,
                                        color: "rgba(0,0,0,0.45)",
                                        cursor: "pointer",
                                    }}
                                />
                            </Popconfirm> */}
                                    </Card>
                                </Col>
                            ))}

                        </Row> : <Empty></Empty>}
                    </Spin>
                    {totalPage != 0 && <Flex style={{ marginTop: "1rem" }} align="center">
                        A total of {totalPage} records &nbsp;
                        <Pagination
                            current={pageNumber}
                            pageSize={pageSize}
                            total={totalPage}
                            onChange={(p) => setPageNumber(p)}
                            showSizeChanger={false}
                        />
                    </Flex>}
                </Card>
            </Col>
            <Col lg={6} sm={6} xs={24}
                style={isSticky ? {
                    overflow: "hidden",
                    // marginTop: "1rem",
                    position: "sticky",
                    top: `${top}px`, // 吸顶距离
                    alignSelf: "flex-start", // 避免被stretch
                    height: `calc(100vh - ${top}px - 1rem )`, // 可选：固定高度，让内部滚动
                } : {}}
            // style={{

            //     display: "flex",
            //     flexDirection: "column", // 让 Card 撑满高度
            //     height: "100%",          // 关键：继承 Row 的高度
            // }}
            >
                <Card
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        height: " 100%"
                    }}
                    styles={{
                        body: {
                            // height: "90%",
                            flex: 1,
                            overflowY: "auto"
                        }
                    }}
                    // extra={<RedoOutlined style={{ cursor: "pointer" }} onClick={() => loadCateory()} />}
                    size="small"
                    loading={categoryLoading}
                    title={<span style={{ fontWeight: 600 }}>LLM</span>}

                >
                    <ToolsLLMRender view={"llm"}></ToolsLLMRender>
                </Card>
            </Col>
        </Row>




        {/* <CreatePipeline
            callback={loadPipeine}
            pipelineStructure={{
                pipeline_type: "wrap_pipeline",
                parent_pipeline_id: "0"

            }}
            open={createOpen}
            setOpen={setCreateOpen}
            data={record}></CreatePipeline> */}

        <CreateOrUpdatePipelineComponent
            callback={reload}
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modal.key == "modalA" && modal.visible}
            onClose={closeModal}
            params={modal.params}></CreateOrUpdatePipelineComponent>

        <CreateORUpdatePipelineCompnentRelation
            callback={reload}
            visible={modal.key == "createORUpdateCompnentRelation" && modal.visible}
            onClose={closeModal}
            params={modal.params}
        ></CreateORUpdatePipelineCompnentRelation>

        {/* <CreateOrUpdateNamespace
            visible={modal.key == "modalB" && modal.visible}
            onClose={closeModal}
            params={modal.params}></CreateOrUpdateNamespace> */}
        {/* <InstallNamespace
            visible={modal.key == "modalC" && modal.visible}
            onClose={closeModal}
            params={modal.params}></InstallNamespace> */}

        <DependComponent
            visible={modal.key == "modalG" && modal.visible}
            onClose={closeModal}
            callback={reload}
            params={modal.params}></DependComponent>

        {/* <InstallComponents
            visible={modal.key == "installComponents" && modal.visible}
            onClose={closeModal}
            callback={reload}
            params={modal.params}
        ></InstallComponents> */}
    </div >
}

export default PipelineComponentsCard




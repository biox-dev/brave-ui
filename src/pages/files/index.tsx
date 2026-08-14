import { pagePipelineComponents } from "@/api/pipeline";
import { usePagination } from "@/hooks/usePagination";
import { useStickyTop } from "@/hooks/useStickyTop";
import { Button, Card, Col, Divider, Drawer, Empty, Flex, Input, Pagination, Row, Space, Table, Tabs } from "antd";
import { FC, useEffect, useMemo, useState } from "react"
import { LineChartOutlined, RedoOutlined } from '@ant-design/icons'
import AnalysisResultPage from "@/components/result-list/indexV2";
import { useModal, useModals } from "@/hooks/useModal";
import OpenFile from "@/components/open-file";
import { CreateOrUpdatePipelineComponent } from "@/components/create-pipeline";
import Sample, { BindSample } from "../sample";
import MetadataForm from "@/components/metadata-form";
import SysFileBrowser from "@/components/left-panel-components/sys-file";
import { useSideViewContext } from "@/context/side/SideViewContext";
import { invoke } from "@/core/ui-system/invokeV2";
import { useSelector } from "react-redux";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { addFileToDatasetApi } from "@/api/data";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
const { Search } = Input;

const Files: FC<any> = () => {

    const { ref: containerRef, top, isSticky } = useStickyTop(576);
    const [component, setComponent] = useState<any>();
    useSelector((state: any) => state.user)

    const { modal, openModal, closeModal } = useModal();
    const { modals, openModals, closeModals } = useModals(["modalD", "metadataModal", "bindSample"])
    const message = useGlobalMessage()
    // const [searchText, setSearchText] = useState("");
    // const filteredData = useMemo(() => {
    //     if (!searchText) return data;
    //     return data.filter((item: any) =>
    //         Object.values(item).some((val) =>
    //             String(val).toLowerCase().includes(searchText.toLowerCase())
    //         )
    //     );
    // }, [data, searchText]);


    const operatePipeline = {
        openModal: openModal,
        openModals: openModals
    }

    // const { setSideView, sideView, sideOptions, setSideOptions } = useSideViewContext();


    // useEffect(() => {
    //     setSideOptions([
    //         {
    //             label: "LLM",
    //             value: "llm-card"
    //         }, {
    //             label: "Container App",
    //             value: "containerAppProject"
    //         }
    //     ])
    //     // setSideView("analysis-tools")
    //     return () => {
    //         setSideOptions([])
    //         setSideView("llm-card")
    //     }
    // }, [])
    return <div style={{ maxWidth: "1500px", margin: "1rem auto", padding: `${isSticky ? '0 16px 0 16px' : '0'}` }}>

        <Card size="small" >
            <Tabs
                size="small"
                items={[
                    {
                        key: "result",
                        label: "Files",
                        children: <>
                            {/* <AnalysisResultPage
                                title="Analysis Results"

                                // ref={tableRef}
                                setComponent={setComponent}
                                component={component}
                                params={{ component_id: component?.component_id }}
                                operatePipeline={{
                                    openModal: openModal,
                                    openModals: openModals
                                }}

                            ></AnalysisResultPage> */}
                            <ViewResolver view="datasetFilePage"></ViewResolver>
                        </>
                    }, {
                        key: "data_file_browser",
                        label: "Data File browser",
                        children: <SysFileBrowser path="/" type="data" onSelectFile={async (file: any) => {
                            console.log(file)
                            try {
                                const data = await invoke.datasetProjectPage.openDrawerAsync(file, {
                                    width: 600,
                                    title: "Select File Type"
                                })
                                // /analysis-result/add-to-file
                                const params = {
                                    dataset_id: data.id,
                                    path: file.path,
                                    source: "data",
                                }
                                console.log(params)
                                await addFileToDatasetApi(params)
                                message.success("File added to analysis results")
                            } catch (error) {
                                console.log("File type selection cancelled or failed", error)
                            }

                        }} ></SysFileBrowser>
                    },    {
                        key: "sample-dataset",
                        label: "Sample",
                        children: <>
                            {/* <AnalysisResultPage
                                title="Analysis Results"

                                // ref={tableRef}
                                setComponent={setComponent}
                                component={component}
                                params={{ component_id: component?.component_id }}
                                operatePipeline={{
                                    openModal: openModal,
                                    openModals: openModals
                                }}

                            ></AnalysisResultPage> */}
                            <ViewResolver view="sampleProjectPage"></ViewResolver>
                        </>
                    }, {
                        key: "analysis_file_browser",
                        label: "Analysis File browser",
                        children: <SysFileBrowser path="/" type="analysis"></SysFileBrowser>
                    }, {
                        key: "sample",
                        label: "Metadata",
                        children: <Sample operatePipeline={operatePipeline}></Sample>
                    }
                ]}
                tabBarExtraContent={<>
                    <Button size="small" color="cyan" variant="solid" onClick={() => openModal("filesDrawer")} >Select File Type</Button>
                </>}
            ></Tabs>
        </Card>

        {/* <Row gutter={[isSticky ? 16 : 0, 16]} style={{}} ref={containerRef} >
            <Col lg={16} sm={16} xs={24}>


            </Col>
            <Col lg={8} sm={8} xs={24}


            >
            
              
            </Col>

        </Row> */}




        <OpenFile
            visible={modal.key == "openFile" && modal.visible}
            onClose={closeModal}
            params={modal.params}></OpenFile>
        <FilesDrawer
            visible={modal.key == "filesDrawer" && modal.visible}
            onClose={closeModal}
            setComponent={setComponent}
            params={modal.params}
        ></FilesDrawer>
        <CreateOrUpdatePipelineComponent
            // pipelineStructure={pipelineStructure}
            // data={record}
            visible={modal.key == "createOrUpdatePipelineComponent" && modal.visible}
            onClose={closeModal}
            params={modal.params}></CreateOrUpdatePipelineComponent>
        <MetadataForm
            visible={modal.key == "metadataForm" && modal.visible}
            onClose={closeModal}
            params={modal.params}></MetadataForm>

        <BindSample
            visible={modals.bindSample.visible}
            onClose={() => closeModals("bindSample")}
            operatePipeline={operatePipeline}
            params={modals.bindSample.params}></BindSample>

    </div>
}

export default Files

const FilesDrawer: FC<any> = ({ visible, onClose, params, setComponent }) => {
    const { data, pageNumber, totalPage, loading, reload, pageSize, setPageNumber, search } = usePagination({
        pageApi: pagePipelineComponents,
        params: { component_type: "file" },
        initialPageSize: 10
    })

    const columns: any = [
        {
            title: 'Component Name',
            dataIndex: 'component_name',
            key: 'component_name',
            width: 200,
        }, {
            title: "action",
            dataIndex: "action",
            fixed: "right",
            width: 100,

            key: "action",
            render: (_: any, record: any) => {
                return <Space>
                    {/* <a onClick={() => {
                        openModal("createOrUpdatePipelineComponent", {
                            data: record, structure: {
                                component_type: "file",
                            }
                        })
                    }}>Edit</a> */}
                    {/* 分割线 */}
                    <Divider type="vertical" />

                    <a onClick={() => {
                        setComponent(record)
                        onClose()
                    }}>Select</a>
                </Space>
            }
        }
    ]

    return <Drawer
        title="Select File Component"
        width={600}
        onClose={onClose}
        open={visible}
    >

        <Card
            title={<><LineChartOutlined />  Files</>} extra={
                <Flex gap={"small"} wrap>
                    <Button size="small" onClick={() => setComponent(undefined)}>Clear</Button>
                    <Search
                        size="small"
                        placeholder="Search Components"
                        allowClear
                        enterButton
                        onSearch={(value) => { search(value) }}
                        style={{ width: 200 }}
                    />
                    <RedoOutlined style={{ cursor: "pointer" }} onClick={reload} />
                </Flex>

            }
            size="small" >
            <Table
                rowKey="component_id"
                size="small"
                // bordered
                pagination={false}
                loading={loading}
                scroll={{ x: 'max-content' }}
                columns={columns}
                footer={() => <>
                    {totalPage != 0 && <Flex style={{ marginTop: "1rem" }} justify="space-between" align="center">
                        A total of {totalPage} records  &nbsp;
                        <Pagination
                            size="small"
                            current={pageNumber}
                            pageSize={pageSize}
                            total={totalPage}
                            onChange={(p) => setPageNumber(p)}
                            showSizeChanger={false}
                        />
                    </Flex>}
                </>}
                dataSource={data} />

        </Card>

    </Drawer>
}
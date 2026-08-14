import { FC, useEffect, useRef, useState } from "react"
import axios from "axios"
import { Button, Card, Drawer, Flex, Form, Input, Modal, Popconfirm, Space, Table, TableProps, Tabs } from "antd"
import { useOutletContext, useParams } from "react-router"

import { useModal } from "@/hooks/useModal"
import { deleteSampleBySampleIdApi } from "@/api/sample"
import { bindSampleToAnalysisResultApi } from "@/api/analysis-result"
import { updateSampleMetadataListApi } from "@/api/sample-metadata"
import { EditMetadataTableModal } from "@/components/edit-table"
import { EditOutlined, FileAddOutlined } from "@ant-design/icons"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
export const getSamples: any = (project: any) => axios.get(`/list-by-project?project=${project}`)
const Sample: FC<any> = ({ operatePipeline, rowSelection }) => {
    const [sampleData, setSampleData] = useState([])
    // const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const { project, messageApi, projectObj } = useOutletContext<any>()

    const tableRef = useRef<any>(null)

    const getMetadataColumns = () => {
        // console.log("projectObj",projectObj?.metadata_form)
        if (!projectObj?.metadata_form || !Array.isArray(projectObj?.metadata_form)) return []
        return projectObj?.metadata_form?.map((item: any) => {
            return {
                title: item.label,
                dataIndex: item.name,
                key: item.name,
                ellipsis: true,
            }
        })
    }

    const { modal, openModal, closeModal } = useModal();

    const { Search } = Input;
    const loadSample = async () => {
        setLoading(true)
        const resp: any = await getSamples(project)
        console.log(resp)

        setSampleData(resp.data)
        tableRef.current = resp.data
        // setData(resp.data)
        setLoading(false)
    }
    const columns: TableProps<any>['columns'] = [
        {
            title: 'ID',
            dataIndex: 'sample_id',
            key: 'sample_id',
            ellipsis: true,
            width: 100,
        }, {
            title: 'Project',
            dataIndex: 'project',
            key: 'project',
            ellipsis: true,
            width: 100,
        },
        {
            title: 'Sample Name',
            dataIndex: 'sample_name',
            key: 'sample_name',
            ellipsis: true,
            width: 100,
        },
        // {
        //     title: '样本个体',
        //     dataIndex: 'sample_individual',
        //     key: 'sample_individual',
        //     ellipsis: true,
        // }, {
        //     title: '样本组成',
        //     dataIndex: 'sample_composition',
        //     key: 'sample_composition',
        //     ellipsis: true,
        // }, {
        //     title: '测序技术',
        //     dataIndex: 'sequencing_technique',
        //     key: 'sequencing_technique',
        //     ellipsis: true,
        // }, {
        //     title: '测序目标',
        //     dataIndex: 'sequencing_target',
        //     key: 'sequencing_target',
        //     ellipsis: true,
        // },
        // {
        //     title: '样本分组',
        //     dataIndex: 'sample_group',
        //     key: 'sample_group',
        //     ellipsis: true,
        // },
        ...getMetadataColumns(),
        //  {
        //     title: '样本分组名称',
        //     dataIndex: 'sample_group_name',
        //     key: 'sample_group_name',
        //     ellipsis: true,
        // },
        // {
        //     title: '样本来源',
        //     dataIndex: 'sample_source',
        //     key: 'sample_source',
        //     ellipsis: true,
        // },
        // {
        //     title: '参与比对的reads数',
        //     dataIndex: 'alignment_reads_num',
        //     key: 'alignment_reads_num',
        //     render: (_, record) => (<>
        //         {(record.alignment_reads_num / 1e6).toFixed(2)}M
        //     </>)
        // }, {
        //     title: '比对上的reads数',
        //     dataIndex: 'alignment_reads',
        //     key: 'alignment_reads',
        //     render: (_, record) => (<>

        //         {record.alignment_reads > 1e6 ?
        //             (record.alignment_reads / 1e6).toFixed(2) + "M" :
        //             record.alignment_reads
        //         }
        //     </>)
        // }, {
        //     title: '未比对上的reads数',
        //     dataIndex: 'alignment_reads',
        //     key: 'alignment_reads',
        //     render: (_, record) => (<>

        //         {(record.alignment_reads_num - record.alignment_reads) > 1e6 ?
        //             ((record.alignment_reads_num - record.alignment_reads) / 1e6).toFixed(2) + "M" :
        //             (record.alignment_reads_num - record.alignment_reads)
        //         }
        //     </>)
        // }, {
        //     title: '比对率',
        //     dataIndex: 'alignment_reads',
        //     key: 'alignment_reads',
        //     render: (_, record) => (<>

        //         {(record.alignment_reads / record.alignment_reads_num*100).toFixed(4) + "%"
        //         }
        //     </>)
        // }, {
        //     title: '质控前reads数',
        //     dataIndex: 'before_filtering_total_reads',
        //     key: 'before_filtering_total_reads',
        //     render: (_, record) => (<>
        //         {(record.before_filtering_total_reads / 1e6).toFixed(2)}M
        //     </>)
        // }, {
        //     title: '质控前碱基数',
        //     dataIndex: 'before_filtering_total_bases',
        //     key: 'before_filtering_total_bases',
        //     render: (_, record) => (<>
        //         {(record.before_filtering_total_bases / 1e9).toFixed(2)}G
        //     </>)
        // }, {
        //     title: '质控后reads数',
        //     dataIndex: 'after_filtering_total_reads',
        //     key: 'after_filtering_total_reads',
        //     render: (_, record) => (<>
        //         {(record.after_filtering_total_reads / 1e6).toFixed(2)}M
        //     </>)
        // },
        // {
        //     title: '质控后碱基数',
        //     dataIndex: 'after_filtering_total_bases',
        //     key: 'after_filtering_total_bases',
        //     render: (_, record) => (<>
        //         {(record.after_filtering_total_bases / 1e9).toFixed(2)}G
        //     </>)
        // },

        // {
        //     title: '组织',
        //     dataIndex: 'tissue',
        //     key: 'tissue',
        //     ellipsis: true,
        // }, {
        //     title: '备注',
        //     dataIndex: 'remark',
        //     key: 'remark',
        //     ellipsis: true,
        // }, 
        // {
        //     title: 'fastq1',
        //     dataIndex: 'fastq1',
        //     key: 'fastq1',
        //     ellipsis: true,
        // }, {
        //     title: 'fastq2',
        //     dataIndex: 'fastq2',
        //     key: 'fastq2',
        //     ellipsis: true,
        // }, 
        {
            title: 'Action',
            key: 'action',
            fixed: "right",
            width: 100,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button size="small" color="cyan" variant="solid" onClick={() => {
                        operatePipeline.openModal("metadataForm", {
                            analysis_key: record.analysis_key,
                            sample_id: record.sample_id,
                            callback: loadSample
                        })
                    }}>Edit</Button>
                    {/* <a href={`http://10.110.1.11:8000/heixiaoyan/heixiaoyan_workspace/output/fastp/${record.sample_name}.fastp.html`} target="__black">fastp</a>
                    <a href={`http://10.110.1.11:8000/heixiaoyan/heixiaoyan_workspace/output/fastqc/clean_reads/${record.sample_name}_1.fastp_fastqc.html`} target="__black">cf1</a>
                    <a href={`http://10.110.1.11:8000/heixiaoyan/heixiaoyan_workspace/output/fastqc/clean_reads/${record.sample_name}_2.fastp_fastqc.html`} target="__black">cf2</a> */}
                    <Popconfirm title="Are you sure about the deletion?" onConfirm={async () => {
                        await deleteSampleBySampleIdApi(record.sample_id)
                        loadSample()
                    }}>
                        <Button size="small" color="danger" variant="solid">Delete</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]
    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const text = event.clipboardData?.getData('Text') || '';
            if (!text) return;

            const delimiter = text.includes('\t') ? '\t' : ',';
            const rows = text.split(/\r?\n/).filter(line => line.trim() !== '');
            const data = rows.map(row => row.split(delimiter).map(cell => cell.trim()));

            // console.log(columnRef.current)
            const column = [
                {
                    title: "Sample Name",
                    dataIndex: "sample_name",
                    key: "sample_name",
                    render: (text: any) => <span>{text}</span>
                }, ...getMetadataColumns()
            ]
            // console.log(data)
            // console.log(tableRef.current)
            // console.log(column)


            // 提取列字段顺序
            const keys = column.map((col: any) => col.dataIndex);
            // console.log(keys)

            // 创建 sample_name → group 映射表
            const tableMap = Object.fromEntries(
                data.map((row: any) => [row[0], row]) // key 为 sample_name
            );
            // console.log(tableMap)
            // 合并数据
            const merged = tableRef.current.map((item: any) => {
                const row = tableMap[item.sample_name];
                console.log(row)
                if (!row) return item; // 没有匹配则保留原样

                const extra: any = {};
                for (let i = 1; i < keys.length; i++) {
                    extra[keys[i]] = row[i];
                }

                return { ...item, ...extra };
            });
            // console.log("meg",merged)
            setSampleData(merged)
            // setParseData(converted);
            messageApi.success('Paste was successful!');
        };

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        }
    }, []);
    const updateMetadata = async () => {
        const keys = getMetadataColumns().map((col: any) => col.dataIndex);
        const saveData = sampleData.map((row: any) => {
            const obj: Record<string, string> = {};
            keys.forEach((col: any, index: any) => {
                if (col in row) {
                    obj[col] = row[col]
                }
            });
            let metadata = null
            if (Object.keys(obj).length != 0) {
                metadata = JSON.stringify(obj)
            }
            return { sample_id: row.sample_id, metadata: metadata }
        }).filter((item: any) => item.metadata != null)
        if (saveData.length == 0) {
            messageApi.error("No Data!")
            return
        }
        console.log(saveData)
        await updateSampleMetadataListApi(saveData)
        messageApi.success("update successfully!")
    }

    useEffect(() => {
        loadSample()
    }, [])
    return <>
        {/* {sampleData && <>样本数量{sampleData.length}</>} */}
        {/* <Search

            style={{ width: 304 }}
        /> */}

        <Flex justify={"end"} align={"center"} gap="small" style={{ marginBottom: "1rem" }}>
            <Button size="small" color="cyan" variant="solid" onClick={updateMetadata}>Batch Save</Button>
            <Button size="small" color="cyan" variant="solid" onClick={() => {
                operatePipeline.openModal("metadataForm", {
                    callback: loadSample
                })
            }}>Add Sample</Button>
            <EditOutlined style={{ cursor: "pointer" }} onClick={() => {
                openModal("editMetadataTable", {
                    data: sampleData,
                })
            }} />
            <FileAddOutlined style={{ cursor: "pointer" }} onClick={() => {
                openModal("editMetadataTable")
            }} />
            <Button size="small" color="primary" variant="solid" onClick={loadSample} >Refresh</Button>

        </Flex>
        {/* <Button onClick={() => { openModal("modalA", { operatureUrl: "import_sample_form_str" }) }} style={{ marginLeft: "1rem" }}>导入样本</Button>
<Button onClick={() => { openModal("modalA", { operatureUrl: "update_sample_form_str" }) }} style={{ marginLeft: "1rem" }}>更新样本</Button> */}

        <Table
            rowSelection={rowSelection}
            rowKey={(record) => record.sample_id}
            size="small"
            bordered
            // rowClassName="cursor-pointer"
            // pagination={{ pageSize: 30 }}
            pagination={false}
            loading={loading}
            // virtual
            scroll={{ x: 'max-content', y: 100 * 5 }}
            columns={columns}
            footer={() => `A total of ${sampleData.length} records`}
            dataSource={sampleData} />

        <EditMetadataTableModal
            visible={modal.visible && modal.key == "editMetadataTable"}
            params={modal.params}
            onClose={closeModal}
            callback={loadSample}
        ></EditMetadataTableModal>

        {/* <ImportFile
            visible={modal.key == "modalA" && modal.visible}
            onClose={closeModal}
            params={modal.params}
        > </ImportFile> */}
    </>
}

export const BindSample: FC<any> = ({ visible, onClose, operatePipeline, params }) => {
    const [selectedRowKey, setSelectedRowKey] = useState<any>()
    // const {  } = useOutletContext<any>()
    const messageApi = useGlobalMessage()
    const submit = async () => {
        if (!selectedRowKey) {
            messageApi.error("Please select a sample")
            return
        }
        const req = {
            analysis_result_id: params.analysis_result_id,
            sample_id: selectedRowKey[0]
        }
        // analysis_result_id:string,sample_id:string
        console.log(req)
        const resp = await bindSampleToAnalysisResultApi(req)
        messageApi.success("Bind successfully")
        params.callback?.()
        onClose()
    }
    return <Modal title="Binding Sample"
        open={visible}
        onClose={onClose}
        onCancel={onClose}
        width={"80%"}
        onOk={submit}
    >
        {/* {JSON.stringify(params)} */}
        <Sample
            rowSelection={{
                type: "radio",
                ellipsis: true,
                width:100,
                onChange: (selectedRowKeys: any, selectedRows: any) => {
                    // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
                    setSelectedRowKey(selectedRowKeys)
                },
            }}
            operatePipeline={operatePipeline}></Sample>


    </Modal>
}


export const MetadataModal: FC<any> = ({ visible, onClose, params }: any) => {
    if (!visible) return null
    const { operatePipeline, ...rest } = params
    return <Modal title="Metadata" open={visible} onClose={onClose} onCancel={onClose} width={"80%"} footer={null}>

        {/* <Button onClick={() => {
            operatePipeline.openModal("metadataForm")
        }}>metadata</Button> */}
        <Sample operatePipeline={operatePipeline}></Sample>


        {/* <Tabs items={[
            {
                key: "sample",
                label: "样本信息",
                children: 
            }
          
        ]}></Tabs> */}
    </Modal>
}

export default Sample

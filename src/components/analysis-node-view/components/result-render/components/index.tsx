
import { Button, Input, Popover, Spin, Table, Image, Typography, Collapse, Flex, Card, Skeleton, Tag, Tabs, Row, Col, Popconfirm, Drawer, Form, Alert, Modal, Tooltip, Divider } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC, forwardRef, memo, use, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Markdown from '../../../../markdown'
import axios from "axios";
import LogFile from "../../../../log-file";
import { DeleteOutlined, DownloadOutlined, QuestionCircleOutlined, RedoOutlined } from "@ant-design/icons"
import { MonacoEditor } from "../../../../react-monaco-editor";
import { useNavigate, useOutletContext } from "react-router";
import { findAnalysisById, runAnalysisApi, stopAnalysisApi } from "@/api/analysisv1";
import { useModal, useModals } from "@/hooks/useModal";
import FormJsonComp from "../../../../form-components";
import ParamsView from "../../../../params-view";
import Project from "@/pages/project";
import EditParams from '../../../../edit-params'
import { KGMLMapSVG } from "../../../../databases/kegg";
import { download } from "@antv/s2";
import { useSelector } from "react-redux";
import ModuleEdit from "../../../../module-edit";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { CreateOrUpdatePipelineComponent } from "../../../../create-pipeline";
import BigTable from '@/components/big-table';
import DiffSummaryCard from "./diff-summary-card";
import { resolveAnalysisAssetURL } from "@/utils/analysis-url";


export const UrlComp: FC<any> = ({ url, filename, baseURL }) => {
    return <>
        {url && <Popover title={<div style={{ wordBreak: "break-all", maxWidth: "400px" }}>
            {`${resolveAnalysisAssetURL(baseURL, url)}`}
        </div>}>
            <Tag color="success"
                style={{
                    cursor: "pointer",
                    whiteSpace: "normal",   // Allow multi-line wrapping
                    wordBreak: "break-all", // Break long words/URLs
                    display: "inline-block", // Allow wrapping inside the tag
                    //   maxWidth: "300px"       // Optional: limit width to trigger wrapping
                }} onClick={() => {
                    window.open(`${resolveAnalysisAssetURL(baseURL, url)}?t=${Date.now()}`, "_blank")
                }}><span>{filename} </span><DownloadOutlined /></Tag></Popover>}

    </>
}

export const TableView2: FC<any> = ({ data, url, filename, columns, baseURL, projectObj }) => {
    const { Search } = Input;
    const [tableData, setTableData] = useState<any>([])
    const [research, setResearch] = useState<any>()
    const [search, setSearch] = useState<string>()
    useEffect(() => {
        if (projectObj?.research) {
            try {
                const data = JSON.parse(projectObj?.research || "{}")
                setResearch(data)
            } catch (error) {

            }
        }


    }, [projectObj?.research])
    const getColumns = (data: any) => {
        if (!data) return []
        return Object.keys(data).map(it => {
            return {
                title: it,
                dataIndex: it,
                key: it,
                ellipsis: true,
                width: 150,
            }
        })
    }

    useEffect(() => {
        // console.log()
        if (data) {
            // console.log(data)
            const dataWithKey = data.map((item: any, index: any) => ({ ...item, key: index }));
            setTableData(dataWithKey)
        }

    }, [data])
    return <>
        {research?.table && <>
            {/* {JSON.stringify(research?.table)} */}

            <div style={{ marginBottom: "1rem" }}>
                {research?.table.map((item: any) => (<Tag
                    color="blue"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                        const filterData = data.filter((it: any) => Object.values(it).some(val =>
                            typeof val === "string" && val.includes(item)
                        ))
                        setTableData(filterData)
                        setSearch(item)
                    }}
                    key={item}>{item}</Tag>))}
            </div>



        </>}


        {Array.isArray(tableData) && <>

            <Table
                style={{ border: "1px solid #f0f0f0" }}
                size="small"
                title={() => <Flex gap={"small"}>
                    <Search
                        // onChange={setSearch}
                        value={search}
                        size="small"
                        onChange={e => { setSearch(e.target.value) }}
                        // onClear={()=>{setSearch("")}}
                        placeholder="input search text"
                        allowClear
                        onSearch={(value: any) => {
                            // console.log(data?.table)
                            const filterData = data.filter((it: any) => Object.values(it).some(val =>
                                typeof val === "string" && val.includes(value)
                            ))
                            setTableData(filterData)
                        }}
                        style={{ width: 304 }}
                    />
                    <UrlComp url={url} filename={filename} baseURL={baseURL}></UrlComp>

                </Flex>}
                // showHeader={()=>{}}
                scroll={{ x: 'max-content', y: 55 * 5 }}
                dataSource={tableData}
                pagination={false}
                virtual
                columns={columns ? columns : getColumns(data[0])}
                footer={() => `A total of ${data.length} records`}
            ></Table>


        </>}

    </>
}
export const TableView: FC<any> = ({ data, url, filename, columns, baseURL, projectObj }) => {
    console.log("TableView data Render")
    const [tableRowsInfo, setTableRowsInfo] = useState<any>({

    })
    const [searchText, setSearchText] = useState("");
    const [tables, setTables] = useState<any>([])
    useEffect(() => {
        if (data) {
            setTableRowsInfo({
                "nrow": data?.nrow,
                "ncol": data?.ncol
            })
            setTables(data?.tables || [])
        }
    }, [data])

    let filteredData: any = useMemo(() => {
        if (!searchText) return tables
        return tables.filter((item: any) =>
            Object.values(item).some((val) =>
                String(val).toLowerCase().includes(searchText.toLowerCase())
            )
        );

    }, [tables, searchText]);
    return <>
        {/* {JSON.stringify(data)} */}
        <Flex gap={"small"}>
            <Input.Search
                size="small"
                placeholder="Search..."
                allowClear
                enterButton
                value={searchText}
                onChange={(e: any) => setSearchText(e.target.value)}
                style={{ width: 300 }}
            />
            <UrlComp url={url} filename={filename} baseURL={baseURL}></UrlComp>
        </Flex>


        <div >
            <BigTable shape={tableRowsInfo} rows={[...filteredData]} />
        </div>
    </>
}


const ImgView0: FC<any> = ({ data, url, urls, filename, baseURL }) => {
    return <>
        <Card style={{ height: "100%" }} size="small" title={filename}
            styles={{
                body: {
                    padding: "1rem 0.5rem 2rem 0.5rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    objectFit: "cover"
                }
            }}

        // extra={<UrlComp url={url} filename={filename} baseURL={baseURL}></UrlComp>}
        >

            <div>

                <Image src={data?.startsWith("data:image/png") ? data : `${resolveAnalysisAssetURL(baseURL, data)}?t=${Date.now()}`} style={{ width: "100%", marginRight: "0.5rem" }}></Image>
                {(urls && Array.isArray(urls)) && <>

                    {urls.map((item: any, index: any) => (
                        <UrlComp key={index} url={item.url} filename={item.format} baseURL={baseURL}></UrlComp>

                    ))}
                </>}
            </div>

        </Card>


    </>
}
export const ImgView = memo(ImgView0)

const { Paragraph } = Typography;

const StringView: FC<any> = ({ data }) => {

    return <>
        <Typography>
            <pre style={{ margin: 0 }}>
                {data}
            </pre>
        </Typography>
        {/* <MonacoEditor value={data} /> */}
        {/* <Paragraph style={{ background: "#13c2c2", padding: "1rem", border: "1px solid #1677ff" }}>{data}</Paragraph> */}
    </>
}
const InfoView: FC<any> = ({ data }) => {

    return <div >
        <Alert closable message={data} type="info" />

        {/* <Typography>
            <pre style={{ margin: 0 }}>
                {data}
            </pre>
        </Typography> */}

    </div>
}

const MdView: FC<any> = ({ data,prefix }) => {

    return <div >
        {/* <Alert closable message={data} type="info" /> */}
        <Markdown data={data} prefix={prefix}></Markdown>
        {/* <Typography>
            <pre style={{ margin: 0 }}>
                {data}
            </pre>
        </Typography> */}

    </div>
}
const TextView: FC<any> = ({ data }) => {

    return <>
        <Typography>
            <pre style={{ margin: 0 }}>
                {data}
            </pre>
        </Typography>

    </>
}
const JSONView: FC<any> = ({ data }) => {

    return <>
        <MonacoEditor value={data} defaultLanguage={"json"} />
        {/* <Paragraph style={{ background: "#13c2c2", padding: "1rem", border: "1px solid #1677ff" }}>{data}</Paragraph> */}
    </>
}
// const HtmlView: FC<any> = ({ data }) => {

//     return <>
//         {data && data.startsWith("/brave") ? <>
//             <iframe src={data} width={"100%"} style={{ height: "80vh", border: "none" }}>
//             </iframe>
//         </> : <>{data}</>}

//     </>
// }
const HtmlView: FC<any> = ({ data, url }) => {
    const { baseURL } = useSelector((state: any) => state.user)
    const [loading, setLoading] = useState(true);

    return <>

        <div style={{ position: "relative", width: "100%", height: "80vh" }}>
            {/* loading 层 */}
            {loading && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.8)",
                        zIndex: 1,
                    }}
                >
                    <Spin size="large" tip="Loading..." />
                </div>
            )}

            {/* iframe 本体 */}
            <iframe
                src={`${resolveAnalysisAssetURL(baseURL, url)}`}
                width="100%"
                style={{ height: "100%", border: "none" }}
                onLoad={() => setLoading(false)} // 加载完成时隐藏 loading
                title="content-frame"
            />
        </div>

        {/* {data && data.startsWith("/brave") ? <>
        </> : <>{data}</>} */}

    </>
}
const Download: FC<any> = ({ url, filename, baseURL }) => {
    return <>
        <UrlComp url={url} filename={filename} baseURL={baseURL}></UrlComp>

        {/* {url && <Popover title={`${window.location.origin}${url}`}>
            <Tag color="success" style={{ cursor: "pointer" }} onClick={() => {
                window.open(`${url}?t=${Date.now()}`, "_blank")
            }}>{filename} <DownloadOutlined /></Tag></Popover>} */}

    </>
}
const KeggMap: FC<any> = ({ data, ...rest }) => {
    const { modal, openModal, closeModal } = useModal()
    // const [record,setRecord] = useState<any>()
    return <>
        <TableView2 data={data?.list} {...rest} columns={[
            {
                title: "ID",
                dataIndex: "ID",
                key: "ID",
                ellipsis: true,
                width: 150,
            }, {
                title: "Description",
                dataIndex: "Description",
                key: "Description",
                ellipsis: true,
                width: 400,
            }, {
                title: "GeneRatio",
                dataIndex: "GeneRatio",
                key: "GeneRatio",
                ellipsis: true,
                width: 150,
            }, {
                title: "geneID",
                dataIndex: "geneID",
                key: "geneID",
                ellipsis: true,
                width: 150,
            }, {
                title: "gene_name",
                dataIndex: "gene_name",
                key: "gene_name",
                ellipsis: true,
                width: 150,
            }, {
                title: "KO",
                dataIndex: "KO",
                key: "KO",
                ellipsis: true,
                width: 150,
            }, {
                title: "Count",
                dataIndex: "Count",
                key: "Count",
                ellipsis: true,
                width: 150,
            }, {
                title: "pvalue",
                dataIndex: "pvalue",
                key: "pvalue",
                ellipsis: true,
                width: 150,
            }, {
                title: "p.adjust",
                dataIndex: "p.adjust",
                key: "p.adjust",
                ellipsis: true,
                width: 150,
            }, {
                title: "qvalue",
                dataIndex: "qvalue",
                key: "qvalue",
                ellipsis: true,
                width: 150,
            }, {
                title: "organism",
                dataIndex: "organism",
                key: "organism",
                ellipsis: true,
                width: 150,
            }, {
                title: "pathwayId",
                dataIndex: "pathwayId",
                key: "pathwayId",
                ellipsis: true,
                width: 150,
            }, {
                title: '操作',
                key: 'action',
                fixed: "right",
                ellipsis: true,
                width: 200,
                render: (_: any, record: any) => (
                    <>
                        <Button
                            onClick={() => {
                                openModal("KGMLMapSVG", record)
                            }}
                            size="small" color="cyan" variant="solid">pathview</Button>
                    </>
                )
            }
        ]}></TableView2>

        {modal.visible && <Modal
            width={"80%"}
            title={<>
                <a
                    target="_blank"
                    href={`https://www.kegg.jp/pathway/${modal.params?.organism}${modal.params?.pathwayId}`}>{modal.params?.Description} ({modal.params?.organism}{modal.params?.pathwayId})</a>
            </>}
            footer={null}
            onCancel={closeModal}
            onClose={closeModal}
            open={modal.visible && modal.key == "KGMLMapSVG"}>
            {/* {JSON.stringify(modal.params)} */}
            <KGMLMapSVG
                KOList={modal.params?.KO ? modal.params?.KO.split("/") : []}
                compound={data?.compound}
                highlightKeys={modal.params?.geneID.split("/")}
                pathwayId={modal.params?.pathwayId} organisms={modal.params?.organism}></KGMLMapSVG>

        </Modal>}

        {/*
        {JSON.stringify(data)} */}
    </>
}

const FeatureList: FC<any> = ({ data }) => {

    return <div >
        <Alert closable message={data} type="success" action={<>

        </>} />
        <Flex justify="end" style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}>
            <Tag color="success">A total of {data?.split(",").length} features</Tag>

        </Flex>
    </div>
}




export const componentMap: any = {
    table: TableView,
    string: StringView,
    html: HtmlView,
    md: MdView,
    // htmlDoc: HtmlDoc,
    json: JSONView,
    text: TextView,
    info: InfoView,
    kegg_map: KeggMap,
    gsea_kegg_map: KeggMap,
    download: Download,
    feature_list: FeatureList,
    diff: DiffSummaryCard
};


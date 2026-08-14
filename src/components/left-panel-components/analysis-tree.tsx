import { Button, Card, Col, Empty, Flex, Row, Segmented, Skeleton, Space, Tabs, Tag, Tooltip, Tree, TreeDataNode, TreeProps } from "antd"
import axios from "axios"
import { FC, lazy, Suspense, use, useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import { DownloadOutlined, DownOutlined, RedoOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from "react-redux"
import { setUserItem } from "@/store/userSlice"
import { useModal } from "@/hooks/useModal"
import FormProject from "@/components/form-project"
import Markdown from "@/components/markdown"
import { useStickyTop } from "@/hooks/useStickyTop"
import { AI } from "@/components/chat"
import { useStoreRender } from "@/context/render/RenderProvider"

const ResultParse = lazy(() => import("@/components/result-parse"))
// import AnalysisResultPanel from '@/components/analysis-result-view/panel'
const AnalysisTree: FC<any> = () => {
    const [loading, setLoading] = useState<boolean>(false)
    // const { project, projectObj } = useOutletContext<any>()
    const { project, projectObj, baseURL } = useSelector((state: any) => state.user);

    const [data, setData] = useState<any>()
    // const [analysis, setAnalysis] = useState<any>()
    const location = useLocation()
    const queryParams = new URLSearchParams(location.search);
    const key = queryParams.get("key");
    const projectParam = queryParams.get("project");
    const dispatch = useDispatch()
    // const { modal, openModal, closeModal } = useModal();
    // const [componentType, setComponentType] = useState<any>()
    // const [rightPanel, setRightPanel] = useState<any>("toc");

    // const [queryProject, setQueryProject] = useState<any>()
    const [analysisKey, setAnalysisKey] = useState<any>(key)


    useEffect(() => {
        if (projectParam && projectParam != project) {
            dispatch(setUserItem({ project: projectParam }))
        }
    }, [projectParam])

    const resultRef = useRef<any>(null)
    const navigate = useNavigate()
    // const updateKey = (newKey:any) => {
    //     const searchParams = new URLSearchParams(location.search);
    //     searchParams.set("key", newKey);

    //     navigate({
    //         pathname: location.pathname,
    //         search: `?${searchParams.toString()}`
    //     });
    // };
    const updateQueryParam = (paramName: string, newValue: string) => {
        const { pathname, search, hash } = window.location;

        // Parse current query string
        const searchParams = new URLSearchParams(search || "");

        // Update or add the parameter
        searchParams.set(paramName, newValue);

        // Determine if the app uses HashRouter
        const isHashRouter = hash.startsWith("#/");

        let newUrl = "";

        if (isHashRouter) {
            // Extract path and query part from the hash
            const [hashPath, hashSearch = ""] = hash.replace(/^#/, "").split("?");

            const hashParams = new URLSearchParams(hashSearch);
            hashParams.set(paramName, newValue);

            // Build new hash-based URL
            newUrl = `#${hashPath}?${hashParams.toString()}`;
        } else {
            // Build new browser-based URL
            newUrl = `${pathname}?${searchParams.toString()}`;
        }

        // Update browser URL without reloading the page
        window.history.pushState({}, "", newUrl);
    };
    // const [components,setComponents] = useState<any>()
    // const loadComponents = async (componentId:any) => {
    //     const resp = await axios.post("/find-pipeline", { component_id: componentId })
    //     setComponents(resp.data)
    // }

    const loadData = async (first = true) => {

        setLoading(true)
        // ?analysis_method=${analysisMethod}&project=${project}
        let resp: any = await axios.post(`/list-analysis-tree`, {
            // analysisMethod: analysisMethod,
            is_report: true,
            project: project
        });

        const data = resp.data;
        setData(resp.data)
        // debugger
        // debugger
        if (first) {
            if (!key && resp.data.length > 0) {
                if (resp.data[0]?.children && resp.data[0]?.children.length > 0) {
                    // setAnalysis(resp.data[0]?.children[0])
                    setAnalysisKey(resp.data[0]?.children[0]?.key)
                    console.log(resp.data[0]?.children[0])
                    // setComponentType(resp.data[0]?.children[0]?.relation_type)
                    // updateQueryParam("project", project);
                    // updateQueryParam("key", resp.data[0]?.children[0]?.key);
                    navigate(`/analysis-report?project=${project}&key=${resp.data[0]?.children[0]?.key}`)

                }
            } else {
                // debugger
                const componentType = data
                    .flatMap((item: any) => item.children || [])
                    .find((child: any) => child.key === key)?.component_type;
                // setComponentType(componentType)
            }
        }



        setLoading(false)
    }


    useEffect(() => {
        loadData()
    }, [])
    return <div >

        <Flex justify="end">


            <Space>
                <Tooltip title={`Download Project ${projectObj?.project_name}`}>


                    <Button
                        onClick={async () => {
                            // /analysis/download-results/{analysis_id}
                            const res = await axios.post(`/analysis/download-project/${project}`);
                            const url = `${baseURL}${res.data.download_url}`
                            console.log(res)
                            window.open(url, "_blank")
                            // const blob = new Blob([res.data], { type: 'application/zip' });
                        }}
                        size="small" color="blue" variant="solid" icon={<DownloadOutlined />} >Download</Button>

                </Tooltip>
                <RedoOutlined style={{ cursor: "pointer" }} onClick={() => loadData()} />
            </Space>

            {/* <Button size="small" color="cyan" variant="solid" onClick={loadData}>Refresh</Button> */}
        </Flex>
        <div style={{
            // height:"50vh",
            // overflow:"auto"
        }}>
            {Array.isArray(data) && data.length != 0 ? <>
                <LeftPanel onSelect={(val: any) => {
                    if (val.node?.type == "analysis") {
                        // setAnalysis(val.node)
                        setAnalysisKey(val.node.key)
                        // setComponentType(val.node.relation_type)
                        // updateQueryParam("project", project);
                        // updateQueryParam("key", val.node.key);
                        
                        navigate(`/analysis-report?project=${project}&key=${val.node.key}`)
                    } else if (val.node?.type == "relation") {
                        console.log(val.node)
                        // loadComponents(val.node.key)
                    }

                    // console.log(val)
                }} defaultSelectKey={analysisKey} treeData={data}></LeftPanel>

            </> : <>
                <Empty></Empty>
            </>}

        </div>


    </div>
}

export default AnalysisTree

// const ComponentsView:FC<any> = ({components})=>{
//     return <>

//     </>
// }
const LeftPanel: FC<any> = ({ treeData, defaultSelectKey, onSelect: onSelect_ }) => {

    // const treeData2: TreeDataNode[] = [
    //     {
    //         title: <span style={{ color: "red" ,whiteSpace:"nowrap",textOverflow:"ellipsis",display:"inline-block",width:"100%",overflow:"hidden"}}>
    //         parent 111111111111111111111111111
    //         </span>,
    //         key: '0-0',
    //         children: [
    //             {
    //                 title: 'parent 1-0',
    //                 key: '0-0-0',

    //             },
    //             {
    //                 title: 'parent 1-1',
    //                 key: '0-0-1',

    //             },
    //             {
    //                 title: 'parent 1-2',
    //                 key: '0-0-2',

    //             },
    //         ],
    //     }, {
    //         title: 'parent 1',
    //         key: '0-1',
    //         children: [
    //             {
    //                 title: 'parent 1-0',
    //                 key: '0-0-0',

    //             },
    //             {
    //                 title: 'parent 1-1',
    //                 key: '0-0-1',

    //             },
    //             {
    //                 title: 'parent 1-2',
    //                 key: '0-0-2',

    //             },
    //         ],
    //     },
    // ];

    const [selectedKey, setSelectedKey] = useState<any>(defaultSelectKey)
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

    // 找到 key 的所有父节点
    const getParentKeys = (key: any, nodes: TreeDataNode[], parents: string[] = []): string[] => {
        for (const node of nodes) {
            if (node.key === key) return parents;
            if (node.children) {
                const res = getParentKeys(key, node.children, [...parents, node.key as string]);
                if (res.length) return res;
            }
        }
        return [];
    };

    useEffect(() => {
        if (defaultSelectKey) {
            const keys = getParentKeys(defaultSelectKey, treeData);
            setExpandedKeys(keys);
            setSelectedKey(defaultSelectKey);
        }
    }, [defaultSelectKey, treeData]);

    const onSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
        // console.log('selected', selectedKeys, info);
        if (selectedKeys.length > 0) {
            onSelect_(info)
            setSelectedKey(selectedKeys[0])

            // 选中时展开父节点
            const keys = getParentKeys(selectedKeys[0], treeData);
            setExpandedKeys(keys);
        }

    };
    const onExpand = (keys: React.Key[]) => {
        setExpandedKeys(keys as string[]);
    };

    return (
        <>

            {/* {JSON.stringify(treeData)} */}
            <Tree

                selectedKeys={[selectedKey]}
                showLine
                expandedKeys={expandedKeys}
                onExpand={onExpand}
                autoExpandParent={true} // 自动展开父节点
                switcherIcon={<DownOutlined />}
                // defaultExpandAll
                // defaultExpandedKeys={['0-0-0']}
                onSelect={onSelect}
                treeData={treeData}
            />
        </>
    );
}

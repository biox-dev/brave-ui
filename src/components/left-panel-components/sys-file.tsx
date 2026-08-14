// import { Button } from "antd"
// import { Card, Spin, Typography } from "antd"
// import axios from "axios"
// import { FC, useEffect, useState } from "react"

// const FileBrowser: FC<any> = ({ output_dir: dir }) => {
//     const [data, setData] = useState<any>()
//     const [loading, setLoading] = useState<any>()
//     const browseOutputDir = async () => {
//         setLoading(true)
//         const resp = await axios.get(`/file-operation/list-dir?directory=${dir}`)
//         setData(resp.data)
//         setLoading(false)
//     }
//     useEffect(() => {
//         console.log("file-list-recursive dir", dir);

//         browseOutputDir()
//     }, [dir])
// return <Card title="文件列表" extra={
//     <Button size="small" color="cyan" variant="solid" onClick={browseOutputDir}>
//         刷新
//     </Button>
// }>
//     <Spin spinning={loading}>

//         <Typography>
//             <pre>{JSON.stringify(data, null, 2)}</pre>
//         </Typography>
//     </Spin>
// </Card>
// }

// export default FileBrowser


import React, { FC, useEffect, useState } from "react";
import axios from "axios";
import { Breadcrumb, Button, Card, Flex, Input, List, Pagination, Space, Tooltip, Typography } from "antd";
const { Search } = Input
const { Text } = Typography
type FileItem = {
    name: string;
    is_dir: boolean;
    size?: number;
    modified: number;
};
import { FolderOutlined, FileOutlined, DownloadOutlined, ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons"
import { useSelector } from "react-redux";
import { openFileByPath } from "@/utils/file-open";

const joinPath = (basePath: string, name: string) => {
    if (!basePath || basePath === "/") {
        return `/${name}`
    }
    return `${basePath.replace(/\/+$/, "")}/${name}`
}






// path="/" type="data"

const SysFileBrowser: FC<any> = ({ type="data", path="/", onSelectFile, onClose }) => {
    const [files, setFiles] = useState<FileItem[]>([])
    const [currentPath, setCurrentPath] = useState(path)
    const [keyword, setKeyword] = useState("")
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [dir, setDir] = useState("")
    const limit = 10
    const { project } = useSelector((state: any) => state.user);

    const loadFiles = async (
        pathVal: string = currentPath,
        keywordVal: string = keyword,
        pageNum: number = page
    ) => {
        const res = await axios.get(`/project/list-project-dir/${project}`, {
            params: {
                path: pathVal,
                keyword: keywordVal,
                type: type,
                page: pageNum,
                limit,
            },
        })
        setFiles(res.data.items)
        setTotal(res.data.total)
        setDir(res.data.dir)
        setCurrentPath(pathVal)
        setPage(pageNum)
    }

    useEffect(() => {
        loadFiles(path)
    }, [path, project, type])

    const handleNavigate = (name: string) => {
        loadFiles(joinPath(currentPath, name), "", 1)
    }

    const handleBack = () => {
        const parts = currentPath.split("/").filter(Boolean)
        parts.pop()
        loadFiles("/" + parts.join("/"), "", 1)
    }

    const handleSearch = (val: string) => {
        loadFiles(currentPath, val, 1)
    }

    const handleSelectFile = (file: FileItem) => {
        const path = joinPath(currentPath, file.name)
        onSelectFile({
            path: path,
            file: file.name,
            type: type
        })
    }

    const resolveFilePath = (fileName: string) => {
        return joinPath(dir || currentPath, fileName)
    }

    const handleOpenFile = (file: FileItem) => {
        const filePath = resolveFilePath(file.name)
        openFileByPath({ filePath, title: file.name })
    }

    const pathSegments = currentPath.split("/").filter(Boolean)

    return (
        <Card
            title={<Tooltip title={dir}>

                File browser
            </Tooltip>}
            size="small"
            styles={{
                body: {

                }
            }}
            extra={
                <Space>
                    {onClose && <Button size="small" color="blue" variant="solid" onClick={onClose}>Close</Button>}
                    <Button size="small" color={"cyan"} variant="solid" icon={<ReloadOutlined />} onClick={() => loadFiles(path)} >
                        Reset
                    </Button>
                    <Button size="small" color={"cyan"} variant="solid" icon={<ReloadOutlined />} onClick={() => loadFiles(currentPath)} >
                        Refresh
                    </Button>
                </Space>
            }
        >
            <Breadcrumb style={{ marginBottom: "1rem" }}>
                <Breadcrumb.Item>
                    <a onClick={() => loadFiles("/")}>root</a>
                </Breadcrumb.Item>
                {pathSegments.map((seg: any, index: any) => (
                    <Breadcrumb.Item key={index}>
                        <a
                            onClick={() => {
                                const subPath = "/" + pathSegments.slice(0, index + 1).join("/")
                                loadFiles(subPath)
                            }}
                        >
                            {seg}
                        </a>
                    </Breadcrumb.Item>
                ))}
            </Breadcrumb>

            <Search
                placeholder="Search file name"
                enterButton="Search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={handleSearch}
                style={{ marginBottom: 16 }}
            />

            <List
                size="small"
                style={{
                    height: "50vh",
                    overflowY: "auto"
                }}
                bordered
                dataSource={files}
                locale={{ emptyText: "No files" }}
                renderItem={(file) => (
                    <List.Item
                        actions={
                            file.is_dir
                                ? [<Button size="small" onClick={() => handleNavigate(file.name)}>Enter</Button>]
                                : [
                                    <Button type="link" size="small" onClick={() => handleOpenFile(file)}>
                                       Open
                                    </Button>,
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={`/brave-api/file-operation/download?path=${encodeURIComponent(resolveFilePath(file.name))}`}
                                        target="_blank"
                                    >
                                        Download
                                    </Button>,
                                    <Button type="link" size="small" onClick={() => handleSelectFile(file)}>
                                        Add To
                                    </Button>,
                                ]
                        }
                    >
                        <List.Item.Meta
                            avatar={file.is_dir ? <FolderOutlined /> : <FileOutlined />}
                            title={
                                <Text
                                    strong
                                    style={{ cursor: file.is_dir ? "pointer" : "default" }}
                                    onClick={() => file.is_dir && handleNavigate(file.name)}
                                >
                                    {file.name}
                                </Text>
                            }
                            description={
                                !file.is_dir && <Text type="secondary">{(file.size! / 1024).toFixed(1)} KB</Text>
                            }
                        />
                    </List.Item>
                )}
            />

            <Pagination
                style={{ marginTop: "1rem", textAlign: "center" }}
                current={page}
                total={total}
                pageSize={limit}
                onChange={(pageNum) => loadFiles(currentPath, keyword, pageNum)}
                showSizeChanger={false}
            />
        </Card>
    )
}


export default SysFileBrowser

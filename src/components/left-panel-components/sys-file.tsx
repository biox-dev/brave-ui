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


import React, { FC, useEffect, useRef, useState } from "react";
import { Breadcrumb, Button, Card, Input, List, Pagination, Popconfirm, Space, Tooltip, Typography, message } from "antd";
const { Search } = Input
const { Text } = Typography
type FileItem = {
    name: string;
    is_dir: boolean;
    size?: number;
    modified: number;
};
import { FolderOutlined, FileOutlined, DownloadOutlined, ReloadOutlined, UploadOutlined, FileAddOutlined, FolderAddOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons"
import { useSelector } from "react-redux";
import { openFileByPath } from "@/utils/file-open";
import { http } from "@/api/client/http";

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
    const [loading, setLoading] = useState(false)
    const uploadInputRef = useRef<HTMLInputElement | null>(null)
    const [messageApi, messageContextHolder] = message.useMessage()
    const limit = 100
    const { project } = useSelector((state: any) => state.user);

    const loadFiles = async (
        pathVal: string = currentPath,
        keywordVal: string = keyword,
        pageNum: number = page
    ) => {
        try {
            setLoading(true)
            const res = await http.get(`/file/list-project-dir`, {
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
            setCurrentPath(res.data.dir || pathVal)
            setPage(pageNum)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to load files")
        } finally {
            setLoading(false)
        }
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

    const handleCreateFolder = async () => {
        const folderName = window.prompt("Folder name")
        if (!folderName) {
            return
        }
        const targetPath = joinPath(currentPath, folderName)
        try {
            await http.post("/file/create-dir", {
                path: targetPath,
                type,
            })
            messageApi.success("Folder created")
            loadFiles(currentPath, keyword, 1)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to create folder")
        }
    }

    const handleCreateFile = async () => {
        const fileName = window.prompt("File name")
        if (!fileName) {
            return
        }
        try {
            await http.post("/file/create-file", {
                path: currentPath,
                name: fileName,
                content: "",
                overwrite: false,
                type,
            })
            messageApi.success("File created")
            loadFiles(currentPath, keyword, 1)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to create file")
        }
    }

    const handleDelete = async (file: FileItem) => {
        try {
            await http.post("/file/delete", {
                path: joinPath(currentPath, file.name),
                type,
            })
            messageApi.success("Deleted")
            loadFiles(currentPath, keyword, 1)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to delete")
        }
    }

    const handleRename = async (file: FileItem) => {
        const nextName = window.prompt("New name", file.name)
        if (!nextName || nextName === file.name) {
            return
        }
        try {
            await http.post("/file/move", {
                source_path: joinPath(currentPath, file.name),
                target_path: joinPath(currentPath, nextName),
                overwrite: false,
                type,
            })
            messageApi.success("Renamed")
            loadFiles(currentPath, keyword, 1)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to rename")
        }
    }

    const handleUploadClick = () => {
        uploadInputRef.current?.click()
    }

    const handleUploadFile: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
        const file = event.target.files?.[0]
        if (!file) {
            return
        }
        const formData = new FormData()
        formData.append("file", file)
        formData.append("path", currentPath)
        formData.append("type", type)
        try {
            await http.post("/file/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            messageApi.success("Uploaded")
            loadFiles(currentPath, keyword, 1)
        } catch (e: any) {
            messageApi.error(e?.response?.data?.message || "Failed to upload")
        } finally {
            event.target.value = ""
        }
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
        openFileByPath({
            filePath,
            title: file.name,
            url: `/file/download?path=${encodeURIComponent(filePath)}&type=${encodeURIComponent(type)}`,
        })
    }

    const pathSegments = currentPath.split("/").filter(Boolean)

    return (
        <Card
            loading={loading}
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
                    <Button size="small" icon={<FolderAddOutlined />} onClick={handleCreateFolder}></Button>
                    <Button size="small" icon={<FileAddOutlined />} onClick={handleCreateFile}></Button>
                    <Button size="small" icon={<UploadOutlined />} onClick={handleUploadClick}></Button>
                    <input
                        ref={uploadInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleUploadFile}
                    />
                    {currentPath !== "/" && (
                        <Button size="small" onClick={handleBack}>Back</Button>
                    )}
                    {/* <Button size="small" color={"cyan"} variant="solid" icon={<ReloadOutlined />} onClick={() => loadFiles(path)} >
                    </Button> */}
                    <Button size="small" color={"cyan"} variant="solid" icon={<ReloadOutlined />} onClick={() => loadFiles(currentPath)} >
                        
                    </Button>
                </Space>
            }
        >
            {messageContextHolder}
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
                allowClear
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
                                    <Button type="link" icon={<FileOutlined />} size="small" onClick={() => handleOpenFile(file)}>
                                       Open
                                    </Button>,
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        href={`/file/download?path=${encodeURIComponent(resolveFilePath(file.name))}&type=${encodeURIComponent(type)}`}
                                        target="_blank"
                                    >
                                        
                                    </Button>,
                                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleRename(file)}>
                                    </Button>,
                                    // <Button type="link" size="small" onClick={() => handleSelectFile(file)}>
                                    //     Add To
                                    // </Button>,
                                    <Popconfirm
                                        title="Delete this file?"
                                        description={file.name}
                                        onConfirm={() => handleDelete(file)}
                                        okText="Delete"
                                        cancelText="Cancel"
                                    >
                                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                            
                                        </Button>
                                    </Popconfirm>,
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
                                !file.is_dir && <Text type="secondary">{((file.size || 0) / 1024).toFixed(1)} KB</Text>
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

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
import { Breadcrumb, Button, Input, List, Pagination, Popconfirm, Tooltip, message } from "antd";
import { useNavigate } from "react-router";
const { Search } = Input
type FileItem = {
    name: string;
    is_dir: boolean;
    size?: number;
    modified: number;
    url?: string;
};
import { FolderOutlined, FileOutlined, ReloadOutlined, UploadOutlined, FileAddOutlined, FolderAddOutlined, DeleteOutlined, EditOutlined, CloseOutlined, ArrowLeftOutlined } from "@ant-design/icons"
import { useSelector } from "react-redux";
import { http } from "@/api/client/http";

const joinPath = (basePath: string, name: string) => {
    if (!basePath || basePath === "/") {
        return `/${name}`
    }
    return `${basePath.replace(/\/+$/, "")}/${name}`
}






// path="/" type="data"

const SysFileBrowser: FC<any> = ({ type="data", path="/", onSelectFile, onClose }) => {
    const navigate = useNavigate()
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

    const handleOpenFile = (file: FileItem) => {
        if (!file.url) {
            messageApi.warning("File URL is missing")
            return
        }
        navigate(`/preview/file?url=${encodeURIComponent(file.url)}`)
    }

    const pathSegments = currentPath.split("/").filter(Boolean)

    return (
        <div className="project-report-panel">
            <div className="project-report-panel-header">
                <Tooltip title={dir}>
                    <span className="project-report-panel-title">Files</span>
                </Tooltip>
                <div className="project-report-panel-actions">
                    {onClose && (
                        <Tooltip title="Close">
                            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
                        </Tooltip>
                    )}
                    <Tooltip title="New Folder">
                        <Button type="text" size="small" icon={<FolderAddOutlined />} onClick={handleCreateFolder} />
                    </Tooltip>
                    <Tooltip title="New File">
                        <Button type="text" size="small" icon={<FileAddOutlined />} onClick={handleCreateFile} />
                    </Tooltip>
                    <Tooltip title="Upload">
                        <Button type="text" size="small" icon={<UploadOutlined />} onClick={handleUploadClick} />
                    </Tooltip>
                    <input
                        ref={uploadInputRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={handleUploadFile}
                    />
                    {currentPath !== "/" && (
                        <Tooltip title="Back">
                            <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={handleBack} />
                        </Tooltip>
                    )}
                    <Tooltip title="Refresh">
                        <Button
                            type="text"
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => loadFiles(currentPath)}
                        />
                    </Tooltip>
                </div>
            </div>

            <div className="project-report-panel-body" style={{ padding: "4px 8px" }}>
                {messageContextHolder}
                <Breadcrumb style={{ marginBottom: 4 }}>
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
                    size="small"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onSearch={handleSearch}
                    style={{ marginBottom: 4 }}
                />

                <List
                    size="small"
                    loading={loading}
                    dataSource={files}
                    locale={{ emptyText: "No files" }}
                    renderItem={(file) => (
                        <List.Item style={{ padding: 0, borderBottom: "none" }}>
                            <div className="project-report-item" style={{ width: "100%", padding: "5px 8px" }}>
                                {file.is_dir ? (
                                    <FolderOutlined className="project-report-item-icon" />
                                ) : (
                                    <FileOutlined className="project-report-item-icon" />
                                )}
                                <div
                                    className="project-report-item-text"
                                    style={{ cursor: file.is_dir ? "pointer" : "default" }}
                                    onClick={() => file.is_dir && handleNavigate(file.name)}
                                >
                                    <span className="project-report-item-title">{file.name}</span>
                                    {!file.is_dir && (
                                        <span className="project-report-item-meta">
                                            {((file.size || 0) / 1024).toFixed(1)} KB
                                        </span>
                                    )}
                                </div>
                                <span
                                    className="project-report-item-actions"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {file.is_dir ? (
                                        <Tooltip title="Enter">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<ArrowLeftOutlined rotate={180} />}
                                                onClick={() => handleNavigate(file.name)}
                                            />
                                        </Tooltip>
                                    ) : (
                                        <>
                                            <Tooltip title="Open">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<FileOutlined />}
                                                    onClick={() => handleOpenFile(file)}
                                                />
                                            </Tooltip>
                                            <Tooltip title="Rename">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<EditOutlined />}
                                                    onClick={() => handleRename(file)}
                                                />
                                            </Tooltip>
                                            <Popconfirm
                                                title="Delete this file?"
                                                description={file.name}
                                                onConfirm={() => handleDelete(file)}
                                                okText="Delete"
                                                cancelText="Cancel"
                                            >
                                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        </>
                                    )}
                                </span>
                            </div>
                        </List.Item>
                    )}
                />
            </div>

            <div style={{ padding: "6px 10px", borderTop: "1px solid var(--sharp-divider)" }}>
                <Pagination
                    size="small"
                    current={page}
                    pageSize={limit}
                    total={total}
                    showTotal={(t) => `${t} files`}
                    onChange={(pageNum) => loadFiles(currentPath, keyword, pageNum)}
                />
            </div>
        </div>
    )
}


export default SysFileBrowser

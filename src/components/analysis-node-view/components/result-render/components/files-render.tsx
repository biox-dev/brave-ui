import { Button, Typography, Collapse, Flex, Card, Space } from "antd";
import { FC } from "react";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";
import { addFileToDatasetApi } from "@/api/data";
import { openFileByPath } from "@/utils/file-open";


export const FilesRender: FC<any> = ({ name, analysis_node_id, files }) => {
    const message = useGlobalMessage()

    if (!files || !Array.isArray(files)) {
        return null
    }

    return <Collapse
        // style={{ marginBottom: "1rem" }}
        defaultActiveKey={[]}
        items={[
            {
                key: "analysis-files",
                label: `${name} (${files.length})`,
                children: (
                    <Flex vertical gap={8}>
                        {files.map((item: any, index: any) => {
                            const filePath = item?.filepath || item?.path || item?.url || ""
                            const fileName = item?.filename || filePath.split("/").pop() || `File ${index + 1}`
                            const url = item?.url
                            return (
                                <Card key={index} size="small" styles={{ body: { padding: "8px 12px" } }}>
                                    <Flex justify="space-between" align="center" gap={8} wrap>
                                        <Flex vertical>
                                            <Typography.Text strong>{fileName}</Typography.Text>
                                            <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                {filePath}
                                            </Typography.Text>
                                            <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                {url}
                                            </Typography.Text>
                                        </Flex>

                                        <Space>
                                            <Button
                                                size="small"
                                                type="default"
                                                onClick={() => {
                                                    if (!filePath) {
                                                        message.error("Invalid file path")
                                                        return
                                                    }
                                                    openFileByPath({ filePath, title: fileName, url })
                                                }}
                                            >
                                                Open
                                            </Button>
                                            <Button
                                                size="small"
                                                color="cyan"
                                                variant="solid"
                                                onClick={async () => {
                                                    if (!filePath) {
                                                        message.error("Invalid file path")
                                                        return
                                                    }
                                                    try {
                                                        const dataset = await invoke.datasetProjectPage.openDrawerAsync({}, {
                                                            width: 600,
                                                            title: "Select Dataset"
                                                        })
                                                        const result = await invoke.selectFileRole.openDrawerAsync(
                                                  
                                                            { defaultFileName: fileName,path:filePath },
                                                            { width: 450, title: analysis_node_id ? `Add File to Dataset (${analysis_node_id})` : "Add File to Dataset" }
                                                        )
                                                        const params = {
                                                            dataset_id: dataset.id,
                                                            analysis_node_id:analysis_node_id,
                                                            path: result.path,
                                                            source: "analysis",
                                                            role: result.role,
                                                            is_prefix: result.is_prefix,
                                                            file_name: result.file_name || undefined,
                                                            is_copy: result.is_copy,
                                                            
                                                        }
                                                        await addFileToDatasetApi(params)
                                                        message.success("File added to analysis results")
                                                    } catch (error) {
                                                        console.log("Dataset selection cancelled or failed", error)
                                                    }
                                                }}
                                            >
                                                Add To
                                            </Button>
                                        </Space>
                                    </Flex>
                                </Card>
                            )
                        })}
                    </Flex>
                ),
            },
        ]}
    />
}

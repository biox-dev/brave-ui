import { Button, Typography, Collapse, Flex, Card, Space, Skeleton } from "antd";
import { FC, useCallback, useEffect, useState } from "react";
import { RedoOutlined } from "@ant-design/icons";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";
import { addFileToDatasetApi, listFileByAnalysisNodeApi } from "@/api/data";
import { openFileByPath } from "@/utils/file-open";

/**
 * AnalysisNodeFilesRender renders the files owned by one analysis node
 * (go_file.analysis_node_id). Unlike FilesRender, which receives an already
 * resolved `files` array from the analysis result, this component fetches the
 * node's files itself through /data/file/list-by-analysis-node. The visual form
 * (collapsible card list with Open / Add To actions) mirrors FilesRender.
 */
export const AnalysisNodeFilesRender: FC<{
    analysis_node_id?: string;
    name?: string;
}> = ({ analysis_node_id, name = "Files" }) => {
    const message = useGlobalMessage();
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const loadFiles = useCallback(async () => {
        if (!analysis_node_id) {
            setFiles([]);
            return;
        }
        setLoading(true);
        try {
            const response = await listFileByAnalysisNodeApi(analysis_node_id);
            setFiles(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.log("Failed to load analysis node files", error);
        } finally {
            setLoading(false);
        }
    }, [analysis_node_id]);

    useEffect(() => {
        void loadFiles();
    }, [loadFiles]);

    if (!analysis_node_id) {
        return null;
    }

    return (
        <Collapse
            defaultActiveKey={[]}
            items={[
                {
                    key: "analysis-node-files",
                    label: `${name} (${files.length})`,
                    extra: (
                        <Button
                            size="small"
                            type="text"
                            icon={<RedoOutlined />}
                            loading={loading}
                            onClick={(e) => {
                                e.stopPropagation();
                                void loadFiles();
                            }}
                        />
                    ),
                    children: loading ? (
                        <Skeleton active paragraph={{ rows: 2 }} />
                    ) : files.length === 0 ? (
                        <Typography.Text type="secondary">No files</Typography.Text>
                    ) : (
                        <Flex vertical gap={8}>
                            {files.map((item: any, index: any) => {
                                const filePath = item?.filepath || item?.path || item?.url || "";
                                const fileName =
                                    item?.file_name ||
                                    item?.filename ||
                                    filePath.split("/").pop() ||
                                    `File ${index + 1}`;
                                const url = item?.url;
                                const role = item?.file_key || item?.role;
                                return (
                                    <Card key={item?.id ?? index} size="small" styles={{ body: { padding: "8px 12px" } }}>
                                        <Flex justify="space-between" align="center" gap={8} wrap>
                                            <Flex vertical>
                                                <Flex gap={6} align="center">
                                                    <Typography.Text strong>{fileName}</Typography.Text>
                                                    {role && (
                                                        <Typography.Text type="secondary">[{role}]</Typography.Text>
                                                    )}
                                                </Flex>
                                                <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                    {filePath}
                                                </Typography.Text>
                                                {url && (
                                                    <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                                                        {url}
                                                    </Typography.Text>
                                                )}
                                            </Flex>

                                            <Space>
                                                <Button
                                                    size="small"
                                                    type="default"
                                                    onClick={() => {
                                                        if (!filePath) {
                                                            message.error("Invalid file path");
                                                            return;
                                                        }
                                                        openFileByPath({ filePath, title: fileName, url });
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
                                                            message.error("Invalid file path");
                                                            return;
                                                        }
                                                        try {
                                                            const dataset = await invoke.datasetProjectPage.openDrawerAsync({}, {
                                                                width: 600,
                                                                title: "Select Dataset",
                                                            });
                                                            const result = await invoke.selectFileRole.openDrawerAsync(
                                                                { defaultFileName: fileName, path: filePath },
                                                                {
                                                                    width: 450,
                                                                    title: analysis_node_id
                                                                        ? `Add File to Dataset (${analysis_node_id})`
                                                                        : "Add File to Dataset",
                                                                }
                                                            );
                                                            const params = {
                                                                dataset_id: dataset.id,
                                                                analysis_node_id,
                                                                path: result.path,
                                                                source: "analysis",
                                                                role: result.role,
                                                                is_prefix: result.is_prefix,
                                                                file_name: result.file_name || undefined,
                                                                is_copy: result.is_copy,
                                                            };
                                                            await addFileToDatasetApi(params);
                                                            message.success("File added to analysis results");
                                                        } catch (error) {
                                                            console.log("Dataset selection cancelled or failed", error);
                                                        }
                                                    }}
                                                >
                                                    Add To
                                                </Button>
                                            </Space>
                                        </Flex>
                                    </Card>
                                );
                            })}
                        </Flex>
                    ),
                },
            ]}
        />
    );
};

export default AnalysisNodeFilesRender;

import { deleteUserProjectApi, listProjectApi, updateProjectSharingApi, type ProjectItem } from "@/api/project";
import { Button, Flex, Popconfirm, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined } from "@ant-design/icons";
import { FC, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";
import { invoke } from "@/core/ui-system/invokeV2";

interface ProjectTableProps {
    onOk?: (value: ProjectItem) => void;
    onCancel?: () => void;
}

const ProjectTable: FC<ProjectTableProps> = ({ onOk, onCancel }) => {
    const [loading, setLoading] = useState(false);
    const [projectList, setProjectList] = useState<ProjectItem[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>();
    const currentProjectId = useSelector((state: any) => state.user.projectId);

    const selectedProject = useMemo(
        () => projectList.find((item) => item.project_id === selectedProjectId),
        [projectList, selectedProjectId]
    );

    const loadProjectList = async () => {
        setLoading(true);
        try {
            const resp = await listProjectApi();
            const rows = Array.isArray(resp.data) ? resp.data : [];
            setProjectList(rows);
            if (rows.length > 0) {
                const preferred = rows.find((item) => item.project_id === currentProjectId);
                setSelectedProjectId(preferred ? preferred.project_id : rows[0].project_id);
            } else {
                setSelectedProjectId(undefined);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (projectId: string) => {
        try {
            await deleteUserProjectApi({ project_id: projectId });
            getGlobalMessage()?.success("Project removed successfully");
            if (selectedProjectId === projectId) {
                setSelectedProjectId(undefined);
            }
            await loadProjectList();
        } catch (error) {
            // Error message is shown globally by the http interceptor.
        }
    };

    const handleToggleSharing = async (projectId: string, enabled: boolean) => {
        try {
            await updateProjectSharingApi({ project_id: projectId, enabled });
            getGlobalMessage()?.success(enabled ? "Project sharing enabled" : "Project sharing disabled");
            await loadProjectList();
        } catch (error) {
            // Error message is shown globally by the http interceptor.
        }
    };

    const handleAddProject = async () => {
        try {
            await invoke.addProjectModal.openAsync(undefined, {
                title: "Add Project",
                width: 480,
                footer: null,
            });
            await loadProjectList();
        } catch (error) {
            // User canceled the add-project modal.
        }
    };

    const columns: ColumnsType<ProjectItem> = [
        {
            title: "Project Name",
            dataIndex: "project_name",
            key: "project_name",
        },
        {
            title: "Project ID",
            dataIndex: "project_id",
            key: "project_id",
        },
        {
            title: "Share",
            dataIndex: "share_enabled",
            key: "share_enabled",
            width: 100,
            render: (enabled: boolean) =>
                enabled ? <Tag color="green">Enabled</Tag> : <Tag>Disabled</Tag>,
        },
        {
            title: "Share Code",
            dataIndex: "share_code",
            key: "share_code",
            render: (code: string) => code || "-",
        },
        {
            title: "Actions",
            key: "actions",
            width: 160,
            render: (_, record) => (
                <span onClick={(e) => e.stopPropagation()}>
                    <Flex gap="small" align="center">
                        <Button
                            type="link"
                            size="small"
                            onClick={() => handleToggleSharing(record.project_id, !record.share_enabled)}
                        >
                            {record.share_enabled ? "Unshare" : "Share"}
                        </Button>
                        <Popconfirm
                            title="Remove this project?"
                            description="The project will be removed from your project list."
                            okText="Yes"
                            cancelText="No"
                            onConfirm={() => handleDelete(record.project_id)}
                        >
                            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                Delete
                            </Button>
                        </Popconfirm>
                    </Flex>
                </span>
            ),
        },
    ];

    useEffect(() => {
        loadProjectList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 当当前项目异步加载完成后，若列表中存在则同步选中
    useEffect(() => {
        if (!currentProjectId) return;
        if (projectList.some((item) => item.project_id === currentProjectId)) {
            setSelectedProjectId(currentProjectId);
        }
    }, [currentProjectId, projectList]);

    return (
        <Flex vertical gap="middle">
            <Table<ProjectItem>
                rowKey="project_id"
                columns={columns}
                dataSource={projectList}
                loading={loading}
                size="small"
                pagination={false}
                scroll={{ y: 320 }}
                rowSelection={{
                    type: "radio",
                    selectedRowKeys: selectedProjectId ? [selectedProjectId] : [],
                    onChange: (selectedRowKeys) => {
                        setSelectedProjectId(selectedRowKeys[0] as string);
                    },
                }}
                onRow={(record) => ({
                    onClick: () => setSelectedProjectId(record.project_id),
                })}
            />

            <Flex justify="space-between" gap="small">
                <Button onClick={handleAddProject}>Add Project</Button>
                <Flex gap="small">
                    <Button onClick={() => onCancel && onCancel()}>Cancel</Button>
                    <Button
                        type="primary"
                        disabled={!selectedProject}
                        onClick={() => {
                            if (selectedProject) {
                                onOk && onOk(selectedProject);
                            }
                        }}
                    >
                        Confirm
                    </Button>
                </Flex>
            </Flex>
        </Flex>
    );
};

export default ProjectTable;
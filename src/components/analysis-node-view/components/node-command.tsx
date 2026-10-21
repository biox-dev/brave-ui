import { Alert, Button, Flex, Popconfirm, Skeleton, Space, Tooltip, Typography } from "antd";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { http } from "@/api/client/http";
import { MonacoEditor } from "@/components/react-monaco-editor";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/**
 * View / edit the generated run.sh of one analysis node.
 *
 * Backed by GET/POST /analysis/:analysisNodeId/command, which reads and writes
 * AnalysisNode.command_path on the server (no client-side absolute paths).
 */
export interface NodeCommandProps {
    /** Analysis node DB primary key (AnalysisNode.id). */
    analysis_node_id?: string;
    node_name?: string;
    close?: () => void;
}

const NodeCommand: FC<NodeCommandProps> = ({ analysis_node_id, node_name, close }) => {
    const message = useGlobalMessage();
    const editorRef = useRef<any>(null);
    const contentRef = useRef("");
    // Last content known to be on disk; used to compute the dirty flag.
    const savedRef = useRef("");
    const [path, setPath] = useState("");
    const [content, setContent] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = async () => {
        if (!analysis_node_id) {
            setNotice("analysis_node_id is required");
            return;
        }
        setLoading(true);
        setNotice("");
        try {
            const resp = await http.get(`/analysis/${analysis_node_id}/command`);
            const data = resp.data || {};
            const text = typeof data.content === "string" ? data.content : "";
            setPath(String(data.command_path || ""));
            savedRef.current = text;
            contentRef.current = text;
            setContent(text);
            setDirty(false);
            if (!data.exists) {
                setNotice(
                    "run.sh does not exist yet. It is generated when the node is prepared (before its first run)."
                );
            }
        } catch (error: any) {
            savedRef.current = "";
            contentRef.current = "";
            setContent("");
            setDirty(false);
            setNotice(error?.message || "Failed to load run.sh");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, [analysis_node_id]);

    const save = useCallback(async () => {
        if (!analysis_node_id) {
            message.error("analysis_node_id is required");
            return;
        }
        const text = editorRef.current?.getValue?.() ?? contentRef.current;
        setSaving(true);
        try {
            await http.post(`/analysis/${analysis_node_id}/command`, { content: text });
            savedRef.current = text;
            contentRef.current = text;
            setContent(text);
            setDirty(false);
            setNotice("");
            message.success("run.sh saved");
        } catch {
            // 错误已由全局 axios 拦截器提示。
        } finally {
            setSaving(false);
        }
    }, [analysis_node_id, message]);

    // Ctrl/Cmd+S saves, same shortcut as the script editor.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                void save();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [save]);

    const handleChange = (value: string | undefined) => {
        const next = value ?? "";
        contentRef.current = next;
        setContent(next);
        setDirty(next !== savedRef.current);
    };

    return (
        <Flex vertical gap={12}>
            <Flex justify="space-between" align="center" gap={12} wrap>
                <Flex vertical gap={4} style={{ minWidth: 0 }}>
                    <Typography.Text strong>{node_name || "run.sh"}</Typography.Text>
                    <Typography.Text
                        type="secondary"
                        copyable={path ? { text: path } : false}
                        style={{ wordBreak: "break-all" }}
                    >
                        {path || "command_path is empty"}
                    </Typography.Text>
                </Flex>
                <Space>
                    <Popconfirm
                        title="Discard unsaved changes?"
                        disabled={!dirty}
                        onConfirm={() => void load()}
                    >
                        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => {
                            if (!dirty) {
                                void load();
                            }
                        }}>
                            Reload
                        </Button>
                    </Popconfirm>
                    <Tooltip title="Save run.sh (Ctrl/Cmd+S)">
                        <Button
                            size="small"
                            color="cyan"
                            variant="solid"
                            icon={<SaveOutlined />}
                            loading={saving}
                            disabled={!analysis_node_id || loading}
                            onClick={() => void save()}
                        >
                            {dirty ? "Save *" : "Save"}
                        </Button>
                    </Tooltip>
                </Space>
            </Flex>

            {notice && <Alert type="warning" showIcon message={notice} />}

            {loading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
                <MonacoEditor
                    value={content}
                    onChange={handleChange}
                    editorRef={editorRef}
                    defaultLanguage="shell"
                    height="60vh"
                />
            )}

            <Flex justify="space-between" align="center" gap={8} wrap>
                <Typography.Text type="secondary">
                    Saving writes run.sh on disk; command nodes also persist it as their stored command. Script nodes
                    regenerate run.sh before the next run.
                </Typography.Text>
                {close && (
                    <Button size="small" onClick={close}>
                        Close
                    </Button>
                )}
            </Flex>
        </Flex>
    );
};

export default NodeCommand;

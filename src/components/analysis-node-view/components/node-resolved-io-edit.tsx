import { Alert, Button, Flex, Space, Tabs, Tooltip, Typography } from "antd";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { http } from "@/api/client/http";
import { MonacoEditor } from "@/components/react-monaco-editor";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";

/**
 * Edit one analysis node's resolved_inputs / resolved_outputs.
 *
 * Backed by POST /analysis/:analysisNodeId/resolved-io, which writes
 * analysis_nodes.resolved_inputs / resolved_outputs directly. Both values are
 * JSON objects; the modal validates them in the browser before saving.
 */
export interface NodeResolvedIOEditProps {
    /** Analysis node payload (AnalysisNode.id is the DB primary key). */
    node?: any;
    /** Fallback when only the DB primary key is known. */
    analysis_node_id?: string | number;
    node_name?: string;
    /** Called after a successful save so the caller can refresh its detail view. */
    onSaved?: () => void;
    close?: () => void;
}

type JsonParseResult =
    | { ok: true; value: Record<string, any> }
    | { ok: false; error: string };

/** Pretty-print a JSON value; non-object values fall back to an empty object. */
const formatJSON = (value: any): string => {
    if (value === null || value === undefined) {
        return "{}";
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return "{}";
    }
};

/** Parse the editor text into a JSON object, allowing blank input as {}. */
const parseJSONObject = (text: string): JsonParseResult => {
    const raw = text.trim();
    if (raw === "") {
        return { ok: true, value: {} };
    }
    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch (error: any) {
        return { ok: false, error: error?.message || "Invalid JSON" };
    }
    if (parsed === null) {
        return { ok: true, value: {} };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Root value must be a JSON object" };
    }
    return { ok: true, value: parsed };
};

const NodeResolvedIOEdit: FC<NodeResolvedIOEditProps> = ({
    node,
    analysis_node_id,
    node_name,
    onSaved,
    close,
}) => {
    const message = useGlobalMessage();
    const nodeId = useMemo(
        () => String(analysis_node_id ?? node?.id ?? ""),
        [analysis_node_id, node?.id]
    );

    const [activeKey, setActiveKey] = useState<string>("inputs");
    const [inputsText, setInputsText] = useState("{}");
    const [outputsText, setOutputsText] = useState("{}");
    const [savedInputsText, setSavedInputsText] = useState("{}");
    const [savedOutputsText, setSavedOutputsText] = useState("{}");
    const [errorText, setErrorText] = useState("");
    const [saving, setSaving] = useState(false);
    const inputsRef = useRef<any>(null);
    const outputsRef = useRef<any>(null);

    // Seed the editors from the node payload the caller already has.
    const seed = useCallback(() => {
        const nextInputs = formatJSON(node?.resolved_inputs);
        const nextOutputs = formatJSON(node?.resolved_outputs);
        setInputsText(nextInputs);
        setOutputsText(nextOutputs);
        setSavedInputsText(nextInputs);
        setSavedOutputsText(nextOutputs);
        setErrorText("");
    }, [node?.resolved_inputs, node?.resolved_outputs]);

    useEffect(() => {
        seed();
    }, [seed]);

    const dirty = inputsText !== savedInputsText || outputsText !== savedOutputsText;
    const hasNode = nodeId !== "" && nodeId !== "0";

    const save = useCallback(async () => {
        if (!hasNode) {
            message.error("analysis_node_id is required");
            return;
        }

        // 以编辑器当前值为准：受控 value 与 onChange 之间可能有一帧延迟。
        const currentInputs = inputsRef.current?.getValue?.() ?? inputsText;
        const currentOutputs = outputsRef.current?.getValue?.() ?? outputsText;

        const parsedInputs = parseJSONObject(currentInputs);
        if (!parsedInputs.ok) {
            setActiveKey("inputs");
            setErrorText(`resolved_inputs: ${parsedInputs.error}`);
            return;
        }
        const parsedOutputs = parseJSONObject(currentOutputs);
        if (!parsedOutputs.ok) {
            setActiveKey("outputs");
            setErrorText(`resolved_outputs: ${parsedOutputs.error}`);
            return;
        }

        setErrorText("");
        setSaving(true);
        try {
            await http.post(`/analysis/${nodeId}/resolved-io`, {
                resolved_inputs: parsedInputs.value,
                resolved_outputs: parsedOutputs.value,
            });
            const nextInputs = formatJSON(parsedInputs.value);
            const nextOutputs = formatJSON(parsedOutputs.value);
            setInputsText(nextInputs);
            setOutputsText(nextOutputs);
            setSavedInputsText(nextInputs);
            setSavedOutputsText(nextOutputs);
            message.success("Resolved IO saved");
            onSaved?.();
        } catch {
            // 错误已由全局 axios 拦截器提示。
        } finally {
            setSaving(false);
        }
    }, [hasNode, inputsText, message, nodeId, onSaved, outputsText]);

    // Ctrl/Cmd+S saves, same shortcut as the run.sh editor.
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

    return (
        <Flex vertical gap={12}>
            <Flex justify="space-between" align="center" gap={12} wrap>
                <Flex vertical gap={4} style={{ minWidth: 0 }}>
                    <Typography.Text strong>{node_name || node?.node_name || "Resolved IO"}</Typography.Text>
                    <Typography.Text type="secondary" style={{ wordBreak: "break-all" }}>
                        analysis_node_id: {nodeId || "-"}
                    </Typography.Text>
                </Flex>
                <Space>
                    <Tooltip title="Discard unsaved changes">
                        <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            disabled={!dirty || saving}
                            onClick={seed}
                        >
                            Reset
                        </Button>
                    </Tooltip>
                    <Tooltip title="Save resolved IO (Ctrl/Cmd+S)">
                        <Button
                            size="small"
                            color="cyan"
                            variant="solid"
                            icon={<SaveOutlined />}
                            loading={saving}
                            disabled={!hasNode}
                            onClick={() => void save()}
                        >
                            {dirty ? "Save *" : "Save"}
                        </Button>
                    </Tooltip>
                </Space>
            </Flex>

            {!hasNode && <Alert type="warning" showIcon message="analysis_node_id is required" />}
            {errorText && <Alert type="error" showIcon message={errorText} />}

            <Tabs
                activeKey={activeKey}
                onChange={setActiveKey}
                items={[
                    {
                        key: "inputs",
                        label: `Resolved Inputs${inputsText !== savedInputsText ? " *" : ""}`,
                        children: (
                            <MonacoEditor
                                value={inputsText}
                                onChange={(value: string | undefined) => setInputsText(value ?? "")}
                                editorRef={inputsRef}
                                defaultLanguage="json"
                                height="55vh"
                            />
                        ),
                    },
                    {
                        key: "outputs",
                        label: `Resolved Outputs${outputsText !== savedOutputsText ? " *" : ""}`,
                        children: (
                            <MonacoEditor
                                value={outputsText}
                                onChange={(value: string | undefined) => setOutputsText(value ?? "")}
                                editorRef={outputsRef}
                                defaultLanguage="json"
                                height="55vh"
                            />
                        ),
                    },
                ]}
            />

            <Flex justify="space-between" align="center" gap={8} wrap>
                <Typography.Text type="secondary">
                    Saving overwrites the node's stored IO contract. Both tabs must contain a JSON object.
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

export default NodeResolvedIOEdit;

import { Button, Collapse, Typography } from "antd";
import { FC, useCallback, useEffect, useState } from "react";
import { RedoOutlined } from "@ant-design/icons";
import { http } from "@/api/client/http";

/**
 * NodeParamsRender renders the runtime params of one analysis node inside a
 * collapsible panel, mirroring the visual form of FilesRender /
 * AnalysisNodeFilesRender.
 *
 * Unlike those components it does NOT fetch on mount: params are only loaded
 * when the panel is first expanded (lazy load). The refresh button in the
 * panel header reloads them on demand.
 */
export const NodeParamsRender: FC<{
    analysis_node_id?: string;
    name?: string;
}> = ({ analysis_node_id, name = "Params" }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [activeKey, setActiveKey] = useState<string[]>([]);

    const loadParams = useCallback(async () => {
        if (!analysis_node_id) {
            setData(null);
            setLoaded(false);
            return;
        }
        setLoading(true);
        try {
            const res = await http.get(`/analysis/${analysis_node_id}/node-params`);
            setData(res.data);
            setLoaded(true);
        } catch (error) {
            console.log("Failed to load node params", error);
        } finally {
            setLoading(false);
        }
    }, [analysis_node_id]);

    // Reset cached params when the target node changes.
    useEffect(() => {
        setData(null);
        setLoaded(false);
    }, [analysis_node_id]);

    const handleChange = useCallback(
        (keys: string[]) => {
            setActiveKey(keys);
            // Lazy load: only fetch the first time the panel is expanded.
            if (keys.includes("node-params") && !loaded && !loading) {
                void loadParams();
            }
        },
        [loaded, loading, loadParams]
    );

    if (!analysis_node_id) {
        return null;
    }

    return (
        <Collapse
            activeKey={activeKey}
            onChange={handleChange}
            items={[
                {
                    key: "node-params",
                    label: name,
                    extra: (
                        <Button
                            size="small"
                            type="text"
                            icon={<RedoOutlined />}
                            loading={loading}
                            onClick={(e) => {
                                e.stopPropagation();
                                void loadParams();
                            }}
                        />
                    ),
                    children: loading && !loaded ? (
                        <Typography.Text type="secondary">Loading...</Typography.Text>
                    ) : (
                        <Typography>
                            <pre
                                style={{
                                    margin: 0,
                                    maxHeight: 400,
                                    overflow: "auto",
                                    wordBreak: "break-all",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {JSON.stringify(data ?? {}, null, 2)}
                            </pre>
                        </Typography>
                    ),
                },
            ]}
        />
    );
};

export default NodeParamsRender;

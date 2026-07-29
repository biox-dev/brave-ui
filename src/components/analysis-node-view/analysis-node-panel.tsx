import { http } from "@/api/client/http";
import { useStoreRender } from "@/context/render/RenderProvider";
import { ViewRegistry } from "@/core/component-registry/registry-types";
import ViewResolver from "@/core/ui-renderer/ViewResolver";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { renderCloseViewButton, renderViewButton } from "@/utils/render-view-btn";
import { Button, Card, Divider, Flex, Popconfirm, Space, Switch } from "antd";
import axios from "axios";
import { FC, useEffect, useState } from "react";
import { useNavigate } from "react-router";

type AnalysisNodePanelView = "analysisNodesReport" | "analysisNodes" | "analysisEdges";

const AnalysisNodePanel: FC<any> = () => {
    const { openAnalysis, relation, analysisId, setAnalysisId, clear, setRelation, closeAnalysis, setFormParam } = useStoreRender()
    const message = useGlobalMessage()
    const [view, setView] = useState<AnalysisNodePanelView>("analysisNodesReport");
    const setPanelView = (nextView: string) => setView(nextView as AnalysisNodePanelView);
    const navigate = useNavigate()

    const [title, setTitle] = useState("")
    useEffect(() => {
        return () => {
            setAnalysisId(null)
        }
    }, [])
    return <Card size="small"
        variant="borderless"
        title={title}
        extra={<Space>
            {/* {relation?.relation_id && <Button size="small" color="primary" variant="solid" onClick={() =>
                navigate(`/c/tools/${relation?.relation_id}`)
            }>Go tools</Button>} */}
            <Button
                size="small"
                // color="cyan"
                variant="solid"
                onClick={async () => {
                    await http.post(`/analysis/publish-to-doc/${analysisId}`)
                    message.success("copy success!")
                }}
            >
                Publish Doc
            </Button>

            {renderViewButton(view, setPanelView, "analysisNodesReport", "Report")}

            {renderViewButton(view, setPanelView, "analysisNodes", "Nodes")}

            {renderViewButton(view, setPanelView, "analysisEdges", "Edges")}
        </Space>}

    >
        {/* 
        <ViewResolver
            // setTitle={setTitle}
            // analysis_id={analysisId}
            view={"analysisNodesReport"}>
        </ViewResolver> */}


        {analysisId ? (<>

            <div style={{ marginBottom: "0.5rem" }}>
                <ViewResolver view="analysisNodeSnapshot" analysis_id={analysisId}></ViewResolver>
            </div>
            <ViewResolver
                setTitle={setTitle}
                analysis_id={analysisId}
                view={view}
            ></ViewResolver>
        </>

        ) : null}
    </Card>

}

export default AnalysisNodePanel;
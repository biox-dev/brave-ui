import { FC, useEffect } from "react";
import { useParams } from "react-router";
import AnalysisNodeDetails from "../../components/analysis-node-view/components/analysis-nodes-report/analysis-node-details";
import { setLLMEnv } from "@/utils/llm-env";
import { useSideViewContext } from "@/context/side/SideViewContext";
import { useI18n } from "@/hooks/useI18n";
import { useStoreRender } from "@/context/render/RenderProvider";

const AnalysisNodeReportRoute: FC = () => {
  const { analysisNodeId } = useParams<{ analysisNodeId: string }>();

  if (!analysisNodeId) {
    return null;
  }
  // const { locale } = useI18n();

  // const { setSideView, setSideOptions } = useSideViewContext();

  // useEffect(() => {
  //   setSideOptions([

  //     { label: locale === 'en_US' ? 'Parameters' : '参数', value: 'editParamsPanel' }

  //   ])
  //   // setSideView("editParamsPanel");
  //   return () => {
  //     setSideOptions([])
  //     setSideView("llm-card")
  //   }
  // }, [])
  const { setAnalysisNodeId } = useStoreRender()
  useEffect(() => {
    setLLMEnv(analysisNodeId, "analysisNodeId");
    setAnalysisNodeId(analysisNodeId)

  }, [analysisNodeId]);

  return <AnalysisNodeDetails analysis_node_id={analysisNodeId} />;
};

export default AnalysisNodeReportRoute;

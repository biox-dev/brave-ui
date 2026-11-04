import { FC, useEffect } from "react";
import { useParams } from "react-router";
import AnalysisNodeDetails from "../../components/analysis-node-view/components/analysis-nodes-report/analysis-node-details";
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
    setAnalysisNodeId(analysisNodeId)

    return () => {
      setAnalysisNodeId(null)
    }

  }, [analysisNodeId]);

  // viewFromRoute：当前路由自带视图段（/:view?），让详情里的 ViewResolver 视图从 URL 读取并写回 URL，
  // 刷新 / 前进后退 / 标签页切换都不会丢掉「正在看 Code 还是 Result」这类状态。
  return <AnalysisNodeDetails analysis_node_id={analysisNodeId} viewFromRoute />;
};

export default AnalysisNodeReportRoute;

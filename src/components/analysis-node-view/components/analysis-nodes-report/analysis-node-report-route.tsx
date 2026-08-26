import { FC } from "react";
import { useParams } from "react-router";
import AnalysisNodeDetails from "./analysis-node-details";

const AnalysisNodeReportRoute: FC = () => {
  const { analysisNodeId } = useParams<{ analysisNodeId: string }>();

  if (!analysisNodeId) {
    return null;
  }

  return <AnalysisNodeDetails analysis_node_id={analysisNodeId} />;
};

export default AnalysisNodeReportRoute;

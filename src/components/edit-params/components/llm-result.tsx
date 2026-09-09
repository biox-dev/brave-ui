import AI from "@/components/chat/ai";
import { FC } from "react";
import { Card, Col, Row } from "antd";
import Code from "@/components/script/code";

const LLMAnalysis: FC<any> = ({ analysis_id}) => {

    // return   <AI biz_type={component_type} biz_id={component?.component_id}></AI>
    return <AI biz_type={"analysis"} biz_id={analysis_id}></AI>

}

export default LLMAnalysis
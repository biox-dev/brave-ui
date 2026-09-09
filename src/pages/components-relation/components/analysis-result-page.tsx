import { CreateOrUpdatePipeline } from "@/components/create-pipeline"
import Code from "@/components/script/code"
import { Card, Empty, Segmented } from "antd"
import { FC, useEffect, useState } from "react"
import AnalysisResultPage from "@/components/result-list/page";
import AnalysisResult from "@/pages/analysis-result";

const AnalysisResultPageAdapter: FC<any> = ({ component, callback, openModal, panel, component_type }) => {

    return <>

        <AnalysisResultPage
                title="Analysis Results"

                setComponent={() => { }}
                component={component}
                params={{ component_id: component?.component_id }}
          

            ></AnalysisResultPage>
        {/* {panel === "structure" && <CreateOrUpdatePipeline
            callback={callback}
            structure={{
                component_type: component_type,
            }}
            data={component}
        ></CreateOrUpdatePipeline>}

        {panel === "files" && <>
            <AnalysisResultPage
                title="Analysis Results"

                setComponent={() => { }}
                component={component}
                params={{ component_id: component?.component_id }}
          

            ></AnalysisResultPage>
        </>} */}
    </>
}

export default AnalysisResultPageAdapter
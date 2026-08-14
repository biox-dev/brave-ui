import AnalysisList from '@/components/analysis-list';
import AnalysisPanel, { CreateAnalysisComp, UpstreamAnalysisInput, UpstreamAnalysisOutput } from '@/components/analysis-sotware-panel'
import { FC, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import ComponentsDetailsRender from '../../../core/ui-renderer/ComponentsDetailsRender';
import { Card, Col, Row, Segmented } from 'antd';
import ViewResolver from '@/core/ui-renderer/ViewResolver';

const AnalysisToolsComp = ({ operatePipeline, analysisId,component,panelView }: any) => {
    // const { project } = useOutletContext<any>()
    const [rightPanel, setRightPanel] = useState<any>("editParamsPanel")
    // const { analysisId, toolsPanelView, setRelation } = useStoreRender()

   

    // 


    return <div style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
        {/* {JSON.stringify(requestParam)} */}
        <ViewResolver
                    analysis_id={analysisId}
                    relation_id={component?.relation_id}
                    operatePipeline={operatePipeline}
                    // project={project}
                    component={component}
                    view={panelView}
                />
        {/* <Row  >
            <Col lg={16} sm={16} xs={24} style={{ paddingRight: "0.5rem" }}>
                <ViewResolver
                    analysis_id={analysisId}
                    relation_id={component?.relation_id}
                    operatePipeline={operatePipeline}
                    project={project}
                    component={component}
                    view={panelView}
                />
           
            </Col>
            <Col lg={8} sm={8} xs={24}>
                <Card

                    size="small"
                    extra={<>
                        <Segmented size="small" value={rightPanel}
                            onChange={(val: any) => setRightPanel(val)}
                            options={[
                                {
                                    label: "Parameters",
                                    value: "editParamsPanel"
                                },
                           
                                {
                                    label: "Description",
                                    value: "description"
                                }
                            ]} />
                    </>}
                >
                    <ViewResolver
                        analysisId={analysisId}
                        view={rightPanel}
                    />
                </Card>

            </Col>
        </Row> */}
      
    </div>


}


export default AnalysisToolsComp;
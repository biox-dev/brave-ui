import { CreateOrUpdatePipeline } from "@/components/create-pipeline"
import Code from "@/components/script/code"
import { Card, Empty, Popconfirm, Segmented, Space } from "antd"
import axios from "axios"
import { FC, useEffect, useState } from "react"
import { ApartmentOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
const ScriptV2: FC<any> = ({ component, callback, panel, openModal, component_type }) => {

    return <>
        {
            panel === "structure" && <CreateOrUpdatePipeline
                callback={callback}
                structure={{
                    component_type: component_type,
                }}
                data={component}
            ></CreateOrUpdatePipeline>
        }

        {panel === "code" && <Code component_id={component?.component_id}></Code>}



    </>

}

export default ScriptV2
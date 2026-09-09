import { Button, Drawer, Flex, message, Modal, Popconfirm, Tabs } from "antd"
import axios from "axios"
import { FC, useEffect, useRef, useState } from "react"
import { message as $message } from 'antd';
import TextArea from "antd/es/input/TextArea";
import Typography from "antd/es/typography/Typography";
import { MonacoEditor } from "../react-monaco-editor"
import Code from "../script/code";
const ModuleEdit: FC<any> = ({ visible, onClose, params, callback }) => {
    if (!visible) return null;

    return <>
        <Drawer

            title="View File"
            open={visible}
            onClose={onClose} width={"50%"}>
            <Code component_id={params.component_id}></Code>
        </Drawer>
    </>
}

export default ModuleEdit
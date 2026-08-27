import { Button, Input, Popover, Spin, Table, Image, Typography, Collapse, Flex, Card, Skeleton, Tag, Tabs, Row, Col, Popconfirm, Drawer, Form, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { FC, forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from "react";
import Markdown from '../markdown'
import axios from "axios";
import LogFile from "../log-file";
import { DeleteColumnOutlined, DeleteOutlined, QuestionCircleOutlined } from "@ant-design/icons"
import { MonacoEditor } from "../react-monaco-editor";
import { useNavigate, useOutletContext } from "react-router";
import { findAnalysisById, runAnalysisApi, stopAnalysisApi } from "@/api/analysisv1";
import { useModal, useModals } from "@/hooks/useModal";
// import FormJsonComp from "../form-components";
import ParamsView from "../params-view";
import Project from "@/pages/project";
import BioDatabaseForm from "../bio-database-form";
import BioDatabases from "../bio-databases";
import CreateOrUpdateParsms from "./components/create-or-update-parsms";
import EditParamsPanel from "./components/edit-params";

const EditParams: FC<any> = ({ visible, params, onClose, callback }) => {
    if (!visible) return null
    return <>

        <Drawer
            extra={<>

            </>}

            size="default" width={"50%"} open={visible} onClose={onClose} >
            {/* {JSON.stringify(addedProject)} */}

            <EditParamsPanel
                analysis_id={params} callback={() => {
                    onClose && onClose()
                    if (callback) {
                        callback()
                    }
                }}></EditParamsPanel>
        </Drawer>


    </>
}

export default EditParams


import { Button, Col, Input, Row, Space } from "antd"
import { FC, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { invoke } from "@/core/ui-system/invokeV2";
import { useComponentStore } from "@/store-zustand/components";
import StoreSidebar from "./components/store-sidebar";
import StoreContent from "./components/store-content";
import StorePages from "./components/store-pages";
const InstallComponents: FC<any> = ({ storeType, onOk, onCancel }) => {

    const message = useGlobalMessage()
    // const [address, setAddress] = useState("local")
    const [downloadParams, setDownloadParams] = useState<any>()
    const pageRef = useRef<any>(null)
    // const [cmd, setCmd] = useState<any>("")
    // const [selectedStoreId, setSelectedStoreId] = useState<string>()
    // const [sidebarRefreshToken, setSidebarRefreshToken] = useState(0)
    // const [contentRefreshToken, setContentRefreshToken] = useState(0)
    // const { register, unregister } = useComponentStore();

    // const instance = useMemo(() => {
    //     return {
    //         clone: () => {
    //             // loadData(storeId)
    //             // setContentRefreshToken((value) => value + 1)
    //             // setSidebarRefreshToken((value) => value + 1)
    //         }, pull: () => {
    //             // loadData(storeId)
    //             // setContentRefreshToken((value) => value + 1)
    //         }, stop: () => {
    //             // setSidebarRefreshToken((value) => value + 1)
    //         }
    //     };
    // }, []);


    // useEffect(() => {
    //     if (selectedStoreId) {
    //         register("store", selectedStoreId, instance);
    //         return () => {
    //             unregister("store", selectedStoreId, instance);
    //         };
    //     }
    // }, [selectedStoreId, instance, register, unregister]);

    return <>
        {/* <Button onClick={() => { console.log(useComponentStore.getState().print()) }}>componentStore</Button> */}
            {/* <Button onClick={() => { console.log(useComponentStore.getState().print()) }}>componentStore</Button> */}

        <Space.Compact style={{ width: '100%' }}>

            <Input placeholder="https://github.com/pybrave/enrichment-analysis.git"
                value={downloadParams?.url || ""}
                onChange={(e) => setDownloadParams({
                    ...downloadParams,
                    url: e.target.value
                })}
            />
            <Button type="default" onClick={async () => {
                const result = await invoke.remoteStore.openAsync({}, {
                    footer: null,
                    width: 800,
                    title: "Remote Store",
                })
                if (result) {
                    setDownloadParams({
                        ...downloadParams,
                        url: result
                    })
                }
            }} >Store</Button>
            <Button type="primary" onClick={async () => {
                if (!downloadParams?.url) {
                    message.error("Please input store url!")
                    return
                }
                // /download-store
                const resp = await axios.post(`/clone-store`, downloadParams)
                // setCmd(`${resp.data?.cmd}`)

                if (resp.data?.store_id) {
                    pageRef.current?.reload();
                    if (resp.data?.already_exists) {
                        message.success("store already exists!")
                    }else{
                        message.success("create store!")
                    }

                    
                    // setSelectedStoreId(resp.data.store_id)
                    // setSidebarRefreshToken((value) => value + 1)
                    // setContentRefreshToken((value) => value + 1)
                }
            }}>Download</Button>
        </Space.Compact>
        <div style={{ marginBottom: "1rem" }}></div>
        <StorePages
            ref={pageRef}
            storeType={storeType}
            onOk={onOk}
            onCancel={onCancel}
        ></StorePages>

            
        {/* <Spin spinning={loading}>
            <Tabs
                size="small"
                tabBarExtraContent={<Flex gap={"small"}>

                    <Button size="small" icon={<RedoOutlined></RedoOutlined>}
                        loading={loading}
                        onClick={() => loadStoreList()}
                    ></Button>
                </Flex>}
                activeKey={tabKey}
                onChange={(key) => {
                    setTabkey(key)
                    loadData(key)
                }}
                items={storeList.map((item: any) => ({
                    key: item.store_name,
                    label: <Tooltip title={item.store_path}>{item.name ? item.name : item.store_name}
                    </Tooltip>,
                }))}></Tabs>


        
        </Spin> */}

        {/* {cmd && <pre>{cmd}</pre>} */}

    </>


}
export default InstallComponents
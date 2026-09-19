import { Button, Card, Col, Menu } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { FC, useCallback, useEffect, useState } from "react";
import axios from "axios";

interface StoreSidebarProps {
    relationType: any;
    address: string;
    refreshToken: number;
    selectedStoreId?: string;
    onSelectStore: (storeId?: string) => void;
}

const StoreSidebar: FC<StoreSidebarProps> = ({
    relationType,
    address,
    refreshToken,
    selectedStoreId,
    onSelectStore,
}) => {
    const [loading, setLoading] = useState(false);
    const [storeList, setStoreList] = useState<any[]>([]);
    const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);

    const loadStoreList = useCallback(async () => {
        try {
            setLoading(true);
            const resp = await axios.get(`/list-tree-stores`);
            const nextStoreList = resp.data.map((item: any, index: any) => {
                const childrens = item.children || [];
                return {
                    key: `group:${item.category || index}`,
                    label: item.category,
                    children: childrens.map((child: any, childIndex: any) => ({
                        key: `store:${child.store_id || item.store_id || `${index}-${childIndex}`}`,
                        label: child.name,
                        store_id: child.store_id || item.store_id,
                        raw: child,
                    })),
                };
            });
            setStoreList(nextStoreList);

            const flatStores = nextStoreList.flatMap((item: any) => item.children || []);
            const hasSelectedStore = !!flatStores.find((item: any) => item.store_id === selectedStoreId);
            if (hasSelectedStore) {
                const currentGroup = nextStoreList.find((group: any) =>
                    (group.children || []).some((child: any) => child.store_id === selectedStoreId)
                );
                setOpenMenuKeys(currentGroup?.key ? [currentGroup.key] : []);
                return;
            }

            const firstStore = flatStores[0];
            if (firstStore?.store_id) {
                setOpenMenuKeys([nextStoreList[0]?.key].filter(Boolean));
                onSelectStore(firstStore.store_id);
            } else {
                setOpenMenuKeys([]);
                onSelectStore(undefined);
            }
        } finally {
            setLoading(false);
        }
    }, [onSelectStore, selectedStoreId]);

    useEffect(() => {
        loadStoreList();
    }, [loadStoreList, relationType, address, refreshToken]);

    
    return (

        <Card
            size="small"
            title="Component Store"
            extra={<Button size="small" loading={loading} onClick={loadStoreList} icon={<ReloadOutlined />} />}
        >
            <Menu
                mode="inline"
                items={storeList}
                selectedKeys={selectedStoreId ? [`store:${selectedStoreId}`] : []}
                openKeys={openMenuKeys}
                onOpenChange={(keys) => setOpenMenuKeys(keys.map((key) => String(key)))}
                onClick={({ key }) => {
                    const keyString = String(key);
                    if (!keyString.startsWith("store:")) {
                        return;
                    }
                    const storeId = keyString.replace("store:", "");
                    onSelectStore(storeId);
                }}
            />
        </Card>
    );
};

export default StoreSidebar;
import { Button, Popconfirm, Space, Spin, Tag, Tooltip } from "antd"
import { FC, useState } from "react"
import axios from "axios"
import { useGlobalMessage } from "@/hooks/useGlobalMessage"
import { http } from "@/api/client/http"

type StoreEntity = "script" | "workflow"

interface StoreVersionActionsProps {
    entity: StoreEntity
    item?: Record<string, unknown>
    onReload?: () => void
    showStop?: boolean
}

const toText = (value: unknown): string => {
    if (value === null || value === undefined) {
        return ""
    }
    return String(value)
}

const isNonEmpty = (value: unknown): boolean => {
    return toText(value).trim().length > 0
}

const StoreVersionActions: FC<StoreVersionActionsProps> = ({
    entity,
    item,
    onReload,
    showStop = false,
}) => {
    const message = useGlobalMessage()
    const [checkingUpdate, setCheckingUpdate] = useState(false)
    const [reinstalling, setReinstalling] = useState(false)
    const [stopping, setStopping] = useState(false)

    const rawStoreId = item?.store_id
    const storeId = toText(rawStoreId)
    const storeOrigin = toText(item?.store_origin)
    const storeVersion = toText(item?.store_version)
    const currentVersion = toText(item?.version)
    const primaryURL = toText(item?.url)
    const fallbackURL = toText(item?.store_url)
    const storeURL = primaryURL || fallbackURL
    const storeStatus = toText(item?.store_status)

    const reinstallEndpoint = entity === "script"
        ? `/workflow/install-script/${encodeURIComponent(storeId)}`
        : `/workflow/install-workflow/${encodeURIComponent(storeId)}`

    return (
        <Space>
            {isNonEmpty(storeOrigin) && <Tag color="blue">{storeOrigin}</Tag>}

            {!storeVersion ? (
                <Tag color="red">{currentVersion} (unpublished)</Tag>
            ) : (
                <Tooltip title={storeURL}>
                    {storeVersion === currentVersion ? (
                        <Tag
                            style={{ cursor: storeURL ? "pointer" : "default" }}
                            onClick={() => {
                                if (storeURL) {
                                    window.open(storeURL, "_blank")
                                }
                            }}
                        >
                            {currentVersion}
                        </Tag>
                    ) : (
                        <Tag
                            color="red"
                            style={{ cursor: storeURL ? "pointer" : "default" }}
                            onClick={() => {
                                if (storeURL) {
                                    window.open(storeURL, "_blank")
                                }
                            }}
                        >
                            store/current: {storeVersion}/{currentVersion}
                        </Tag>
                    )}
                </Tooltip>
            )}

            {isNonEmpty(storeId) && (
                <Button
                    size="small"
                    color="cyan"
                    variant="outlined"
                    loading={checkingUpdate}
                    disabled={reinstalling || stopping}
                    onClick={async () => {
                        try {
                            setCheckingUpdate(true)
                            await http.post(`/store/redownload`, { id: storeId })
                            message.success("Check update success!")
                            if (onReload) {
                                onReload()
                            }
                        } finally {
                            setCheckingUpdate(false)
                        }
                    }}
                >
                    Check Update
                </Button>
            )}

            {isNonEmpty(storeId) && isNonEmpty(storeVersion) && isNonEmpty(currentVersion) && storeVersion != currentVersion && (
                <Popconfirm
                    title="Reinstall from store?"
                    okButtonProps={{ loading: reinstalling, disabled: checkingUpdate || stopping }}
                    cancelButtonProps={{ disabled: reinstalling }}
                    onConfirm={async () => {
                        try {
                            setReinstalling(true)
                            await http.post(reinstallEndpoint, {}, { timeout: 60000 })
                            message.success("ReInstalled successfully!")
                            if (onReload) {
                                onReload()
                            }
                        } finally {
                            setReinstalling(false)
                        }
                    }}
                >
                    <Button
                        size="small"
                        color="blue"
                        variant="solid"
                        loading={reinstalling}
                        disabled={checkingUpdate || stopping}
                    >
                        ReInstall
                    </Button>
                </Popconfirm>
            )}

            {showStop && isNonEmpty(storeId) && storeStatus != "done" && (
                <Button
                    size="small"
                    variant="solid"
                    icon={<Spin size="small" />}
                    color="red"
                    loading={stopping}
                    disabled={checkingUpdate || reinstalling}
                    onClick={async () => {
                        try {
                            setStopping(true)
                            await axios.post(`/git-stop/${storeId}`)
                            message.success("Stop success!")
                            if (onReload) {
                                onReload()
                            }
                        } finally {
                            setStopping(false)
                        }
                    }}
                >
                    Stop ({storeStatus || "running"})
                </Button>
            )}
        </Space>
    )
}

export default StoreVersionActions

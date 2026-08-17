import { Alert, Button, Image, Space, Typography } from "antd"
import { FC, useMemo } from "react"
import { useSearchParams } from "react-router"
import { getFileNameByPath, getPreviewKindByPath } from "./preview-registry"

const { Title, Text } = Typography

const FilePreviewRoute: FC = () => {
  const [searchParams] = useSearchParams()
  const downloadUrl = searchParams.get("url") || ""

  const resolvedDownloadUrl = useMemo(() => {
    if (!downloadUrl) {
      return ""
    }
    const prefix = window.location.pathname
    return `${prefix}/${downloadUrl}`.replace(/\/{2,}/g, "/")
  }, [downloadUrl])

  const title = useMemo(() => {
    const nameFromUrl = downloadUrl ? getFileNameByPath(downloadUrl) : ""
    return searchParams.get("title") || nameFromUrl || "File Preview"
  }, [downloadUrl, searchParams])

  const previewKind = useMemo(() => getPreviewKindByPath(downloadUrl), [downloadUrl])

  if (!downloadUrl) {
    return <Alert type="warning" showIcon message="Missing file url" description="Please provide query param: url" />
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
        <Title level={5} style={{ margin: 0 }}>{title}</Title>
        {resolvedDownloadUrl && (
          <Button href={resolvedDownloadUrl} target="_blank">
            Download
          </Button>
        )}
      </Space>

      {previewKind === "sheet" && (
        <Alert
          type="info"
          showIcon
          message="Sheet preview is not supported in url-only mode"
          description={<Text copyable>{downloadUrl}</Text>}
        />
      )}

      {previewKind === "image" && (
        <div
          style={{
            minHeight: 0,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: 8,
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <Image src={resolvedDownloadUrl} alt={title} style={{ maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}

      {previewKind === "unsupported" && (
        <Alert
          type="info"
          showIcon
          message="This file type is not supported for inline preview yet"
          description={<Text copyable>{downloadUrl}</Text>}
        />
      )}
    </div>
  )
}

export default FilePreviewRoute
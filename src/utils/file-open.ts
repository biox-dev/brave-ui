import { useRouterStore } from "@/event-bus/stores/router";
import { getPreviewKindByPath } from "@/components/file-preview/preview-registry";

type OpenFileByPathOptions = {
    filePath: string
    title?: string
    url?: string
    fileType?: string
}

export const openFileByPath = ({ filePath, title, url, fileType }: OpenFileByPathOptions) => {
    if (!filePath) {
        return
    }

    const previewKind = getPreviewKindByPath(filePath)
    if (previewKind !== "unsupported") {
        const query = new URLSearchParams({ path: filePath })
        if (title) {
            query.set("title", title)
        }
        if (fileType) {
            query.set("type", fileType)
        }
        if (url) {
            query.set("url", url)
        }
        useRouterStore.getState().go(`/preview/file?${query.toString()}`)
        return
    }

    if (url) {
        window.open(url, "_blank")
    }
    // url = `/brave-api/file-operation/download?path=${encodeURIComponent(filePath)}`
}

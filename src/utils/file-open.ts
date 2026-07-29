import { invoke } from "@/core/ui-system/invokeV2";

const getFileExt = (filePath: string) => {
    const fileName = filePath.split("/").pop() || filePath
    const idx = fileName.lastIndexOf(".")
    if (idx < 0) {
        return ""
    }
    return fileName.slice(idx + 1).toLowerCase()
}

const SHEET_FILE_EXTENSIONS = new Set(["xlsx", "xls", "csv", "tsv", "ods"])

type OpenFileByPathOptions = {
    filePath: string
    title?: string
    url?: string
}

export const openFileByPath = ({ filePath, title, url }: OpenFileByPathOptions) => {
    if (!filePath) {
        return
    }

    const ext = getFileExt(filePath)
    if (SHEET_FILE_EXTENSIONS.has(ext)) {
        invoke.univerView.open({ path: filePath }, {
            width: "90%",
            title: title || filePath.split("/").pop() || "Sheet Preview",
            footer: null,
        })
        return
    }
    if (url) {
        window.open(url, "_blank")

    }
    // url = `/brave-api/file-operation/download?path=${encodeURIComponent(filePath)}`
}

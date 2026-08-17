export type PreviewKind = "sheet" | "image" | "unsupported"

const SHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv", "tsv"])
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tif", "tiff"])

const getFileName = (filePath: string) => {
  const plainPath = filePath.split("?")[0].split("#")[0]
  return plainPath.split("/").pop() || plainPath
}

export const getFileExtension = (filePath: string) => {
  const fileName = getFileName(filePath)
  const idx = fileName.lastIndexOf(".")
  if (idx < 0) {
    return ""
  }
  return fileName.slice(idx + 1).toLowerCase()
}

export const getPreviewKindByPath = (filePath: string): PreviewKind => {
  const ext = getFileExtension(filePath)
  if (SHEET_EXTENSIONS.has(ext)) {
    return "sheet"
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "image"
  }
  return "unsupported"
}

export const getFileNameByPath = (filePath: string) => getFileName(filePath)
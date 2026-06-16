type DriveTypeDescriptorInput = {
  type: "file" | "folder"
  name: string
  contentType: string | null
}

const DRIVE_MIME_TYPE_LABELS: Record<string, string> = {
  "application/csv": "Spreadsheet",
  "application/msword": "Document",
  "application/pdf": "PDF",
  "application/rtf": "Document",
  "application/vnd.ms-excel": "Spreadsheet",
  "application/vnd.ms-powerpoint": "Presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Spreadsheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Document",
  "text/csv": "Spreadsheet",
}

function extensionFallbackLabel(name: string) {
  const trimmed = name.trim()
  const dotIndex = trimmed.lastIndexOf(".")
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return "File"

  const extension = trimmed.slice(dotIndex + 1)
  if (!/^[a-z0-9]+$/i.test(extension)) return "File"
  return `${extension.toUpperCase()} File`
}

export function formatDriveNodeType(node: DriveTypeDescriptorInput) {
  if (node.type === "folder") return "Folder"

  const contentType = node.contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  const exactLabel = DRIVE_MIME_TYPE_LABELS[contentType]
  if (exactLabel) return exactLabel

  if (contentType.startsWith("image/")) return "Image"
  if (contentType.startsWith("video/")) return "Video"
  if (contentType.startsWith("audio/")) return "Audio"
  if (contentType.startsWith("text/")) return "Text"
  if (
    contentType.includes("zip") ||
    contentType.includes("compressed") ||
    contentType.includes("gzip") ||
    contentType.includes("rar") ||
    contentType.includes("tar") ||
    contentType.includes("7z")
  ) {
    return "Archive"
  }

  return extensionFallbackLabel(node.name)
}

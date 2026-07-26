import { API_ORIGIN } from "@/lib/env"

export type DriveNodeType = "file" | "folder"
export type DriveNodeStatus = "active" | "trashed" | "deleted"
export type DriveRole = "none" | "viewer" | "editor"

export interface DriveNode {
  _id: string
  parentId: string | null
  type: DriveNodeType
  name: string
  storageKey: string | null
  contentType: string | null
  size: number
  ownerUserId: string
  createdByUserId: string
  status: DriveNodeStatus
  role?: DriveRole
  chatContext?: {
    enabled: boolean
    enabledAt: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface DriveShare {
  _id: string
  userId: string
  role: "viewer" | "editor"
  user: { name?: string; email?: string } | null
}

export interface DrivePublicLink {
  _id: string
  token: string
  shareUrl: string
  expiresAt: string | null
  allowDownload: boolean
  hasPassword: boolean
}

export interface DriveExportJob {
  _id: string
  status: "queued" | "running" | "completed" | "failed"
  archiveName: string
  archiveKey: string | null
  totalFiles: number
  totalBytes: number
  error: string | null
}

type DriveTypeDescriptorInput = Pick<DriveNode, "type" | "name" | "contentType">

export const DRIVE_MIME_TYPE_LABELS = {
  "application/msword": "Document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Document",
  "application/vnd.oasis.opendocument.text": "Document",
  "application/rtf": "Document",

  "application/vnd.ms-excel": "Spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "Spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet": "Spreadsheet",
  "application/csv": "Spreadsheet",
  "text/csv": "Spreadsheet",
  "text/tab-separated-values": "Spreadsheet",

  "application/vnd.ms-powerpoint": "Presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "Presentation",
  "application/vnd.oasis.opendocument.presentation": "Presentation",

  "application/pdf": "PDF",

  "audio/mpeg": "Audio",
  "audio/wav": "Audio",
  "audio/ogg": "Audio",
  "audio/opus": "Audio",
  "audio/webm": "Audio",
  "audio/mp4": "Audio",
  "audio/aac": "Audio",
  "audio/flac": "Audio",
  "audio/amr": "Audio",
  "audio/midi": "Audio",

  "video/mp4": "Video",
  "video/webm": "Video",
  "video/ogg": "Video",
  "video/quicktime": "Video",
  "video/x-msvideo": "Video",
  "video/x-matroska": "Video",
  "video/3gpp": "Video",
  "video/mp2t": "Video",

  "image/png": "Image",
  "image/jpeg": "Image",
  "image/gif": "Image",
  "image/svg+xml": "Image",
  "image/webp": "Image",
  "image/bmp": "Image",
  "image/x-icon": "Image",
  "image/avif": "Image",
  "image/apng": "Image",
  "image/heic": "Image",
  "image/heif": "Image",
  "image/tiff": "Image",

  "text/plain": "Text",
  "text/html": "Text",
  "text/markdown": "Text",
  "text/css": "Text",

  "application/json": "Code",
  "application/javascript": "Code",
  "application/typescript": "Code",
  "application/xml": "Code",
  "application/x-yaml": "Code",

  "text/x-python": "Code",
  "text/x-ruby": "Code",
  "text/x-php": "Code",
  "text/x-go": "Code",
  "text/rust": "Code",
  "text/x-java": "Code",
  "text/x-kotlin": "Code",
  "text/x-c": "Code",
  "text/x-csharp": "Code",
  "text/x-swift": "Code",
  "text/x-shellscript": "Code",
  "text/x-sql": "Code",

  "application/zip": "ZIP",
  "application/x-zip-compressed": "ZIP",
  "application/x-zip": "ZIP",

  "application/octet-stream": "File",
} as const
export const EXTENSION_TO_MIME = {
  // Documents
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",

  // Spreadsheets
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",

  // Presentations
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  key: "application/vnd.oasis.opendocument.presentation",

  // PDF
  pdf: "application/pdf",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  weba: "audio/webm",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  amr: "audio/amr",
  mid: "audio/midi",
  midi: "audio/midi",

  // Video
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  "3gp": "video/3gpp",
  ts: "video/mp2t",

  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  apng: "image/apng",
  heic: "image/heic",
  heif: "image/heif",
  tif: "image/tiff",
  tiff: "image/tiff",

  // Text
  txt: "text/plain",
  log: "text/plain",
  ini: "text/plain",
  cfg: "text/plain",
  conf: "text/plain",
  env: "text/plain",
  html: "text/html",
  htm: "text/html",
  xhtml: "text/html",
  md: "text/markdown",
  mdx: "text/markdown",
  css: "text/css",
  scss: "text/css",
  less: "text/css",

  // Structured data
  json: "application/json",
  jsonc: "application/json",
  json5: "application/json",
  xml: "application/xml",
  yml: "application/x-yaml",
  yaml: "application/x-yaml",

  // JavaScript / TypeScript
  js: "application/javascript",
  mjs: "application/javascript",
  cjs: "application/javascript",
  tsx: "application/typescript",

  // Source code
  py: "text/x-python",
  rb: "text/x-ruby",
  php: "text/x-php",
  go: "text/x-go",
  rs: "text/rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c",
  cc: "text/x-c",
  hpp: "text/x-c",
  cs: "text/x-csharp",
  swift: "text/x-swift",
  sh: "text/x-shellscript",
  bash: "text/x-shellscript",
  zsh: "text/x-shellscript",
  sql: "text/x-sql",

  // Misc
  toml: "text/plain",
  graphql: "text/plain",
  dockerfile: "text/plain",
  svelte: "text/plain",
  vue: "text/plain",

  // Archives
  zip: "application/zip",
} as const;

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

  const contentType =
    node.contentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  const exactLabel =
    DRIVE_MIME_TYPE_LABELS[contentType as keyof typeof DRIVE_MIME_TYPE_LABELS]
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || "Drive request failed")
  }
  return data
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export type DriveSortField = "name" | "updatedAt" | "size" | "type"
export type DriveSortDir = "asc" | "desc"

export async function listDriveNodes(params: {
  parentId?: string | null
  view?: "my" | "shared" | "trash"
  search?: string
  sort?: DriveSortField
  dir?: DriveSortDir
  types?: string[]
}) {
  const query = new URLSearchParams()
  if (params.parentId) query.set("parentId", params.parentId)
  if (params.view && params.view !== "my") query.set("view", params.view)
  if (params.search) query.set("search", params.search)
  if (params.sort) query.set("sort", params.sort)
  if (params.dir) query.set("dir", params.dir)
  if (params.types && params.types.length)
    query.set("types", params.types.join(","))
  return api<{ nodes: DriveNode[] }>(`/api/v1/drive?${query.toString()}`)
}

export interface DriveQuota {
  limitBytes: number
  usedBytes: number
  reservedBytes: number
}

export async function getDriveQuota() {
  return api<{ quota: DriveQuota }>("/api/v1/drive/quota")
}

export async function getDriveNode(id: string) {
  return api<{ node: DriveNode }>(`/api/v1/drive/${encodeURIComponent(id)}`)
}

export async function createDriveFolder(
  name: string,
  parentId?: string | null
) {
  return api<{ node: DriveNode }>("/api/v1/drive/folders", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  })
}

export async function renameDriveNode(id: string, name: string) {
  return api<{ node: DriveNode }>(`/api/v1/drive/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
}

export async function suggestDriveNodeName(id: string) {
  return api<{ name: string }>(
    `/api/v1/drive/${encodeURIComponent(id)}/suggest-name`,
    {
      method: "POST",
    }
  )
}

export async function moveDriveNode(id: string, parentId: string | null) {
  return api<{ node: DriveNode }>(
    `/api/v1/drive/${encodeURIComponent(id)}/move`,
    {
      method: "POST",
      body: JSON.stringify({ parentId }),
    }
  )
}

export async function setDriveChatContext(id: string, enabled: boolean) {
  return api<{ node: DriveNode }>(
    `/api/v1/drive/${encodeURIComponent(id)}/chat-context`,
    {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }
  )
}

export async function trashDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/trash`, {
    method: "POST",
  })
}

export async function restoreDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  })
}

export async function permanentlyDeleteDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}

export async function getDriveFileUrl(id: string, download = false) {
  return api<{ url: string; expiresInSeconds: number }>(
    `/api/v1/drive/${encodeURIComponent(id)}/${download ? "download-url" : "view-url"}`
  )
}

export async function saveFormSubmissionFileToDrive(input: {
  formId: string
  submissionId: string
  key: string
  parentId: string | null
  name?: string
}) {
  return api<{ node: DriveNode; sourceKey: string; storageKey: string }>(
    `/api/v1/forms/${encodeURIComponent(input.formId)}/submissions/${encodeURIComponent(input.submissionId)}/save-to-drive`,
    {
      method: "POST",
      body: JSON.stringify({
        key: input.key,
        parentId: input.parentId,
        name: input.name,
      }),
    }
  )
}

export async function uploadDriveFile(
  file: File,
  parentId: string | null,
  onProgress: (progress: number) => void
) {
  const initiated = await api<{
    node: DriveNode
    partSize: number
    parts: Array<{ partNumber: number; url: string }>
  }>("/api/v1/drive/uploads/initiate", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      parentId,
    }),
  })

  const completedParts: Array<{ partNumber: number; etag: string }> = []
  let uploaded = 0
  for (const part of initiated.parts) {
    const start = (part.partNumber - 1) * initiated.partSize
    const end = Math.min(start + initiated.partSize, file.size)
    const blob = file.slice(start, end)
    const response = await fetch(part.url, { method: "PUT", body: blob })
    if (!response.ok)
      throw new Error(`Failed to upload part ${part.partNumber}`)
    const etag = response.headers.get("ETag") ?? response.headers.get("etag")
    if (!etag)
      throw new Error("Storage did not return an ETag for an uploaded part")
    uploaded += blob.size
    onProgress(Math.round((uploaded / file.size) * 100))
    completedParts.push({ partNumber: part.partNumber, etag })
  }

  return api<{ node: DriveNode }>(
    `/api/v1/drive/uploads/${encodeURIComponent(initiated.node._id)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ parts: completedParts }),
    }
  )
}

export async function listDriveShares(id: string) {
  return api<{ shares: DriveShare[] }>(
    `/api/v1/drive/${encodeURIComponent(id)}/shares`
  )
}

export async function shareDriveNode(
  id: string,
  input: { email?: string; userId?: string; role: "viewer" | "editor" }
) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/shares`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function unshareDriveNode(id: string, userId: string) {
  return api<{ ok: true }>(
    `/api/v1/drive/${encodeURIComponent(id)}/shares/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
    }
  )
}

export async function listDrivePublicLinks(id: string) {
  return api<{ links: DrivePublicLink[] }>(
    `/api/v1/drive/${encodeURIComponent(id)}/public-links`
  )
}

export async function createDrivePublicLink(
  id: string,
  input: { password?: string; expiresAt?: string | null }
) {
  return api<{ link: DrivePublicLink }>(
    `/api/v1/drive/${encodeURIComponent(id)}/public-links`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

export async function emailDrivePublicLink(
  id: string,
  linkId: string,
  to: string
) {
  return api<{ ok: true }>(
    `/api/v1/drive/${encodeURIComponent(id)}/public-links/${encodeURIComponent(linkId)}/email`,
    {
      method: "POST",
      body: JSON.stringify({ to }),
    }
  )
}

export async function revokeDrivePublicLink(id: string, linkId: string) {
  return api<{ ok: true }>(
    `/api/v1/drive/${encodeURIComponent(id)}/public-links/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
    }
  )
}

export async function createDriveExport(id: string) {
  return api<{ job: DriveExportJob }>(
    `/api/v1/drive/${encodeURIComponent(id)}/export`,
    { method: "POST" }
  )
}

export async function getDriveExport(jobId: string, download = false) {
  return api<{ job?: DriveExportJob; url?: string }>(
    `/api/v1/drive/exports/${encodeURIComponent(jobId)}${download ? "/download" : ""}`
  )
}

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
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function canPreview(node: DriveNode) {
  const type = node.contentType ?? ""
  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    type.startsWith("text/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/")
  )
}

export async function listDriveNodes(params: {
  parentId?: string | null
  view?: "my" | "shared" | "trash"
  search?: string
}) {
  const query = new URLSearchParams()
  if (params.parentId) query.set("parentId", params.parentId)
  if (params.view && params.view !== "my") query.set("view", params.view)
  if (params.search) query.set("search", params.search)
  return api<{ nodes: DriveNode[] }>(`/api/v1/drive?${query.toString()}`)
}

export async function getDriveNode(id: string) {
  return api<{ node: DriveNode }>(`/api/v1/drive/${encodeURIComponent(id)}`)
}

export async function createDriveFolder(name: string, parentId?: string | null) {
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
  return api<{ name: string }>(`/api/v1/drive/${encodeURIComponent(id)}/suggest-name`, {
    method: "POST",
  })
}

export async function moveDriveNode(id: string, parentId: string | null) {
  return api<{ node: DriveNode }>(`/api/v1/drive/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ parentId }),
  })
}

export async function trashDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/trash`, { method: "POST" })
}

export async function restoreDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/restore`, { method: "POST" })
}

export async function permanentlyDeleteDriveNode(id: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}`, { method: "DELETE" })
}

export async function getDriveFileUrl(id: string, download = false) {
  return api<{ url: string; expiresInSeconds: number }>(
    `/api/v1/drive/${encodeURIComponent(id)}/${download ? "download-url" : "view-url"}`
  )
}

export async function uploadDriveFile(file: File, parentId: string | null, onProgress: (progress: number) => void) {
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
    if (!response.ok) throw new Error(`Failed to upload part ${part.partNumber}`)
    const etag = response.headers.get("ETag") ?? response.headers.get("etag")
    if (!etag) throw new Error("Storage did not return an ETag for an uploaded part")
    uploaded += blob.size
    onProgress(Math.round((uploaded / file.size) * 100))
    completedParts.push({ partNumber: part.partNumber, etag })
  }

  return api<{ node: DriveNode }>(`/api/v1/drive/uploads/${encodeURIComponent(initiated.node._id)}/complete`, {
    method: "POST",
    body: JSON.stringify({ parts: completedParts }),
  })
}

export async function listDriveShares(id: string) {
  return api<{ shares: DriveShare[] }>(`/api/v1/drive/${encodeURIComponent(id)}/shares`)
}

export async function shareDriveNode(id: string, input: { email?: string; userId?: string; role: "viewer" | "editor" }) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/shares`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function unshareDriveNode(id: string, userId: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/shares/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  })
}

export async function listDrivePublicLinks(id: string) {
  return api<{ links: DrivePublicLink[] }>(`/api/v1/drive/${encodeURIComponent(id)}/public-links`)
}

export async function createDrivePublicLink(id: string, input: { password?: string; expiresAt?: string | null }) {
  return api<{ link: DrivePublicLink }>(`/api/v1/drive/${encodeURIComponent(id)}/public-links`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function revokeDrivePublicLink(id: string, linkId: string) {
  return api<{ ok: true }>(`/api/v1/drive/${encodeURIComponent(id)}/public-links/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
  })
}

export async function createDriveExport(id: string) {
  return api<{ job: DriveExportJob }>(`/api/v1/drive/${encodeURIComponent(id)}/export`, { method: "POST" })
}

export async function getDriveExport(jobId: string, download = false) {
  return api<{ job?: DriveExportJob; url?: string }>(
    `/api/v1/drive/exports/${encodeURIComponent(jobId)}${download ? "/download" : ""}`
  )
}

export async function getPublicDriveLink(token: string, password?: string) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ""
  return api<{ locked: boolean; link?: DrivePublicLink; node?: DriveNode }>(`/api/v1/public/drive/${encodeURIComponent(token)}${query}`)
}

export async function listPublicDriveChildren(token: string, parentId: string, password?: string) {
  const query = new URLSearchParams({ parentId })
  if (password) query.set("password", password)
  return api<{ nodes: DriveNode[] }>(`/api/v1/public/drive/${encodeURIComponent(token)}/children?${query.toString()}`)
}

export async function getPublicDriveFileUrl(token: string, nodeId: string, password?: string, download = false) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ""
  return api<{ url: string }>(
    `/api/v1/public/drive/${encodeURIComponent(token)}/files/${encodeURIComponent(nodeId)}/${download ? "download-url" : "view-url"}${query}`
  )
}

export async function createPublicDriveExport(token: string, nodeId: string, password?: string) {
  return api<{ job: DriveExportJob }>(`/api/v1/public/drive/${encodeURIComponent(token)}/export`, {
    method: "POST",
    body: JSON.stringify({ nodeId, password }),
  })
}

export async function getPublicDriveExport(token: string, jobId: string, password?: string, download = false) {
  const query = password ? `?password=${encodeURIComponent(password)}` : ""
  return api<{ job?: DriveExportJob; url?: string }>(
    `/api/v1/public/drive/${encodeURIComponent(token)}/exports/${encodeURIComponent(jobId)}${download ? "/download" : ""}${query}`
  )
}

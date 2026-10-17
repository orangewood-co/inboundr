import { API_ORIGIN } from "@/lib/env"

export const EMAIL_API_BASE = `${API_ORIGIN}/api/v1/email`

export const EMAIL_ATTACHMENT_MAX_FILE_SIZE = 15 * 1024 * 1024
export const EMAIL_ATTACHMENT_MAX_TOTAL_SIZE = 18 * 1024 * 1024

export const EMAIL_ATTACHMENT_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "text/calendar",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/vnd.rar",
].join(",")

export type ReplyKind = "reply" | "reply_all" | "forward"
export type SendStatus = "draft" | "sending" | "sent" | "failed"

export interface EmailAttachmentRef {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
}

/** An image the HTML body embeds through a `cid:` reference. */
export interface EmailInlineImageRef extends EmailAttachmentRef {
  contentId: string
}

export interface PendingAttachment {
  key: string
  filename: string
  contentType: string
  size: number
}

export interface ThreadMessage {
  _id: string
  messageId?: string
  threadId?: string
  direction: "inbound" | "outbound"
  kind: ReplyKind | null
  sendStatus: SendStatus | null
  sendError: string | null
  inReplyToEmailId: string | null
  from: string
  to: string
  cc: string | null
  bcc: string | null
  replyTo: string | null
  subject: string
  date: string
  bodyText: string | null
  bodyHtml: string | null
  snippet: string | null
  labels: string[]
  attachments: EmailAttachmentRef[]
  inlineImages: EmailInlineImageRef[]
  pendingAttachments: PendingAttachment[]
  updatedAt: string
  /**
   * Server-computed, since deciding this needs the account's own address and the
   * same address parsing the send path uses. False when replying-all would not
   * reach anyone beyond a plain reply, so the control can be hidden.
   */
  canReplyAll: boolean
}

export interface ThreadResponse {
  threadId: string
  accountAddress: string | null
  messages: ThreadMessage[]
  drafts: ThreadMessage[]
  created?: number
}

export interface DraftInput {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  bodyHtml?: string
  pendingAttachments?: PendingAttachment[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init?.headers ?? {}) }
      : init?.headers,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || `HTTP ${response.status}`)
  }
  return data as T
}

export function fetchThread(emailId: string): Promise<ThreadResponse> {
  return request<ThreadResponse>(`${EMAIL_API_BASE}/${emailId}/thread`)
}

export function syncThread(emailId: string): Promise<ThreadResponse> {
  return request<ThreadResponse>(`${EMAIL_API_BASE}/${emailId}/thread/sync`, {
    method: "POST",
  })
}

export function createDraft(
  emailId: string,
  kind: ReplyKind,
  input: DraftInput = {}
): Promise<ThreadMessage> {
  return request<ThreadMessage>(`${EMAIL_API_BASE}/${emailId}/drafts`, {
    method: "POST",
    body: JSON.stringify({ kind, ...input }),
  })
}

export function updateDraft(draftId: string, input: DraftInput): Promise<ThreadMessage> {
  return request<ThreadMessage>(`${EMAIL_API_BASE}/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteDraft(draftId: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${EMAIL_API_BASE}/drafts/${draftId}`, {
    method: "DELETE",
  })
}

export function generateReply(
  draftId: string,
  guidance?: string
): Promise<{ bodyHtml: string }> {
  return request<{ bodyHtml: string }>(`${EMAIL_API_BASE}/drafts/${draftId}/generate`, {
    method: "POST",
    body: JSON.stringify(guidance ? { guidance } : {}),
  })
}

export interface SentMessage extends ThreadMessage {
  /** Set when the message went out but the follow-up archive did not. */
  archiveError: string | null
}

export function sendDraft(
  draftId: string,
  input: DraftInput,
  options: { archive?: boolean } = {}
): Promise<SentMessage> {
  return request<SentMessage>(`${EMAIL_API_BASE}/drafts/${draftId}/send`, {
    method: "POST",
    body: JSON.stringify({ ...input, archive: options.archive === true }),
  })
}

interface PresignedUpload {
  uploadUrl: string
  headers: Record<string, string>
  file: { key: string; url: string | null }
}

export async function uploadEmailAttachment(file: File): Promise<PendingAttachment> {
  if (file.size > EMAIL_ATTACHMENT_MAX_FILE_SIZE) {
    const limitMb = Math.round(EMAIL_ATTACHMENT_MAX_FILE_SIZE / 1024 / 1024)
    throw new Error(`${file.name} must be ${limitMb}MB or smaller`)
  }

  const presign = await request<PresignedUpload>(`${API_ORIGIN}/api/v1/uploads/presign`, {
    method: "POST",
    body: JSON.stringify({
      scope: "email",
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  })

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload ${file.name}`)
  }

  return {
    key: presign.file.key,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  }
}

/** Points the body's `cid:` references at the stored inline image parts. */
export function resolveInlineImages(
  html: string,
  images: EmailInlineImageRef[],
  urlFor: (attachmentId: string) => string
): string {
  if (images.length === 0) return html

  const byContentId = new Map(images.map((image) => [image.contentId.toLowerCase(), image]))
  return html.replace(/cid:([^"'\s)>]+)/gi, (match, contentId: string) => {
    const image = byContentId.get(contentId.toLowerCase())
    return image ? urlFor(image.attachmentId) : match
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function replyKindLabel(kind: ReplyKind): string {
  if (kind === "reply_all") return "Reply All"
  if (kind === "forward") return "Forward"
  return "Reply"
}

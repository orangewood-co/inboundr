import type { Ticket, TicketAttachment, TicketFilter, TicketMessage } from "./types"

export function formatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export function formatFullTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return "now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d`
  const diffWeek = Math.round(diffDay / 7)
  if (diffWeek < 5) return `${diffWeek}w`
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}

/** "Today" / "Yesterday" / "12 June 2026" divider label for a message group. */
export function formatDayDivider(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(date)
}

export function dayKey(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toDateString()
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ticketMatchesFilter(ticket: Ticket, filter: TicketFilter) {
  if (filter === "archived") return ticket.isArchived === true
  if (ticket.isArchived) return false
  return filter === "all" || ticket.status === filter
}

export function isUnread(ticket: Ticket) {
  if (!ticket.lastVisitorMessageAt) return false
  if (!ticket.lastAgentReadAt) return true
  return new Date(ticket.lastVisitorMessageAt) > new Date(ticket.lastAgentReadAt)
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function isAudioAttachment(attachment: TicketAttachment) {
  return attachment.contentType.startsWith("audio/")
}

export function isImageAttachment(attachment: TicketAttachment) {
  return attachment.contentType.startsWith("image/")
}

/** Mirrors the backend list preview so live socket updates match the server. */
export function previewFromMessage(message: Pick<TicketMessage, "bodyText" | "attachments">) {
  const body = (message.bodyText ?? "").replace(/\s+/g, " ").trim()
  if (body) return body.slice(0, 140)
  const attachments = message.attachments ?? []
  if (attachments.length > 0) {
    const first = attachments[0]
    if (first.contentType.startsWith("audio/")) return "Voice message"
    return attachments.length === 1 ? first.originalName : `${attachments.length} attachments`
  }
  return ""
}

export function authorLabel(message: TicketMessage, requesterName: string) {
  if (message.isInternal) return "Internal note"
  if (message.authorType === "agent") return "You"
  if (message.authorType === "bot") return "Assistant"
  if (message.authorType === "system") return "System"
  return requesterName
}

/** Resolve simple {{placeholders}} when inserting a template. */
export function resolveTemplate(body: string, ticket: { requester: { name: string }; ticketReference: string } | null) {
  if (!ticket) return body
  const firstName = ticket.requester.name.split(/\s+/)[0] || ticket.requester.name
  return body
    .replace(/\{\{\s*name\s*\}\}/gi, ticket.requester.name)
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*ticket_number\s*\}\}/gi, ticket.ticketReference)
}

export const SUPPORT_MESSAGE_MAX_LENGTH = 4000

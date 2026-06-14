export type TicketStatus = "open" | "pending" | "resolved" | "closed"
export type TicketFilter = TicketStatus | "all"
export type MessageAuthorType = "visitor" | "bot" | "agent" | "system"

export type Ticket = {
  id: string
  ticketNumber: number
  subject: string
  status: TicketStatus
  priority: string
  channel: string
  requester: { name: string; email: string }
  botEnabled: boolean
  lastMessageAt: string
  lastVisitorMessageAt: string | null
  lastAgentMessageAt: string | null
  lastVisitorReadAt: string | null
  lastAgentReadAt: string | null
  resolvedAt: string | null
  lastMessagePreview?: string | null
  lastMessageAuthorType?: MessageAuthorType | null
  lastMessageIsInternal?: boolean
  createdAt: string
  updatedAt: string
}

export type TicketAttachment = {
  key: string
  originalName: string
  contentType: string
  size: number
  url: string | null
}

export type TicketMessage = {
  id: string
  ticketId: string
  authorType: MessageAuthorType
  authorUserId: string | null
  bodyText: string
  attachments: TicketAttachment[]
  isInternal: boolean
  createdAt: string
  updatedAt: string
}

export type SocketEvent =
  | { type: "connected" }
  | { type: "ticket.updated"; ticket: Ticket }
  | { type: "message.created"; message: TicketMessage }
  | { type: "typing"; ticketId: string; actor: "agent" | "visitor"; isTyping: boolean }
  | { type: "error"; error: string }
  | { type: "ticket.subscribed"; ticketId: string }
  | { type: "pong" }

export type PendingAttachment = {
  id: string
  file: File
  /** Set for voice recordings so the composer can show a player preview. */
  audioUrl?: string
}

export type SupportTemplate = {
  id: string
  title: string
  body: string
  shortcut: string
  createdAt: string
  updatedAt: string
}

export type ComposerMode = "reply" | "note"

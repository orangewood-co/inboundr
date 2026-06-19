export type TicketStatus = "open" | "pending" | "resolved" | "closed"
export type TicketFilter = TicketStatus | "all" | "archived"
export type MessageAuthorType = "visitor" | "bot" | "agent" | "system"

export type TicketAgent = {
  userId: string
  name: string
  image: string | null
}

export type Ticket = {
  id: string
  ticketNumber: number
  subject: string
  status: TicketStatus
  priority: string
  channel: string
  requester: { name: string; email: string }
  customerId: string | null
  customer: SupportCustomer | null
  initialIssue: string
  emailTranscriptRequested: boolean
  botEnabled: boolean
  lastMessageAt: string
  lastVisitorMessageAt: string | null
  lastAgentMessageAt: string | null
  lastVisitorReadAt: string | null
  lastAgentReadAt: string | null
  visitorEndedAt: string | null
  visitorFeedback: {
    rating: number | null
    comment: string
    submittedAt: string | null
  }
  transcriptEmailSentAt: string | null
  resolvedEmailSentAt: string | null
  resolvedAt: string | null
  isArchived: boolean
  archivedAt: string | null
  lastMessagePreview?: string | null
  lastMessageAuthorType?: MessageAuthorType | null
  lastMessageIsInternal?: boolean
  agents?: TicketAgent[] | null
  createdAt: string
  updatedAt: string
}

export type SupportCustomer = {
  id: string
  name: string
  company: string
  email: string
  contactNumber: string | null
  address: string | null
  specialDiscountPercentage: number
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
  | { type: "ticket.deleted"; ticketId: string }
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

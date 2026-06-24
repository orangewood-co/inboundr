import { API_ORIGIN } from "@/lib/env"

export type FeedbackType = "feedback" | "feature_request" | "bug"
export type FeedbackStatus = "open" | "in_progress" | "resolved"
export type FeedbackModule =
  | "general"
  | "home"
  | "rfq"
  | "emails"
  | "orders"
  | "stats"
  | "chat"
  | "support"
  | "products"
  | "invoices"
  | "receivables"
  | "customers"
  | "employees"
  | "projects"
  | "forms"
  | "links"
  | "drive"
  | "settings"

export interface FeedbackMessage {
  _id: string
  authorType: "user" | "admin"
  authorId: string
  authorName: string
  body: string
  createdAt: string
}

export interface AppFeedback {
  _id: string
  userId: string
  userEmail: string
  userName: string
  organizationId: string | null
  type: FeedbackType
  typeLabel: string
  module: FeedbackModule
  moduleLabel: string
  status: FeedbackStatus
  messages: FeedbackMessage[]
  unreadForAdmin: boolean
  unreadForUser: boolean
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "feedback", label: "Feedback" },
  { value: "feature_request", label: "Feature Request" },
  { value: "bug", label: "Bug" },
]

export const FEEDBACK_STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
]

/**
 * Module options shown in the feedback dialog. Labels mirror the sidebar /
 * route labels so users recognize the area they are reporting on.
 */
export const FEEDBACK_MODULE_OPTIONS: { value: FeedbackModule; label: string }[] = [
  { value: "general", label: "General" },
  { value: "home", label: "Home" },
  { value: "rfq", label: "RFQ" },
  { value: "emails", label: "Inbox" },
  { value: "orders", label: "Orders" },
  { value: "stats", label: "Stats" },
  { value: "chat", label: "AI Chat" },
  { value: "support", label: "Support" },
  { value: "products", label: "Products" },
  { value: "invoices", label: "Invoices" },
  { value: "receivables", label: "Receivables" },
  { value: "customers", label: "Customers" },
  { value: "employees", label: "Employees" },
  { value: "projects", label: "Projects" },
  { value: "forms", label: "Forms" },
  { value: "links", label: "Links" },
  { value: "drive", label: "Drive" },
  { value: "settings", label: "Settings" },
]

const PATH_SEGMENT_TO_MODULE: Record<string, FeedbackModule> = {
  rfq: "rfq",
  emails: "emails",
  orders: "orders",
  stats: "stats",
  chat: "chat",
  support: "support",
  products: "products",
  invoices: "invoices",
  receivables: "receivables",
  customers: "customers",
  employees: "employees",
  projects: "projects",
  forms: "forms",
  links: "links",
  drive: "drive",
  settings: "settings",
}

/** Best-effort mapping from the current pathname to a feedback module. */
export function getModuleFromPath(pathname: string): FeedbackModule {
  const trimmed = pathname.replace(/^\/+/, "")
  if (!trimmed) return "home"

  const segment = trimmed.split("/")[0] ?? ""
  return PATH_SEGMENT_TO_MODULE[segment] ?? "general"
}

function buildUrl(path: string) {
  return `${API_ORIGIN}${path}`
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({}))
}

async function ensureOk(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const data = await parseJson(response)
    throw new Error(data.error ?? fallbackMessage)
  }
  return parseJson(response)
}

export async function submitFeedback(input: {
  type: FeedbackType
  module: FeedbackModule
  message: string
}): Promise<AppFeedback> {
  const response = await fetch(buildUrl("/api/v1/feedback"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = await ensureOk(response, "Failed to submit feedback")
  return data.feedback
}

export async function listMyFeedback(): Promise<AppFeedback[]> {
  const response = await fetch(buildUrl("/api/v1/feedback"), {
    credentials: "include",
  })
  const data = await ensureOk(response, "Failed to load feedback")
  return data.feedback ?? []
}

export async function getMyFeedback(id: string): Promise<AppFeedback> {
  const response = await fetch(buildUrl(`/api/v1/feedback/${id}`), {
    credentials: "include",
  })
  const data = await ensureOk(response, "Failed to load feedback")
  return data.feedback
}

export async function replyToMyFeedback(
  id: string,
  message: string
): Promise<AppFeedback> {
  const response = await fetch(buildUrl(`/api/v1/feedback/${id}/messages`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  const data = await ensureOk(response, "Failed to send reply")
  return data.feedback
}

export async function listAdminFeedback(filters: {
  type?: FeedbackType | "all"
  status?: FeedbackStatus | "all"
  unreadOnly?: boolean
} = {}): Promise<{ feedback: AppFeedback[]; unreadCount: number }> {
  const params = new URLSearchParams()
  if (filters.type && filters.type !== "all") params.set("type", filters.type)
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.unreadOnly) params.set("unread", "true")

  const query = params.toString()
  const response = await fetch(
    buildUrl(`/api/v1/admin/feedback${query ? `?${query}` : ""}`),
    { credentials: "include" }
  )
  const data = await ensureOk(response, "Failed to load feedback")
  return { feedback: data.feedback ?? [], unreadCount: data.unreadCount ?? 0 }
}

export async function getAdminFeedback(id: string): Promise<AppFeedback> {
  const response = await fetch(buildUrl(`/api/v1/admin/feedback/${id}`), {
    credentials: "include",
  })
  const data = await ensureOk(response, "Failed to load feedback")
  return data.feedback
}

export async function replyAdminFeedback(
  id: string,
  message: string
): Promise<AppFeedback> {
  const response = await fetch(buildUrl(`/api/v1/admin/feedback/${id}/messages`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  })
  const data = await ensureOk(response, "Failed to send reply")
  return data.feedback
}

export async function updateAdminFeedbackStatus(
  id: string,
  status: FeedbackStatus
): Promise<AppFeedback> {
  const response = await fetch(buildUrl(`/api/v1/admin/feedback/${id}`), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
  const data = await ensureOk(response, "Failed to update feedback")
  return data.feedback
}

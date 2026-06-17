import { API_ORIGIN } from "@/lib/env"

const API_BASE = `${API_ORIGIN}/api/v1/notifications`

export interface AppNotification {
  _id: string
  organizationId: string
  recipientUserId: string
  type: string
  title: string
  body: string | null
  actionUrl: string | null
  actorUserId: string | null
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationListResponse {
  notifications: AppNotification[]
  nextCursor: string | null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data as T
}

export function listNotifications(limit = 20, cursor?: string | null): Promise<NotificationListResponse> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set("cursor", cursor)
  return api<NotificationListResponse>(`?${params.toString()}`)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await api<{ unreadCount: number }>("/unread-count")
  return data.unreadCount ?? 0
}

export function updateNotificationReadState(
  id: string,
  read: boolean
): Promise<{ notification: AppNotification; unreadCount: number }> {
  return api(`/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  })
}

export function markAllNotificationsRead(): Promise<{
  modifiedCount: number
  readAt: string
  unreadCount: number
}> {
  return api("/read-all", { method: "POST" })
}

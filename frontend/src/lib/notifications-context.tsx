import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { useSession } from "@/lib/auth-client"
import { API_ORIGIN } from "@/lib/env"
import {
  ACTIVE_ORGANIZATION_CHANGED_EVENT,
  getActiveOrganizationId,
} from "@/lib/organization-context"
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead as markAllNotificationsReadApi,
  updateNotificationReadState,
  type AppNotification,
} from "@/lib/notifications-api"

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected"

interface NotificationsContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  connectionStatus: ConnectionStatus
  error: string | null
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markUnread: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

type NotificationSocketEvent =
  | { type: "connected"; organizationId: string; userId: string }
  | { type: "notification.created"; notification: AppNotification }
  | { type: "notification.updated"; notification: AppNotification }
  | { type: "notifications.read_all"; readAt: string }
  | { type: "pong" }
  | { type: "error"; error: string }

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

function notificationsWsUrl(organizationId: string | null) {
  const url = new URL(API_ORIGIN)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = "/api/v1/notifications/ws"
  url.search = ""
  if (organizationId) url.searchParams.set("organizationId", organizationId)
  return url.toString()
}

function upsertNotification(current: AppNotification[], notification: AppNotification) {
  const without = current.filter((item) => item._id !== notification._id)
  return [notification, ...without].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState(() => getActiveOrganizationId())

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number | null>(null)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const isSignedIn = Boolean(session?.user)

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [list, count] = await Promise.all([
        listNotifications(20),
        getUnreadNotificationCount(),
      ])
      setNotifications(list.notifications)
      setUnreadCount(count)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }, [isSignedIn])

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    function syncOrganizationId() {
      setOrganizationId(getActiveOrganizationId())
    }

    window.addEventListener(ACTIVE_ORGANIZATION_CHANGED_EVENT, syncOrganizationId)
    window.addEventListener("storage", syncOrganizationId)
    window.addEventListener("focus", syncOrganizationId)
    return () => {
      window.removeEventListener(ACTIVE_ORGANIZATION_CHANGED_EVENT, syncOrganizationId)
      window.removeEventListener("storage", syncOrganizationId)
      window.removeEventListener("focus", syncOrganizationId)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [organizationId, refresh])

  useEffect(() => {
    function handleFocus() {
      void refreshRef.current()
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [])

  useEffect(() => {
    if (!isSignedIn) {
      setConnectionStatus("idle")
      return
    }

    let stopped = false

    function connect() {
      if (stopped) return
      setConnectionStatus("connecting")
      const socket = new WebSocket(notificationsWsUrl(organizationId))
      socketRef.current = socket

      socket.addEventListener("open", () => {
        setConnectionStatus("connected")
        void refreshRef.current()
      })

      socket.addEventListener("message", (event) => {
        let payload: NotificationSocketEvent
        try {
          payload = JSON.parse(String(event.data)) as NotificationSocketEvent
        } catch {
          return
        }

        if (payload.type === "notification.created") {
          setNotifications((current) => upsertNotification(current, payload.notification).slice(0, 20))
          if (!payload.notification.readAt) setUnreadCount((current) => current + 1)
        }
        if (payload.type === "notification.updated") {
          setNotifications((current) => upsertNotification(current, payload.notification).slice(0, 20))
          void refreshRef.current()
        }
        if (payload.type === "notifications.read_all") {
          setUnreadCount(0)
          setNotifications((current) =>
            current.map((notification) => ({ ...notification, readAt: notification.readAt ?? payload.readAt }))
          )
        }
        if (payload.type === "error") setError(payload.error)
      })

      socket.addEventListener("close", () => {
        setConnectionStatus("disconnected")
        if (!stopped) reconnectRef.current = window.setTimeout(connect, 1500)
      })

      socket.addEventListener("error", () => setConnectionStatus("disconnected"))
    }

    connect()
    return () => {
      stopped = true
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [isSignedIn, organizationId])

  const markRead = useCallback(async (id: string) => {
    const result = await updateNotificationReadState(id, true)
    setNotifications((current) => upsertNotification(current, result.notification).slice(0, 20))
    setUnreadCount(result.unreadCount)
  }, [])

  const markUnread = useCallback(async (id: string) => {
    const result = await updateNotificationReadState(id, false)
    setNotifications((current) => upsertNotification(current, result.notification).slice(0, 20))
    setUnreadCount(result.unreadCount)
  }, [])

  const markAllRead = useCallback(async () => {
    const result = await markAllNotificationsReadApi()
    setUnreadCount(result.unreadCount)
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt ?? result.readAt }))
    )
  }, [])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      connectionStatus,
      error,
      refresh,
      markRead,
      markUnread,
      markAllRead,
    }),
    [connectionStatus, error, loading, markAllRead, markRead, markUnread, notifications, refresh, unreadCount]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider")
  }
  return context
}

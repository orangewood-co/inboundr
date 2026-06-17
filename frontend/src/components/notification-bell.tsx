import { useState } from "react"
import { BellIcon, CheckCheckIcon, MailIcon, MailOpenIcon, WifiOffIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { formatRelativeTime } from "@/lib/format"
import { useNotifications } from "@/lib/notifications-context"
import type { AppNotification } from "@/lib/notifications-api"
import { cn } from "@/lib/utils"

function unreadLabel(count: number) {
  if (count <= 0) return "No unread notifications"
  if (count === 1) return "1 unread notification"
  return `${count} unread notifications`
}

function displayCount(count: number) {
  return count > 99 ? "99+" : String(count)
}

function NotificationItem({
  notification,
  onOpen,
  onToggleRead,
}: {
  notification: AppNotification
  onOpen: (notification: AppNotification) => void
  onToggleRead: (notification: AppNotification) => void
}) {
  const unread = !notification.readAt

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        unread ? "border-primary/30 bg-primary/5" : "border-border"
      )}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(notification)
        }
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1 flex size-2 shrink-0 rounded-full",
            unread ? "bg-primary" : "bg-muted-foreground/30"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={cn("line-clamp-2 text-sm", unread ? "font-semibold" : "font-medium")}>
              {notification.title}
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>
          {notification.body && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge variant="secondary" className="capitalize">
              {notification.type.replaceAll(".", " ")}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={(event) => {
                event.stopPropagation()
                onToggleRead(notification)
              }}
            >
              {unread ? <MailOpenIcon className="mr-1 size-3.5" /> : <MailIcon className="mr-1 size-3.5" />}
              {unread ? "Mark Read" : "Mark Unread"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    loading,
    connectionStatus,
    error,
    refresh,
    markRead,
    markUnread,
    markAllRead,
  } = useNotifications()

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) await refresh()
  }

  async function handleOpenNotification(notification: AppNotification) {
    try {
      if (!notification.readAt) await markRead(notification._id)
      if (notification.actionUrl) {
        window.location.assign(notification.actionUrl)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open notification")
    }
  }

  async function handleToggleRead(notification: AppNotification) {
    try {
      if (notification.readAt) {
        await markUnread(notification._id)
      } else {
        await markRead(notification._id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update notification")
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark notifications read")
    }
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => void handleOpenChange(nextOpen)}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label={unreadLabel(unreadCount)}>
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {displayCount(unreadCount)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">{unreadLabel(unreadCount)}</p>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === "disconnected" && (
              <WifiOffIcon className="size-4 text-muted-foreground" aria-label="Notifications disconnected" />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0}
            >
              <CheckCheckIcon className="mr-1 size-3.5" />
              Mark All Read
            </Button>
          </div>
        </div>
        <Separator />
        <div className="max-h-[420px] overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <BellIcon className="size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No Notifications Yet</p>
              <p className="mt-1 max-w-56 text-xs text-muted-foreground">
                Important updates for this organization will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onOpen={handleOpenNotification}
                  onToggleRead={handleToggleRead}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

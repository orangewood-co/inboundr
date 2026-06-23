import { BellIcon, CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/format"
import { useNotifications } from "@/lib/notifications-context"
import type { AppNotification } from "@/lib/notifications-api"
import { cn } from "@/lib/utils"

import { DashboardCard, RowChevron, WidgetEmpty, WidgetError, WidgetRowsSkeleton, widgetRowClass } from "./dashboard-card"

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification
  onOpen: (notification: AppNotification) => void
}) {
  const unread = !notification.readAt
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(notification)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen(notification)
        }
      }}
      className={cn(widgetRowClass, "text-left")}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/10" : "bg-muted"
        )}
        aria-hidden
      >
        <span
          className={cn("size-2 rounded-full", unread ? "bg-primary" : "bg-muted-foreground/40")}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("line-clamp-1 text-sm", unread ? "font-semibold" : "font-medium")}>
          {notification.title}
        </p>
        {notification.body ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
        ) : (
          <p className="mt-0.5 line-clamp-1 text-xs capitalize text-muted-foreground">
            {notification.type.replaceAll(".", " ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(notification.createdAt)}
        </span>
        <RowChevron />
      </div>
    </div>
  )
}

export function NotificationsWidget() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead } = useNotifications()

  async function handleOpen(notification: AppNotification) {
    try {
      if (!notification.readAt) await markRead(notification._id)
      if (notification.actionUrl) window.location.assign(notification.actionUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open notification")
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark notifications read")
    }
  }

  const recent = notifications.slice(0, 5)

  return (
    <DashboardCard
      title="Notifications"
      icon={BellIcon}
      headerAction={
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => void handleMarkAllRead()}
          disabled={unreadCount === 0}
        >
          <CheckCheckIcon className="mr-1 size-3.5" />
          Mark All Read
        </Button>
      }
    >
      {error ? (
        <WidgetError message={error} />
      ) : loading && notifications.length === 0 ? (
        <WidgetRowsSkeleton rows={4} />
      ) : recent.length === 0 ? (
        <WidgetEmpty
          icon={BellIcon}
          title="You're all caught up"
          description="Important updates for this organization will appear here."
        />
      ) : (
        <div className="flex flex-col">
          {recent.map((notification) => (
            <NotificationRow key={notification._id} notification={notification} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}

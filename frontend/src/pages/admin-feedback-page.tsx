import { useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { InboxIcon, PaperclipIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FeedbackStatusBadge } from "@/components/feedback/feedback-thread"
import { formatDateTime } from "@/lib/format"
import {
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_TYPE_OPTIONS,
  listAdminFeedback,
  type AppFeedback,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback"

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<AppFeedback[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all")
  const [unreadOnly, setUnreadOnly] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const result = await listAdminFeedback({
        type: typeFilter,
        status: statusFilter,
        unreadOnly,
      })
      setFeedback(result.feedback)
      setUnreadCount(result.unreadCount)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load feedback")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [typeFilter, statusFilter, unreadOnly])

  const summary = useMemo(() => {
    const open = feedback.filter((entry) => entry.status === "open").length
    const inProgress = feedback.filter((entry) => entry.status === "in_progress").length
    return { open, inProgress, total: feedback.length }
  }, [feedback])

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Super Admin", href: "/admin" }, { label: "Feedback" }]} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <PageHeader
            title="Feedback"
            description="Review feedback, feature requests, and bug reports submitted by users, and reply to them directly."
            actions={
              <Button variant="outline" onClick={() => void load()}>
                <RefreshCwIcon className="mr-2 size-4" />
                Refresh
              </Button>
            }
          />

          <section className="rounded-2xl border bg-background">
            <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Submissions</h2>
                  {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {summary.total} shown · {summary.open} open · {summary.inProgress} in progress
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-[160px_170px_150px]">
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as FeedbackType | "all")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {FEEDBACK_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FeedbackStatus | "all")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {FEEDBACK_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={unreadOnly ? "unread" : "all"} onValueChange={(value) => setUnreadOnly(value === "unread")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Spinner />
              </div>
            ) : feedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <InboxIcon className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No Feedback Found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((entry) => (
                    <TableRow key={entry._id} className={entry.unreadForAdmin ? "font-medium" : undefined}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2">
                          {entry.unreadForAdmin && <span className="size-2 rounded-full bg-primary" />}
                          <div>
                            <div className="text-sm">{entry.userName || entry.userEmail}</div>
                            <div className="text-xs text-muted-foreground">{entry.userEmail}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{entry.typeLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{entry.moduleLabel}</TableCell>
                      <TableCell>
                        <FeedbackStatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.attachmentCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <PaperclipIcon className="size-3.5" />
                            {entry.attachmentCount}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(entry.lastMessageAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/admin/feedback/$id" params={{ id: entry._id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  )
}

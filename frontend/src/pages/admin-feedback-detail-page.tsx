import { useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
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
import { Spinner } from "@/components/ui/spinner"
import {
  FeedbackMessageList,
  FeedbackReplyComposer,
  FeedbackStatusBadge,
} from "@/components/feedback/feedback-thread"
import { formatDateTime } from "@/lib/format"
import {
  FEEDBACK_STATUS_OPTIONS,
  getAdminFeedback,
  replyAdminFeedback,
  updateAdminFeedbackStatus,
  type AppFeedback,
  type FeedbackStatus,
} from "@/lib/feedback"

export default function AdminFeedbackDetailPage() {
  const { id } = useParams({ from: "/admin_/feedback/$id" })
  const [feedback, setFeedback] = useState<AppFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setFeedback(await getAdminFeedback(id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load feedback")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  async function handleReply(message: string) {
    try {
      setFeedback(await replyAdminFeedback(id, message))
      toast.success("Reply sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reply")
    }
  }

  async function handleStatusChange(status: FeedbackStatus) {
    setStatusUpdating(true)
    try {
      setFeedback(await updateAdminFeedbackStatus(id, status))
      toast.success("Status updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Super Admin", href: "/admin" }, { label: "Feedback", href: "/admin/feedback" }, { label: "Details" }]} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link to="/admin/feedback">
              <ArrowLeftIcon className="mr-2 size-4" />
              Back to Feedback
            </Link>
          </Button>

          {loading || !feedback ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <section className="rounded-2xl border bg-background">
              <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">{feedback.typeLabel}</h1>
                    <Badge variant="secondary">{feedback.moduleLabel}</Badge>
                    <FeedbackStatusBadge status={feedback.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {feedback.userName || feedback.userEmail} · {feedback.userEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(feedback.createdAt)}
                  </p>
                </div>
                <div className="w-full sm:w-44">
                  <Select
                    value={feedback.status}
                    onValueChange={(value) => void handleStatusChange(value as FeedbackStatus)}
                    disabled={statusUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <FeedbackMessageList messages={feedback.messages} />
                <div className="border-t pt-4">
                  <FeedbackReplyComposer onSend={handleReply} placeholder="Write a reply to the user..." />
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </AppLayout>
  )
}

import { useEffect, useState } from "react"
import { MessageSquarePlusIcon, PaperclipIcon } from "lucide-react"
import { toast } from "sonner"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { FeedbackDialog } from "@/components/feedback/feedback-dialog"
import {
  FeedbackMessageList,
  FeedbackReplyComposer,
  FeedbackStatusBadge,
} from "@/components/feedback/feedback-thread"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import {
  getMyFeedback,
  listMyFeedback,
  replyToMyFeedback,
  type AppFeedback,
  type FeedbackAttachment,
} from "@/lib/feedback"

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<AppFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AppFeedback | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const items = await listMyFeedback()
      setFeedback(items)
      setSelectedId((current) => current ?? items[0]?._id ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load feedback")
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true)
    try {
      const item = await getMyFeedback(id)
      setSelected(item)
      setFeedback((current) =>
        current.map((entry) => (entry._id === id ? { ...entry, unreadForUser: false } : entry))
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load feedback")
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else setSelected(null)
  }, [selectedId])

  async function handleReply(message: string, attachments: FeedbackAttachment[]) {
    if (!selected) return
    try {
      const updated = await replyToMyFeedback(selected._id, message, attachments)
      setSelected(updated)
      setFeedback((current) =>
        current.map((entry) => (entry._id === updated._id ? updated : entry))
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reply")
    }
  }

  return (
    <AppLayout>
      <SiteHeader breadcrumbs={[{ label: "Feedback" }]} />
      <main className="h-full overflow-y-auto bg-muted/20 p-4 md:p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <PageHeader
            title="Feedback"
            description="Send feedback, request features, or report bugs. Track your conversations with our team here."
            actions={
              feedback.length > 0 ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <MessageSquarePlusIcon className="mr-2 size-4" />
                  New Feedback
                </Button>
              ) : null
            }
          />

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : feedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-background py-16 text-center">
              <MessageSquarePlusIcon className="size-8 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">No Feedback Yet</h2>
                <p className="text-sm text-muted-foreground">
                  Share your first piece of feedback and we'll get back to you here.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <MessageSquarePlusIcon className="mr-2 size-4" />
                Send Feedback
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <section className="flex flex-col gap-2 rounded-2xl border bg-background p-2">
                {feedback.map((entry) => (
                  <button
                    key={entry._id}
                    type="button"
                    onClick={() => setSelectedId(entry._id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted",
                      entry._id === selectedId && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{entry.typeLabel}</span>
                      <FeedbackStatusBadge status={entry.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.moduleLabel}</span>
                      <span>·</span>
                      <span>{formatDateTime(entry.lastMessageAt)}</span>
                      {entry.attachmentCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <PaperclipIcon className="size-3" />
                            {entry.attachmentCount}
                          </span>
                        </>
                      )}
                      {entry.unreadForUser && (
                        <span className="ml-auto size-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </section>

              <section className="rounded-2xl border bg-background">
                {detailLoading || !selected ? (
                  <div className="flex h-64 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-2 border-b pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold">{selected.typeLabel}</h2>
                          <FeedbackStatusBadge status={selected.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {selected.moduleLabel} · {formatDateTime(selected.createdAt)}
                        </p>
                      </div>
                    </div>
                    <FeedbackMessageList messages={selected.messages} />
                    <div className="border-t pt-4">
                      <FeedbackReplyComposer feedbackId={selected._id} onSend={handleReply} />
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
      <FeedbackDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) void load()
        }}
      />
    </AppLayout>
  )
}

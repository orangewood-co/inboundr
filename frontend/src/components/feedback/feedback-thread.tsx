import { useEffect, useRef, useState } from "react"
import { SendIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  addPendingFeedbackFiles,
  FeedbackAttachmentButton,
  FeedbackMessageAttachments,
  PendingFeedbackAttachments,
  revokePendingFeedbackAttachments,
  type PendingFeedbackAttachment,
} from "@/components/feedback/feedback-attachment-controls"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import {
  FEEDBACK_ATTACHMENT_ACCEPT,
  uploadFeedbackAttachment,
  type FeedbackAttachment,
  type FeedbackMessage,
  type FeedbackStatus,
} from "@/lib/feedback"

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
}

const STATUS_VARIANTS: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}

export function FeedbackMessageList({
  messages,
  viewerType = "user",
}: {
  messages: FeedbackMessage[]
  viewerType?: FeedbackMessage["authorType"]
}) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const isOwn = message.authorType === viewerType
        const authorLabel = isOwn
          ? "You"
          : message.authorName ||
            (message.authorType === "admin" ? "Inboundr Team" : "Customer")
        return (
          <div
            key={message._id}
            className={cn("flex", isOwn ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                isOwn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center gap-2 text-xs",
                  isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                <span className="font-medium">{authorLabel}</span>
                <span>·</span>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
              <FeedbackMessageAttachments attachments={message.attachments ?? []} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FeedbackReplyComposer({
  onSend,
  feedbackId,
  placeholder = "Write a reply...",
  buttonLabel = "Send Reply",
}: {
  onSend: (message: string, attachments: FeedbackAttachment[]) => Promise<void>
  feedbackId?: string
  placeholder?: string
  buttonLabel?: string
}) {
  const [value, setValue] = useState("")
  const [files, setFiles] = useState<PendingFeedbackAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [sending, setSending] = useState(false)
  const filesRef = useRef(files)
  const canSend = !sending && (value.trim().length > 0 || files.length > 0)

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => () => revokePendingFeedbackAttachments(filesRef.current), [])

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return
    setFiles((current) => {
      const { next, errors } = addPendingFeedbackFiles(current, incoming)
      errors.forEach((error) => toast.error(error))
      return next
    })
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pastedFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/")
    )
    if (pastedFiles.length > 0) addFiles(pastedFiles)
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    if (!canSend) return

    setSending(true)
    try {
      const attachments = await Promise.all(
        files.map((item) => uploadFeedbackAttachment(item.file, feedbackId))
      )
      await onSend(value.trim(), attachments)
      setValue("")
      revokePendingFeedbackAttachments(files)
      setFiles([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={handleSend}
      className={cn(
        "flex flex-col gap-2 rounded-xl transition-colors",
        dragging && "border border-dashed border-primary p-2"
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        addFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <textarea
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={handlePaste}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        placeholder={placeholder}
        maxLength={5000}
      />
      <PendingFeedbackAttachments items={files} onRemove={removeFile} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FeedbackAttachmentButton
            disabled={sending}
            accept={FEEDBACK_ATTACHMENT_ACCEPT}
            onFiles={addFiles}
          />
          <span className="text-xs text-muted-foreground">Drop files or paste a screenshot</span>
        </div>
        <Button type="submit" disabled={!canSend}>
          {sending ? <Spinner data-icon="inline-start" /> : <SendIcon className="mr-2 size-4" />}
          {buttonLabel}
        </Button>
      </div>
    </form>
  )
}

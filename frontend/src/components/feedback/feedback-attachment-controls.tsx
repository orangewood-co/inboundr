import { FileIcon, ImageIcon, PaperclipIcon, VideoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  FEEDBACK_MAX_ATTACHMENTS,
  fileSizeLabel,
  validateFeedbackFile,
  type FeedbackAttachment,
} from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface PendingFeedbackAttachment {
  id: string
  file: File
  previewUrl: string
}

export function createPendingFeedbackAttachment(file: File): PendingFeedbackAttachment {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

export function addPendingFeedbackFiles(
  current: PendingFeedbackAttachment[],
  files: File[]
): { next: PendingFeedbackAttachment[]; errors: string[] } {
  const errors: string[] = []
  const room = Math.max(0, FEEDBACK_MAX_ATTACHMENTS - current.length)
  if (files.length > room) {
    errors.push(`You can attach up to ${FEEDBACK_MAX_ATTACHMENTS} files`)
  }

  const accepted = files.slice(0, room).flatMap((file) => {
    const error = validateFeedbackFile(file)
    if (error) {
      errors.push(error)
      return []
    }
    return createPendingFeedbackAttachment(file)
  })

  return { next: [...current, ...accepted], errors }
}

export function revokePendingFeedbackAttachments(items: PendingFeedbackAttachment[]) {
  items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
}

function mediaIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <ImageIcon className="size-3.5" />
  if (contentType.startsWith("video/")) return <VideoIcon className="size-3.5" />
  return <FileIcon className="size-3.5" />
}

export function PendingFeedbackAttachments({
  items,
  onRemove,
}: {
  items: PendingFeedbackAttachment[]
  onRemove: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border bg-muted/40">
          {item.file.type.startsWith("image/") ? (
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="h-28 w-full object-cover"
            />
          ) : item.file.type.startsWith("video/") ? (
            <video src={item.previewUrl} className="h-28 w-full bg-black object-contain" muted />
          ) : null}
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
            <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
            <span className="shrink-0 text-muted-foreground">{fileSizeLabel(item.file.size)}</span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${item.file.name}`}
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function FeedbackAttachmentButton({
  disabled,
  accept,
  onFiles,
}: {
  disabled?: boolean
  accept: string
  onFiles: (files: File[]) => void
}) {
  return (
    <Button asChild type="button" variant="ghost" size="sm" disabled={disabled}>
      <label className={cn("cursor-pointer gap-1.5", disabled && "pointer-events-none opacity-50")}>
        <PaperclipIcon className="size-4" />
        Attach
        <input
          type="file"
          className="sr-only"
          multiple
          accept={accept}
          onChange={(event) => {
            onFiles(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </label>
    </Button>
  )
}

export function FeedbackMessageAttachments({ attachments }: { attachments: FeedbackAttachment[] }) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-2 grid gap-2">
      {attachments.map((attachment) => {
        const href = attachment.url ?? "#"
        if (attachment.contentType.startsWith("image/") && attachment.url) {
          return (
            <a
              key={attachment.key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border bg-background/60"
            >
              <img
                src={attachment.url}
                alt={attachment.originalName}
                className="max-h-72 w-full object-contain"
                loading="lazy"
              />
              <AttachmentFooter attachment={attachment} />
            </a>
          )
        }

        if (attachment.contentType.startsWith("video/") && attachment.url) {
          return (
            <div key={attachment.key} className="overflow-hidden rounded-xl border bg-background/60">
              <video src={attachment.url} className="max-h-80 w-full bg-black" controls preload="metadata" />
              <AttachmentFooter attachment={attachment} href={href} />
            </div>
          )
        }

        return (
          <a
            key={attachment.key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-xs text-foreground transition-colors hover:bg-background",
              !attachment.url && "pointer-events-none opacity-60"
            )}
          >
            {mediaIcon(attachment.contentType)}
            <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
            <span className="shrink-0 text-muted-foreground">{fileSizeLabel(attachment.size)}</span>
          </a>
        )
      })}
    </div>
  )
}

function AttachmentFooter({
  attachment,
  href,
}: {
  attachment: FeedbackAttachment
  href?: string
}) {
  const content = (
    <>
      {mediaIcon(attachment.contentType)}
      <span className="min-w-0 flex-1 truncate">{attachment.originalName}</span>
      <span className="shrink-0 text-muted-foreground">{fileSizeLabel(attachment.size)}</span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 border-t bg-background/70 px-3 py-2 text-xs text-foreground hover:bg-background"
      >
        {content}
      </a>
    )
  }

  return <div className="flex items-center gap-2 border-t bg-background/70 px-3 py-2 text-xs">{content}</div>
}

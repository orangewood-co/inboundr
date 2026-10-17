import { useMemo, useState } from "react"
import {
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  PaperclipIcon,
  SendIcon,
  AlertCircleIcon,
} from "lucide-react"

import { CopyableText } from "@/components/copy-button"
import { CollapsibleChipRow } from "@/components/email/collapsible-chip-row"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatFullDateTime, formatListTimestamp } from "@/lib/format"
import { getAvatarColor, cn } from "@/lib/utils"
import {
  formatFileSize,
  resolveInlineImages,
  type EmailAttachmentRef,
  type ThreadMessage,
} from "@/lib/email-reply"

function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^"?(.+?)"?\s*<(.+)>$/)
  if (match) return { name: match[1].trim(), email: match[2] }
  return { name: from, email: from }
}

function MessageBody({
  message,
  buildDocument,
  buildAttachmentUrl,
}: {
  message: ThreadMessage
  buildDocument: (html: string) => string
  buildAttachmentUrl: (emailId: string, attachmentId: string, download?: boolean) => string
}) {
  const document = useMemo(() => {
    if (!message.bodyHtml) return null
    const html = resolveInlineImages(message.bodyHtml, message.inlineImages, (attachmentId) =>
      buildAttachmentUrl(message._id, attachmentId)
    )
    return buildDocument(html)
  }, [message._id, message.bodyHtml, message.inlineImages, buildDocument, buildAttachmentUrl])

  if (document) {
    return (
      <iframe
        title={`Message from ${message.from}`}
        className="h-[min(60vh,640px)] w-full border-0 bg-white"
        sandbox="allow-same-origin"
        srcDoc={document}
      />
    )
  }

  if (message.bodyText) {
    return (
      <div className="max-h-[60vh] overflow-y-auto px-8 py-6">
        <pre className="whitespace-pre-wrap font-[Arial,sans-serif] text-[13px] leading-normal text-foreground/85">
          {message.bodyText}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-10 text-[13px] text-muted-foreground/50">
      No content available
    </div>
  )
}

function AttachmentChips({
  message,
  buildAttachmentUrl,
  isPreviewable,
  onPreview,
}: {
  message: ThreadMessage
  buildAttachmentUrl: (emailId: string, attachmentId: string, download?: boolean) => string
  isPreviewable: (attachment: EmailAttachmentRef) => boolean
  onPreview: (message: ThreadMessage, attachment: EmailAttachmentRef) => void
}) {
  if (message.attachments.length === 0) return null

  return (
    <CollapsibleChipRow
      className="px-8 pb-4"
      items={message.attachments}
      getKey={(attachment) => attachment.attachmentId}
      renderItem={(attachment) => (
        <Tooltip>
          <TooltipTrigger asChild>
            {isPreviewable(attachment) ? (
              <button
                type="button"
                onClick={() => onPreview(message, attachment)}
                className="surface-inset inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <PaperclipIcon className="size-3 shrink-0" />
                <span className="truncate">{attachment.filename}</span>
                <span className="shrink-0 text-[10px] opacity-50">{formatFileSize(attachment.size)}</span>
                <EyeIcon className="size-3 shrink-0 opacity-60" />
              </button>
            ) : (
              <a
                href={buildAttachmentUrl(message._id, attachment.attachmentId, true)}
                className="surface-inset inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <PaperclipIcon className="size-3 shrink-0" />
                <span className="truncate">{attachment.filename}</span>
                <span className="shrink-0 text-[10px] opacity-50">{formatFileSize(attachment.size)}</span>
                <DownloadIcon className="size-3 shrink-0 opacity-60" />
              </a>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">
            {isPreviewable(attachment) ? "Click to preview" : "Click to download"}
          </TooltipContent>
        </Tooltip>
      )}
    />
  )
}

function ThreadMessageCard({
  message,
  expanded,
  onToggle,
  buildDocument,
  buildAttachmentUrl,
  isPreviewable,
  onPreview,
}: {
  message: ThreadMessage
  expanded: boolean
  onToggle: () => void
  buildDocument: (html: string) => string
  buildAttachmentUrl: (emailId: string, attachmentId: string, download?: boolean) => string
  isPreviewable: (attachment: EmailAttachmentRef) => boolean
  onPreview: (message: ThreadMessage, attachment: EmailAttachmentRef) => void
}) {
  const isOutbound = message.direction === "outbound"
  const { name, email: senderEmail } = parseSender(message.from)
  const colors = getAvatarColor(name)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        expanded ? "border-border/60 bg-card/40" : "border-border/40",
        isOutbound && "border-l-2 border-l-primary/40"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold",
            colors.bg,
            colors.text
          )}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold">{name}</span>
            {isOutbound && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                <SendIcon className="size-2.5" />
                Sent
              </span>
            )}
            {message.attachments.length > 0 && (
              <PaperclipIcon className="size-3 shrink-0 text-muted-foreground/40" />
            )}
          </div>
          {!expanded && (
            <p className="truncate text-[11px] text-muted-foreground/60">
              {message.snippet || senderEmail}
            </p>
          )}
          {expanded && (
            <CopyableText value={senderEmail} label="Email copied">
              <p className="truncate text-[11px] text-muted-foreground/60">{senderEmail}</p>
            </CopyableText>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
              {formatListTimestamp(message.date)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left">{formatFullDateTime(message.date)}</TooltipContent>
        </Tooltip>
      </button>

      {expanded && (
        <div className="border-t border-border/30">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11px] text-muted-foreground/70">
            <span>
              <span className="font-heading font-bold uppercase tracking-widest">To</span>{" "}
              {message.to || "—"}
            </span>
            {message.cc && (
              <span>
                <span className="font-heading font-bold uppercase tracking-widest">Cc</span>{" "}
                {message.cc}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3" />
              {formatFullDateTime(message.date)}
            </span>
          </div>
          <div className="border-t border-border/30">
            <MessageBody
              message={message}
              buildDocument={buildDocument}
              buildAttachmentUrl={buildAttachmentUrl}
            />
          </div>
          <AttachmentChips
            message={message}
            buildAttachmentUrl={buildAttachmentUrl}
            isPreviewable={isPreviewable}
            onPreview={onPreview}
          />
        </div>
      )}
    </div>
  )
}

export function ThreadStack({
  messages,
  failedDrafts,
  buildDocument,
  buildAttachmentUrl,
  isPreviewable,
  onPreview,
  onResumeDraft,
}: {
  messages: ThreadMessage[]
  failedDrafts: ThreadMessage[]
  buildDocument: (html: string) => string
  buildAttachmentUrl: (emailId: string, attachmentId: string, download?: boolean) => string
  isPreviewable: (attachment: EmailAttachmentRef) => boolean
  onPreview: (message: ThreadMessage, attachment: EmailAttachmentRef) => void
  onResumeDraft: (draft: ThreadMessage) => void
}) {
  const lastId = messages.at(-1)?._id ?? null
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(lastId ? [lastId] : [])
  )
  const [manuallyToggled, setManuallyToggled] = useState(false)

  // Keep the newest message open as the thread grows, until the user takes over.
  const effectiveExpanded = useMemo(() => {
    if (manuallyToggled) return expandedIds
    return new Set(lastId ? [lastId] : [])
  }, [manuallyToggled, expandedIds, lastId])

  function toggle(id: string) {
    setManuallyToggled(true)
    setExpandedIds((current) => {
      const next = new Set(manuallyToggled ? current : lastId ? [lastId] : [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-muted-foreground/50">
        No messages in this conversation yet
      </div>
    )
  }

  return (
    <div className="space-y-2 px-8 py-4">
      {messages.map((message) => (
        <ThreadMessageCard
          key={message._id}
          message={message}
          expanded={effectiveExpanded.has(message._id)}
          onToggle={() => toggle(message._id)}
          buildDocument={buildDocument}
          buildAttachmentUrl={buildAttachmentUrl}
          isPreviewable={isPreviewable}
          onPreview={onPreview}
        />
      ))}

      {failedDrafts.map((draft) => (
        <button
          key={draft._id}
          type="button"
          onClick={() => onResumeDraft(draft)}
          className="flex w-full items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-left text-[11px] text-destructive transition-colors hover:bg-destructive/10"
        >
          <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">This reply could not be sent</span>
            <span className="block truncate opacity-80">
              {draft.sendError || "Click to reopen the draft and try again"}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

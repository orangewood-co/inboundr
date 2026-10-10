import { useEffect, useRef, useState } from "react"
import {
  AlertCircleIcon,
  ClockIcon,
  LoaderIcon,
  MailIcon,
  MessageSquareIcon,
  PaperclipIcon,
  SendIcon,
  StickyNoteIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AudioPlayer } from "./audio-message"
import { EmojiPicker } from "./emoji-picker"
import { TemplatePicker } from "./template-picker"
import { VoiceRecorder } from "./voice-recorder"
import { fileSize, SUPPORT_MESSAGE_MAX_LENGTH } from "./support-utils"
import type { ComposerMode, EmailChannelState, PendingAttachment, Ticket } from "./types"

const MAX_FILES = 5
const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)

function EmailReplyNotice({ ticket, emailChannel }: { ticket: Ticket; emailChannel: EmailChannelState | null }) {
  if (emailChannel && !emailChannel.canSend) {
    return (
      <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
        <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>{emailChannel.blockedReason ?? "Replies cannot be emailed right now."}</span>
      </div>
    )
  }

  const mailbox = emailChannel?.mailbox ?? ticket.emailThread?.mailbox
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <MailIcon className="size-3.5 shrink-0" />
      <span className="truncate">
        Replies are emailed to {ticket.requester.email || ticket.requester.name}
        {mailbox ? ` from ${mailbox}` : ""}
      </span>
    </p>
  )
}

/**
 * Meta only accepts free-form replies within 24h of the customer's last
 * message. Re-evaluates every minute so the notice appears while a thread is
 * left open.
 */
function WhatsAppWindowNotice({ lastVisitorMessageAt }: { lastVisitorMessageAt: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const closed =
    !lastVisitorMessageAt ||
    now - new Date(lastVisitorMessageAt).getTime() >= WHATSAPP_SERVICE_WINDOW_MS
  if (!closed) return null

  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        The 24-hour WhatsApp reply window has closed. Free-form messages will be rejected by
        WhatsApp until the customer writes again.
      </span>
    </div>
  )
}

const ACCEPTED_FILE_TYPES =
  "application/pdf,image/jpeg,image/png,image/webp,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,video/mp4,video/webm,video/quicktime"

export function Composer({
  ticket,
  sending,
  socketReady,
  emailChannel = null,
  onSend,
  onDraftChange,
}: {
  ticket: Ticket
  sending: boolean
  socketReady: boolean
  emailChannel?: EmailChannelState | null
  onSend: (input: { text: string; files: File[]; isInternal: boolean }) => Promise<boolean>
  onDraftChange: (value: string) => void
}) {
  const [mode, setMode] = useState<ComposerMode>("reply")
  const [draft, setDraft] = useState("")
  const [files, setFiles] = useState<PendingAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const isNote = mode === "note"
  const isEmail = ticket.channel === "email"
  const emailBlocked = isEmail && !isNote && emailChannel !== null && !emailChannel.canSend
  const overLimit = draft.length > SUPPORT_MESSAGE_MAX_LENGTH
  const canSend =
    socketReady && !sending && !overLimit && !emailBlocked && (draft.trim().length > 0 || files.length > 0)

  function updateDraft(value: string) {
    setDraft(value)
    if (mode === "reply") onDraftChange(value)
  }

  function insertAtCursor(text: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      updateDraft(draft + text)
      return
    }
    const start = textarea.selectionStart ?? draft.length
    const end = textarea.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + text + draft.slice(end)
    updateDraft(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + text.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    setFiles((current) => {
      const room = Math.max(0, MAX_FILES - current.length)
      const next = Array.from(fileList)
        .slice(0, room)
        .map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file }))
      return [...current, ...next]
    })
  }

  function addVoice(file: File) {
    setFiles((current) => {
      if (current.length >= MAX_FILES) return current
      return [...current, { id: crypto.randomUUID(), file, audioUrl: URL.createObjectURL(file) }]
    })
  }

  function removeFile(id: string) {
    setFiles((current) => {
      const target = current.find((item) => item.id === id)
      if (target?.audioUrl) URL.revokeObjectURL(target.audioUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  function resetComposer() {
    files.forEach((item) => item.audioUrl && URL.revokeObjectURL(item.audioUrl))
    setDraft("")
    setFiles([])
  }

  async function submit() {
    if (!canSend) return
    const ok = await onSend({ text: draft, files: files.map((item) => item.file), isInternal: isNote })
    if (ok) resetComposer()
  }

  return (
    <div
      className={cn(
        "border-t p-3 transition-colors",
        isNote ? "bg-amber-500/[0.06]" : "bg-background"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-[3px]">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              !isNote ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquareIcon className="size-3.5" />
            Reply
          </button>
          <button
            type="button"
            onClick={() => setMode("note")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              isNote
                ? "bg-background text-amber-700 shadow-sm dark:text-amber-300"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <StickyNoteIcon className="size-3.5" />
            Note
          </button>
        </div>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            overLimit ? "font-medium text-destructive" : "text-muted-foreground"
          )}
        >
          {draft.length}/{SUPPORT_MESSAGE_MAX_LENGTH}
        </span>
      </div>

      {ticket.channel === "whatsapp" && !isNote && (
        <WhatsAppWindowNotice lastVisitorMessageAt={ticket.lastVisitorMessageAt} />
      )}
      {isEmail && !isNote && <EmailReplyNotice ticket={ticket} emailChannel={emailChannel} />}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((item) =>
            item.audioUrl ? (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-1.5"
              >
                <AudioPlayer src={item.audioUrl} />
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove voice message"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ) : (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs"
              >
                <PaperclipIcon className="size-3 shrink-0" />
                <span className="max-w-[12rem] truncate">{item.file.name}</span>
                <span className="text-muted-foreground">{fileSize(item.file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${item.file.name}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            )
          )}
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
          isNote && "border-amber-500/40 focus-within:border-amber-500/60 focus-within:ring-amber-500/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            // Email replies run to several paragraphs, so Enter starts a new line there.
            if (isEmail && !isNote && !(event.metaKey || event.ctrlKey)) return
            event.preventDefault()
            void submit()
          }}
          placeholder={
            isNote
              ? "Add an internal note (only your team can see this)..."
              : isEmail
                ? `Write an email reply... (${IS_MAC ? "⌘" : "Ctrl"}+Enter to send)`
                : "Write a reply..."
          }
          rows={isEmail && !isNote ? 4 : 2}
          className="max-h-40 min-h-10 w-full resize-none bg-transparent px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-1 px-2 pb-2">
          <div className="flex items-center gap-0.5">
            <TemplatePicker ticket={ticket} onInsert={insertAtCursor} disabled={sending} />
            <EmojiPicker onSelect={insertAtCursor} disabled={sending} />
            <label
              className={cn(
                "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
                (sending || files.length >= MAX_FILES) && "pointer-events-none opacity-50"
              )}
              aria-label="Attach files"
            >
              <PaperclipIcon className="size-4" />
              <input
                type="file"
                className="sr-only"
                multiple
                accept={ACCEPTED_FILE_TYPES}
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ""
                }}
              />
            </label>
            <VoiceRecorder onRecorded={addVoice} disabled={sending || files.length >= MAX_FILES} />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={!canSend}
            className={cn(
              "gap-1.5",
              isNote && "bg-amber-500 text-amber-950 hover:bg-amber-500/90"
            )}
          >
            {sending ? <LoaderIcon className="animate-spin" /> : <SendIcon />}
            {isNote ? "Add Note" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}

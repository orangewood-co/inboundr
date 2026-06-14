import { useEffect, useRef, useState } from "react"
import { MicIcon, SendIcon, Trash2Icon } from "lucide-react"

const MAX_DURATION_SECONDS = 120

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ]
  if (typeof MediaRecorder === "undefined") return ""
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported?.(candidate)) return candidate
  }
  return ""
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "m4a"
  if (mime.includes("ogg")) return "ogg"
  return "webm"
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function VoiceRecorder({
  onRecorded,
  disabled,
  accent,
  onAccent,
}: {
  onRecorded: (file: File) => void
  disabled?: boolean
  accent?: string
  onAccent?: string
}) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  function cleanup() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
    setElapsed(0)
  }

  useEffect(() => () => cleanup(), [])

  async function startRecording() {
    if (disabled || recording) return
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      cancelledRef.current = false

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      })
      recorder.addEventListener("stop", () => {
        const wasCancelled = cancelledRef.current
        const type = recorder.mimeType || mimeType || "audio/webm"
        const baseMime = type.split(";")[0]
        const blob = new Blob(chunksRef.current, { type: baseMime })
        cleanup()
        if (wasCancelled || blob.size === 0) return
        const file = new File([blob], `voice-message-${Date.now()}.${extensionFor(baseMime)}`, {
          type: baseMime,
        })
        onRecorded(file)
      })

      recorder.start()
      setRecording(true)
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed((current) => {
          const next = current + 1
          if (next >= MAX_DURATION_SECONDS) stopRecording()
          return next
        })
      }, 1000)
    } catch {
      cleanup()
    }
  }

  function stopRecording() {
    cancelledRef.current = false
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
  }

  function cancelRecording() {
    cancelledRef.current = true
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") recorder.stop()
    else cleanup()
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2 py-1 dark:border-red-900 dark:bg-red-950/40">
        <span className="size-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-medium tabular-nums text-red-600 dark:text-red-400">
          {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          onClick={cancelRecording}
          aria-label="Cancel recording"
          className="flex size-6 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-200/60 dark:hover:bg-stone-700/60"
        >
          <Trash2Icon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={stopRecording}
          aria-label="Use recording"
          className="flex size-6 items-center justify-center rounded-md bg-red-500 text-white transition hover:brightness-95"
          style={accent ? { backgroundColor: accent, color: onAccent } : undefined}
        >
          <SendIcon className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      aria-label="Record voice message"
      className="flex size-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-stone-700/60 dark:hover:text-stone-300"
    >
      <MicIcon className="size-[18px]" />
    </button>
  )
}

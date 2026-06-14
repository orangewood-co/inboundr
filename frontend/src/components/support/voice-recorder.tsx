import { useEffect, useRef, useState } from "react"
import { MicIcon, SendIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

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
}: {
  onRecorded: (file: File) => void
  disabled?: boolean
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
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording is not supported in this browser")
      return
    }
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
      toast.error("Microphone access was denied")
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
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    } else {
      cleanup()
    }
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1">
        <span className="size-2 animate-pulse rounded-full bg-destructive" />
        <span className="text-xs font-medium tabular-nums text-destructive">{formatElapsed(elapsed)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={cancelRecording}
          aria-label="Cancel recording"
        >
          <Trash2Icon />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          onClick={stopRecording}
          aria-label="Use recording"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          <SendIcon />
        </Button>
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={startRecording}
          aria-label="Record voice message"
          className={cn(disabled && "opacity-50")}
        >
          <MicIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Record voice message</TooltipContent>
    </Tooltip>
  )
}

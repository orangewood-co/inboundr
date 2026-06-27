import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { fileSize } from "./support-utils"
import type { TicketAttachment } from "./types"

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const applyDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
        return
      }
      // MediaRecorder webm/opus often reports Infinity until it's seeked once.
      const fix = () => {
        audio.removeEventListener("timeupdate", fix)
        applyDuration()
        audio.currentTime = 0
      }
      audio.addEventListener("timeupdate", fix)
      try {
        audio.currentTime = 1e101
      } catch {
        // Ignore — duration just stays unknown.
      }
    }
    const onTime = () => {
      if (audio.currentTime < 1e6) setCurrent(audio.currentTime)
    }
    const onEnd = () => {
      setPlaying(false)
      setCurrent(0)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("durationchange", applyDuration)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("ended", onEnd)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("durationchange", applyDuration)
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("ended", onEnd)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = pct * duration
  }

  const ratio = duration > 0 ? Math.min(1, current / duration) : 0
  const displayTime = playing || current > 0 ? current : duration

  return (
    <div className={cn("flex w-[14rem] max-w-full items-center gap-2.5", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
      >
        {playing ? (
          <PauseIcon className="size-4" />
        ) : (
          <PlayIcon className="size-4 translate-x-[1px]" fill="currentColor" />
        )}
      </button>
      <div
        onClick={seek}
        className="relative h-1.5 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full bg-foreground/15"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatDuration(displayTime)}
      </span>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  )
}

export function AudioMessage({
  attachment,
  tone = "neutral",
  label = "Voice message",
  showSize = true,
}: {
  attachment: TicketAttachment
  tone?: "neutral" | "agent"
  label?: string
  showSize?: boolean
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit max-w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5",
        tone === "agent" ? "border-primary/20 bg-background/40" : "border-border bg-background/60"
      )}
    >
      <p className="text-xs font-medium text-foreground/70">
        {label}
        {showSize && ` · ${fileSize(attachment.size)}`}
      </p>
      {attachment.url ? (
        <AudioPlayer src={attachment.url} />
      ) : (
        <p className="text-xs text-muted-foreground">Audio unavailable</p>
      )}
    </div>
  )
}

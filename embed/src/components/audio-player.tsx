import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function AudioPlayer({
  src,
  surface = "neutral",
  accent = "#f5b400",
  onAccent = "#1c1917",
}: {
  src: string
  surface?: "neutral" | "accent"
  accent?: string
  onAccent?: string
}) {
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

  const onAcc = surface === "accent"
  const fill = onAcc ? onAccent : accent
  const iconColor = onAcc ? accent : onAccent
  const trackColor = onAcc ? `${onAccent}33` : `${accent}29`
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0
  const displayTime = playing || current > 0 ? current : duration

  return (
    <div className="flex w-[12.5rem] max-w-full items-center gap-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-8 shrink-0 items-center justify-center rounded-full transition active:scale-95"
        style={{ backgroundColor: fill, color: iconColor }}
      >
        {playing ? (
          <PauseIcon className="size-4" />
        ) : (
          <PlayIcon className="size-4 translate-x-[1px]" fill="currentColor" />
        )}
      </button>
      <div
        onClick={seek}
        className="relative h-1.5 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full"
        style={{ backgroundColor: trackColor }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: fill }}
        />
      </div>
      <span
        className={onAcc ? "shrink-0 text-[11px] tabular-nums" : "shrink-0 text-[11px] tabular-nums text-stone-500 dark:text-stone-400"}
        style={onAcc ? { color: onAccent, opacity: 0.8 } : undefined}
      >
        {formatDuration(displayTime)}
      </span>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  )
}

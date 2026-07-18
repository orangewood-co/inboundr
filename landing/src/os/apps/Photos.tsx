import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { MEMES } from "../memes"
import type { AppProps } from "../types"

export interface PhotosPayload {
  index: number
}

function isPhotosPayload(payload: unknown): payload is PhotosPayload {
  return typeof payload === "object" && payload !== null && "index" in payload
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full bg-black/50 text-text/80 backdrop-blur-sm transition-all duration-150 hover:bg-black/70 hover:text-text active:scale-90"
    >
      {children}
    </button>
  )
}

export default function PhotosApp({ payload, focused, minimized }: AppProps) {
  const [index, setIndex] = useState(0)

  // Explorer deep-links by re-sending payload to an open window.
  const [lastPayload, setLastPayload] = useState<unknown>(undefined)
  if (payload !== lastPayload) {
    setLastPayload(payload)
    if (isPhotosPayload(payload)) {
      setIndex(Math.min(Math.max(payload.index, 0), MEMES.length - 1))
    }
  }

  const prev = () => setIndex((i) => (i - 1 + MEMES.length) % MEMES.length)
  const next = () => setIndex((i) => (i + 1) % MEMES.length)

  useEffect(() => {
    if (!focused || minimized) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return
      }
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [focused, minimized])

  const meme = MEMES[index]

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <img
          key={meme.src}
          src={meme.src}
          alt={meme.name}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
        />
        {MEMES.length > 1 && (
          <>
            <div className="absolute inset-y-0 left-3 flex items-center">
              <NavButton label="Previous image" onClick={prev}>
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </NavButton>
            </div>
            <div className="absolute inset-y-0 right-3 flex items-center">
              <NavButton label="Next image" onClick={next}>
                <ChevronRight className="size-5" strokeWidth={1.75} />
              </NavButton>
            </div>
          </>
        )}
      </div>

      {/* Filmstrip */}
      <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-white/[0.08] bg-base/80 px-3 py-2">
        {MEMES.map((m, i) => (
          <button
            key={m.src}
            type="button"
            onClick={() => setIndex(i)}
            title={m.name}
            className={`h-10 w-14 shrink-0 overflow-hidden rounded border transition-all duration-150 ${
              i === index ? "border-green-bright" : "border-white/10 opacity-50 hover:opacity-90"
            }`}
          >
            <img src={m.src} alt="" draggable={false} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.06] bg-base px-4">
        <span className="truncate font-mono text-[11px] text-text-muted">{meme.name}</span>
        <span className="font-mono text-[11px] text-text-dim">
          {index + 1} / {MEMES.length}
        </span>
      </div>
    </div>
  )
}

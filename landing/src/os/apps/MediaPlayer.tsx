import { useState } from "react"
import { Play } from "lucide-react"

/** Every road leads to Rick. */
const VIDEO_ID = "dQw4w9WgXcQ"

const PLAYLIST = [
  { id: "tour", title: "Inboundr product tour (4K)", length: "3:33", grad: "from-[#1a5c3a] to-[#0e1310]" },
  { id: "keynote", title: "Founder keynote — Inbound '26", length: "3:33", grad: "from-[#8a6d1b] to-[#0e1310]" },
  { id: "stories", title: "Customer stories: 3x quote volume", length: "3:33", grad: "from-[#1a6a5c] to-[#0e1310]" },
  { id: "culture", title: "A day at Inboundr (office vlog)", length: "3:33", grad: "from-[#2f5d50] to-[#0e1310]" },
]

export default function MediaPlayerApp() {
  const [current, setCurrent] = useState(PLAYLIST[0])
  const [autoplay, setAutoplay] = useState(false)

  const select = (item: (typeof PLAYLIST)[number]) => {
    setCurrent(item)
    setAutoplay(true)
  }

  return (
    <div className="flex h-full flex-col bg-base lg:flex-row">
      {/* Player */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-black">
          <iframe
            key={`${current.id}-${autoplay}`}
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}${autoplay ? "?autoplay=1" : ""}`}
            title={current.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
          <p className="truncate text-[13px] font-semibold">{current.title}</p>
          <p className="mt-0.5 text-[11px] text-text-dim">
            Inboundr Media · {current.length} · Never gonna buffer
          </p>
        </div>
      </div>

      {/* Playlist */}
      <div className="os-scroll max-h-44 shrink-0 overflow-y-auto border-t border-white/[0.06] p-2 lg:max-h-none lg:w-64 lg:border-l lg:border-t-0">
        <p className="px-2 pb-2 pt-1 text-[12px] font-semibold text-text-muted">Up next</p>
        {PLAYLIST.map((item) => {
          const isActive = current.id === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item)}
              className={`flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors duration-150 ${
                isActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"
              }`}
            >
              <span
                className={`relative flex aspect-video w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br ${item.grad}`}
              >
                <Play className={`size-4 ${isActive ? "text-green-bright" : "text-white/70"}`} fill="currentColor" />
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white/90">
                  {item.length}
                </span>
              </span>
              <span className="min-w-0">
                <span className={`block text-[11.5px] font-medium leading-snug ${isActive ? "text-green-bright" : ""}`}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-text-dim">Inboundr Media</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { Check } from "lucide-react"
import { useOs } from "../context"
import type { WallpaperId } from "../types"

const OPTIONS: Array<{ id: WallpaperId; name: string; note: string }> = [
  { id: "base", name: "Plain", note: "just the dark" },
  { id: "radial", name: "Glow", note: "a green wash up top" },
  { id: "aurora", name: "Aurora", note: "the home hero, unleashed" },
  { id: "noise", name: "Grain", note: "dark with texture" },
]

function Preview({ id }: { id: WallpaperId }) {
  if (id === "radial") {
    return (
      <div className="h-full w-full bg-base [background-image:radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(47,93,80,0.5),transparent)]" />
    )
  }
  if (id === "aurora") {
    return (
      <div className="h-full w-full bg-base [background-image:repeating-linear-gradient(100deg,#3ecf8e_10%,#efc554_18%,#5ddba5_26%,#2f5d50_34%)] opacity-40 blur-[6px]" />
    )
  }
  if (id === "noise") {
    return <div className="noise h-full w-full overflow-hidden bg-surface" />
  }
  return <div className="h-full w-full bg-base" />
}

export default function WallpaperApp() {
  const { wallpaper, setWallpaper } = useOs()

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="label-sm mb-4 text-text-muted">Wallpaper</p>
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((option) => {
            const selected = wallpaper === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setWallpaper(option.id)}
                aria-pressed={selected}
                className={`group border text-left transition-colors duration-200 ${
                  selected ? "border-gold" : "border-border hover:border-white/20"
                }`}
              >
                <div className="relative h-20 overflow-hidden border-b border-border">
                  <Preview id={option.id} />
                  {selected && (
                    <span className="absolute right-2 top-2 flex size-5 items-center justify-center bg-gold text-base">
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold">{option.name}</p>
                  <p className="font-mono text-[10px] text-text-dim">{option.note}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center border-t border-border px-4 font-mono text-[11px] text-text-dim">
        remembered next time you visit
      </div>
    </div>
  )
}

import { AuroraBackground } from "@/components/AuroraBackground"
import { WALLPAPERS } from "./wallpapers"

export default function WallpaperLayer({ id }: { id: string }) {
  const wallpaper = WALLPAPERS.find((w) => w.id === id)

  if (wallpaper?.type === "image" && wallpaper.src) {
    return (
      <img
        src={wallpaper.src}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover"
      />
    )
  }
  if (id === "aurora") {
    return (
      <AuroraBackground showRadialGradient={false} className="absolute inset-0" aria-hidden>
        <></>
      </AuroraBackground>
    )
  }
  if (id === "radial") {
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(47,93,80,0.35),transparent)]"
      />
    )
  }
  if (id === "noise") {
    return <div aria-hidden className="noise absolute inset-0 overflow-hidden bg-surface" />
  }
  return null
}

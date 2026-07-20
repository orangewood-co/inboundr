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
  return null
}

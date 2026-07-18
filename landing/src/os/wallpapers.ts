export interface OsWallpaper {
  id: string
  name: string
  note: string
  type: "image" | "css"
  /** Image URL, for type "image". Drop files in public/os/wallpapers/ and list them here. */
  src?: string
}

export const WALLPAPERS: OsWallpaper[] = [
  { id: "bloom", name: "Bloom", note: "the InboundrOS default", type: "image", src: "/os/wallpapers/bloom.png" },
  { id: "radial", name: "Glow", note: "a green wash up top", type: "css" },
  { id: "aurora", name: "Aurora", note: "the home hero, unleashed", type: "css" },
  { id: "noise", name: "Grain", note: "dark with texture", type: "css" },
  { id: "base", name: "Plain", note: "just the dark", type: "css" },
]

export const DEFAULT_WALLPAPER = "bloom"

export function isWallpaperId(id: string): boolean {
  return WALLPAPERS.some((w) => w.id === id)
}

/**
 * Warm the browser cache for everything the desktop needs the moment it
 * appears: wallpaper images and the taskbar mark. Resolves when everything
 * settled or after the timeout cap, whichever comes first.
 */
export function preloadOsAssets(timeoutMs = 2500): Promise<void> {
  const urls = ["/mark.png", ...WALLPAPERS.filter((w) => w.src).map((w) => w.src!)]
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = url
      }),
  )
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs))
  return Promise.race([Promise.all(loads).then(() => undefined), cap])
}

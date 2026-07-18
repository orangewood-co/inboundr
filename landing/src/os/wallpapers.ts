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
  { id: "furry-green", name: "Furry Green", note: "the fuzzy wordmark", type: "image", src: "/os/wallpapers/inboundr-furry-green.png" },
  { id: "furry-white", name: "Furry White", note: "fuzzy, but minimal", type: "image", src: "/os/wallpapers/inboundr-furry-white.jpg" },
  { id: "ltt-1", name: "Linus Ten", note: "he is watching", type: "image", src: "/os/wallpapers/linus-tech-tips-1.png" },
  { id: "ltt-2", name: "Linus Bliss", note: "a familiar hill", type: "image", src: "/os/wallpapers/linus-tech-tips-2.png" },
]

export const DEFAULT_WALLPAPER = "furry-white"

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

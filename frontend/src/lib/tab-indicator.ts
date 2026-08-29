const UNREAD_PREFIX_RE = /^\(\d+\)\s/
const FAVICON_MAX_COUNT = 9

let baseTitle = document.title
let count = 0
let iconImage: HTMLImageElement | null = null
let iconLoadPromise: Promise<HTMLImageElement | null> | null = null
let originalHrefs: Map<HTMLLinkElement, string> | null = null
let drawToken = 0

function faviconLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
  )
}

function loadIcon(): Promise<HTMLImageElement | null> {
  if (!iconLoadPromise) {
    iconLoadPromise = new Promise((resolve) => {
      const link = faviconLinks()[0]
      if (!link) {
        resolve(null)
        return
      }
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = link.href
    })
    iconLoadPromise.then((img) => {
      iconImage = img
    })
  }
  return iconLoadPromise
}

function drawBadgeIcon(display: string): string | null {
  if (!iconImage) return null
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(iconImage, 0, 0, size, size)

  const pillW = display.length > 1 ? size * 0.62 : size * 0.5
  const pillH = size * 0.5
  const x = size - pillW
  const y = 0
  const r = pillH / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + pillW, y, x + pillW, y + pillH, r)
  ctx.arcTo(x + pillW, y + pillH, x, y + pillH, r)
  ctx.arcTo(x, y + pillH, x, y, r)
  ctx.arcTo(x, y, x + pillW, y, r)
  ctx.closePath()
  ctx.fillStyle = "#e3342f"
  ctx.fill()

  ctx.font = `bold ${Math.round(pillH * 0.72)}px Arial, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "#fff"
  ctx.fillText(display, x + pillW / 2, y + pillH / 2 + 1)
  try {
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}

function applyFavicon() {
  const links = faviconLinks()
  if (!originalHrefs) {
    originalHrefs = new Map(links.map((link) => [link, link.getAttribute("href") ?? ""]))
  }
  if (count <= 0 || !links.length) {
    for (const link of links) {
      const original = originalHrefs.get(link)
      if (original != null) link.setAttribute("href", original)
    }
    navigator.clearAppBadge?.().catch(() => {})
    return
  }
  const token = ++drawToken
  const display = count > FAVICON_MAX_COUNT ? `${FAVICON_MAX_COUNT}+` : String(count)
  void loadIcon().then((img) => {
    if (token !== drawToken) return
    iconImage = img
    const dataUrl = drawBadgeIcon(display)
    if (!dataUrl) return
    for (const link of links) link.setAttribute("href", dataUrl)
  })
  navigator.setAppBadge?.(count).catch(() => {})
}

function applyTitle() {
  const cleanBase = baseTitle.replace(UNREAD_PREFIX_RE, "")
  document.title = count > 0 ? `(${count}) ${cleanBase}` : cleanBase
}

export function setTabUnreadCount(next: number): void {
  const value = Math.max(0, Math.floor(next))
  if (value === count) return
  count = value
  applyTitle()
  applyFavicon()
}

/** All document.title writers must call this instead of assigning directly. */
export function setTabBaseTitle(title: string): void {
  if (title === baseTitle) return
  baseTitle = title
  applyTitle()
}

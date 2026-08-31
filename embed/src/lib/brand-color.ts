/**
 * Derives a contrast-safe palette from an organization's brand color for the
 * dark careers theme. An arbitrary brand color may be unreadable on near-black
 * (navy) or blinding (yellow), so we clamp lightness into ranges that are
 * guaranteed to work on ink surfaces.
 */

const FALLBACK_BRAND = "#e8a33d"

type Hsl = { h: number; s: number; l: number }

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "")
  const expanded = value.length === 3 ? value.split("").map((char) => char + char).join("") : value
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null
  const numeric = parseInt(expanded, 16)
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255]
}

function rgbToHsl([r, g, b]: [number, number, number]): Hsl {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h: number
  if (max === red) h = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4
  return { h: h / 6, s, l }
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }
  const hueToChannel = (p: number, q: number, t: number) => {
    let hue = t
    if (hue < 0) hue += 1
    if (hue > 1) hue -= 1
    if (hue < 1 / 6) return p + (q - p) * 6 * hue
    if (hue < 1 / 2) return q
    if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
    Math.round(hueToChannel(p, q, h) * 255),
    Math.round(hueToChannel(p, q, h - 1 / 3) * 255),
  ]
}

function rgbToHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const linear = [r, g, b].map((channel) => {
    const scaled = channel / 255
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export type BrandPalette = {
  /** Raw brand color, for large translucent glow washes. */
  brand: string
  /** Lightness clamped for solid surfaces (buttons) that must read on ink. */
  brandStrong: string
  /** Lightness boosted for text and icons on near-black backgrounds. */
  brandBright: string
  /** Readable text color on top of brandStrong. */
  brandInk: string
}

export function brandPalette(input: string): BrandPalette {
  const rgb = hexToRgb(input) ?? hexToRgb(FALLBACK_BRAND)!
  const hsl = rgbToHsl(rgb)
  const chromatic = hsl.s > 0.05

  const strong: Hsl = {
    h: hsl.h,
    s: chromatic ? clamp(hsl.s, 0.35, 0.92) : hsl.s,
    l: clamp(hsl.l, 0.46, 0.6),
  }
  const bright: Hsl = {
    h: hsl.h,
    s: chromatic ? clamp(hsl.s, 0.45, 0.95) : hsl.s,
    l: clamp(hsl.l, 0.66, 0.8),
  }
  const strongRgb = hslToRgb(strong)
  // Equal-contrast crossover point between white and near-black text (WCAG).
  const ink = relativeLuminance(strongRgb) > 0.19 ? "#0c0a09" : "#ffffff"

  return {
    brand: rgbToHex(rgb),
    brandStrong: rgbToHex(strongRgb),
    brandBright: rgbToHex(hslToRgb(bright)),
    brandInk: ink,
  }
}

export function applyBrandPalette(primaryColor: string, target: HTMLElement = document.documentElement) {
  const palette = brandPalette(primaryColor)
  target.style.setProperty("--brand", palette.brand)
  target.style.setProperty("--brand-strong", palette.brandStrong)
  target.style.setProperty("--brand-bright", palette.brandBright)
  target.style.setProperty("--brand-ink", palette.brandInk)
}

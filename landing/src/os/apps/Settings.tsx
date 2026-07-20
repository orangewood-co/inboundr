import { useLayoutEffect, useRef, useState } from "react"
import { Info, Monitor, Palette, Check, Moon, Sun } from "lucide-react"
import { useOs } from "../context"
import { WALLPAPERS } from "../wallpapers"
import type { AppProps, SettingsPayload } from "../types"

type Page = "system" | "personalization" | "about"

const NAV: Array<{ id: Page; label: string; icon: typeof Monitor }> = [
  { id: "system", label: "System", icon: Monitor },
  { id: "personalization", label: "Personalization", icon: Palette },
  { id: "about", label: "About", icon: Info },
]

function isSettingsPayload(payload: unknown): payload is SettingsPayload {
  return typeof payload === "object" && payload !== null && "page" in payload
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-10 shrink-0 rounded-full border transition-colors duration-200 ${
        checked ? "border-green-bright bg-green-bright" : "border-white/30 bg-transparent"
      }`}
    >
      <span
        className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-all duration-200 ${
          checked ? "left-[22px] bg-base" : "left-[5px] bg-white/60"
        }`}
      />
    </button>
  )
}

function SettingRow({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-text-dim">{note}</p>
      </div>
      {children}
    </div>
  )
}

function WallpaperPreview({ id }: { id: string }) {
  const wallpaper = WALLPAPERS.find((w) => w.id === id)
  if (wallpaper?.type === "image" && wallpaper.src) {
    return <img src={wallpaper.src} alt="" className="h-full w-full object-cover" draggable={false} />
  }
  return <div className="h-full w-full bg-base" />
}

function SystemPage() {
  const { brightness, setBrightness, animations, setAnimations, notificationsEnabled, setNotificationsEnabled, notify } = useOs()
  const fill = ((brightness - 30) / 70) * 100
  return (
    <div className="space-y-2.5">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">System</h1>

      <SettingRow title="Brightness" note="Also available in quick settings">
        <div className="flex w-40 items-center gap-2.5">
          {brightness > 60 ? (
            <Sun className="size-4 shrink-0 text-text-muted" />
          ) : (
            <Moon className="size-4 shrink-0 text-text-muted" />
          )}
          <input
            type="range"
            min={30}
            max={100}
            value={brightness}
            aria-label="Brightness"
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="os-slider"
            style={{ "--fill": `${fill}%` } as React.CSSProperties}
          />
        </div>
      </SettingRow>

      <SettingRow title="Animations" note="Window and desktop motion effects">
        <Toggle checked={animations} onChange={setAnimations} label="Animations" />
      </SettingRow>

      <SettingRow title="Notifications" note="Only the ones that close deals">
        <Toggle
          checked={notificationsEnabled}
          onChange={(enabled) => {
            setNotificationsEnabled(enabled)
            if (enabled) notify("Notifications on", "You won't miss a single deal.")
          }}
          label="Notifications"
        />
      </SettingRow>

      <SettingRow title="Focus mode" note="Permanently on. We don't do distractions." >
        <span className="text-[11.5px] font-medium text-green-bright">Always</span>
      </SettingRow>

      <SettingRow title="Storage sense" note="Automatically clears cold outreach from disk">
        <span className="text-[11.5px] font-medium text-text-dim">Configured</span>
      </SettingRow>
    </div>
  )
}

function PersonalizationPage() {
  const { wallpaper, setWallpaper } = useOs()
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Personalization</h1>

      {/* Live preview */}
      <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
        <div className="relative aspect-[16/8]">
          <WallpaperPreview id={wallpaper} />
          {/* Mini taskbar to sell the preview */}
          <div className="absolute inset-x-0 bottom-0 flex h-3.5 items-center justify-center gap-1 bg-black/50 backdrop-blur-sm">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="size-1.5 rounded-[2px] bg-white/40" />
            ))}
          </div>
        </div>
      </div>

      <p className="mb-3 text-[13px] font-medium text-text-muted">Choose your wallpaper</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {WALLPAPERS.map((option) => {
          const isActive = wallpaper === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setWallpaper(option.id)}
              aria-pressed={isActive}
              title={option.note}
              className={`group overflow-hidden rounded-lg border text-left transition-all duration-150 ${
                isActive
                  ? "border-green-bright ring-1 ring-green-bright/50"
                  : "border-white/[0.08] hover:border-white/25"
              }`}
            >
              <div className="relative aspect-video">
                <WallpaperPreview id={option.id} />
                {isActive && (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-green-bright text-base">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="px-2.5 py-2 text-[11.5px] font-medium">{option.name}</p>
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-[11.5px] leading-relaxed text-text-dim">
        Drop your own images into <span className="font-mono">public/os/wallpapers/</span> and list
        them in <span className="font-mono">wallpapers.ts</span> to add more.
      </p>
    </div>
  )
}

const SPECS: Array<{ label: string; value: string }> = [
  { label: "Device name", value: "INBOUNDR-PC" },
  { label: "Processor", value: "5x AMD EPYC 9965" },
  { label: "Installed RAM", value: "512 GB DDR5" },
  { label: "Storage", value: "1.2 Petabyte" },
  { label: "Graphics", value: "Nvidia H200" },
  { label: "System type", value: "64-bit revenue engine, browser-based" },
]

function AboutPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">About</h1>
      <div className="mb-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <p className="border-b border-white/[0.06] px-4 py-3 text-[13px] font-semibold">
          Device specifications
        </p>
        <dl>
          {SPECS.map((spec) => (
            <div key={spec.label} className="flex gap-4 px-4 py-2 text-[12.5px]">
              <dt className="w-32 shrink-0 text-text-dim">{spec.label}</dt>
              <dd className="min-w-0 text-text">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <p className="border-b border-white/[0.06] px-4 py-3 text-[13px] font-semibold">
          InboundrOS specifications
        </p>
        <dl>
          <div className="flex gap-4 px-4 py-2 text-[12.5px]">
            <dt className="w-32 shrink-0 text-text-dim">Edition</dt>
            <dd>InboundrOS 26H2 — Revenue edition</dd>
          </div>
          <div className="flex gap-4 px-4 py-2 text-[12.5px]">
            <dt className="w-32 shrink-0 text-text-dim">Version</dt>
            <dd>2.0 "Bloom"</dd>
          </div>
          <div className="flex gap-4 px-4 py-2 pb-3 text-[12.5px]">
            <dt className="w-32 shrink-0 text-text-dim">Installed on</dt>
            <dd>The open web</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

export default function SettingsApp({ payload }: AppProps) {
  const [page, setPage] = useState<Page>("system")
  const rootRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  // Deep links (quick settings / context menu) re-target an open window.
  const [lastPayload, setLastPayload] = useState<unknown>(undefined)
  if (payload !== lastPayload) {
    setLastPayload(payload)
    if (isSettingsPayload(payload)) setPage(payload.page)
  }

  // Collapse the sidebar to an icon rail in narrow windows.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 520))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="flex h-full bg-base">
      {/* Sidebar */}
      <nav className={`shrink-0 border-r border-white/[0.06] py-3 ${narrow ? "w-12 px-1.5" : "w-52 px-2.5"}`}>
        {!narrow && (
          <div className="mb-3 flex items-center gap-2.5 px-2.5 pt-1">
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-green">
              <img src="/mark.png" alt="" className="size-5 object-contain" />
            </span>
            <span>
              <span className="block text-[12.5px] font-medium leading-tight">Guest</span>
              <span className="block text-[10.5px] leading-tight text-text-dim">Local account</span>
            </span>
          </div>
        )}
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPage(item.id)}
            title={item.label}
            className={`relative mb-0.5 flex w-full items-center gap-3 rounded-md py-2 text-[12.5px] font-medium transition-colors duration-150 ${
              narrow ? "justify-center px-0" : "px-3"
            } ${page === item.id ? "bg-white/[0.08] text-text" : "text-text-muted hover:bg-white/[0.05] hover:text-text"}`}
          >
            {page === item.id && (
              <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-green-bright" />
            )}
            <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
            {!narrow && item.label}
          </button>
        ))}
      </nav>

      {/* Page */}
      <div className="os-scroll min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
        {page === "system" && <SystemPage />}
        {page === "personalization" && <PersonalizationPage />}
        {page === "about" && <AboutPage />}
      </div>
    </div>
  )
}

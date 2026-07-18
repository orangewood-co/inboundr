import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { FileText, Moon, Power, RotateCcw, Search } from "lucide-react"
import { APPS } from "./apps/registry"
import { useOs } from "./context"
import type { AppId, ReaderPayload } from "./types"
import { pressReleases } from "@/data/press"
import { blogPosts } from "@/data/blog"

const EASE = [0.25, 1, 0.5, 1] as const

interface RecommendedDoc {
  title: string
  meta: string
  payload: ReaderPayload
}

const RECOMMENDED: RecommendedDoc[] = [
  ...pressReleases.slice(0, 2).map((release) => ({
    title: release.title,
    meta: release.date,
    payload: { kind: "press", slug: release.slug } as ReaderPayload,
  })),
  ...blogPosts.slice(0, 2).map((post) => ({
    title: post.title,
    meta: post.date,
    payload: { kind: "blog", slug: post.slug } as ReaderPayload,
  })),
]

export default function StartMenu({
  onClose,
  onLaunch,
}: {
  onClose: () => void
  onLaunch: (appId: AppId, payload?: unknown) => void
}) {
  const { sleep, restart, shutdown } = useOs()
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")
  const [powerOpen, setPowerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = query.trim()
    ? APPS.filter(
        (app) =>
          app.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          app.tagline.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : null

  const launch = (appId: AppId, payload?: unknown) => {
    onLaunch(appId, payload)
    onClose()
  }

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="os-acrylic absolute bottom-full left-1/2 mb-3 w-[560px] max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-xl border border-white/10 p-6 pb-0"
      role="dialog"
      aria-label="Start menu"
    >
      {/* Search */}
      <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/30 px-4 py-2">
        <Search className="size-4 shrink-0 text-text-dim" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for apps"
          aria-label="Search for apps"
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-dim"
        />
      </div>

      {results ? (
        /* Search results */
        <div className="mt-4 min-h-[280px] pb-6">
          <p className="mb-2 text-[12px] font-semibold text-text-muted">
            {results.length > 0 ? "Best match" : "No results"}
          </p>
          <div className="space-y-0.5">
            {results.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => launch(app.id)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.08]"
              >
                <app.icon className="size-5 text-green-bright" strokeWidth={1.5} />
                <span className="flex-1 text-[13px] font-medium">{app.name}</span>
                <span className="text-[11px] text-text-dim">{app.tagline}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Pinned */}
          <div className="mt-5">
            <p className="mb-3 px-1 text-[12px] font-semibold text-text-muted">Pinned</p>
            <div className="grid grid-cols-4 gap-1">
              {APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => launch(app.id)}
                  title={app.tagline}
                  className="flex flex-col items-center gap-1.5 rounded-md px-2 py-3 transition-colors duration-150 hover:bg-white/[0.08]"
                >
                  <app.icon className="size-6 text-green-bright" strokeWidth={1.25} />
                  <span className="max-w-full truncate text-[11px] font-medium">{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended */}
          <div className="mt-4 pb-5">
            <p className="mb-3 px-1 text-[12px] font-semibold text-text-muted">Recommended</p>
            <div className="grid grid-cols-2 gap-1">
              {RECOMMENDED.map((doc) => (
                <button
                  key={doc.payload.slug}
                  type="button"
                  onClick={() => launch("reader", doc.payload)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.08]"
                >
                  <FileText className="size-5 shrink-0 text-gold/80" strokeWidth={1.5} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium">{doc.title}</span>
                    <span className="block text-[10.5px] text-text-dim">{doc.meta}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="relative -mx-6 flex items-center justify-between rounded-b-xl border-t border-white/[0.08] bg-black/20 px-6 py-3">
        <button
          type="button"
          className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-white/[0.08]"
        >
          <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-green">
            <img src="/mark.png" alt="" className="size-5 object-contain" />
          </span>
          <span className="text-left">
            <span className="block text-[12.5px] font-medium leading-tight">Guest</span>
            <span className="block text-[10.5px] leading-tight text-text-dim">Inboundr</span>
          </span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPowerOpen((open) => !open)}
            aria-expanded={powerOpen}
            aria-label="Power options"
            title="Power"
            className="flex size-9 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-white/10 hover:text-text"
          >
            <Power className="size-4.5" strokeWidth={1.75} />
          </button>

          <AnimatePresence>
            {powerOpen && (
              <motion.div
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: EASE }}
                className="os-acrylic absolute bottom-full right-0 mb-2 w-44 rounded-lg border border-white/10 py-1.5"
                role="menu"
              >
                {[
                  { label: "Sleep", icon: Moon, action: sleep },
                  { label: "Restart", icon: RotateCcw, action: restart },
                  { label: "Shut down", icon: Power, action: shutdown },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onClose()
                      item.action()
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-[12.5px] font-medium transition-colors duration-150 hover:bg-white/[0.08]"
                  >
                    <item.icon className="size-4 text-text-muted" strokeWidth={1.75} />
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

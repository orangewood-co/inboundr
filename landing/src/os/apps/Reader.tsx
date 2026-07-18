import { useState } from "react"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"
import { pressReleases } from "@/data/press"
import { blogPosts } from "@/data/blog"
import type { AppProps, ReaderPayload } from "../types"

type Tab = "press" | "blog"

interface Selection {
  kind: Tab
  slug: string
}

function isReaderPayload(payload: unknown): payload is ReaderPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "kind" in payload &&
    "slug" in payload
  )
}

function ListRow({
  tag,
  bg,
  title,
  date,
  onClick,
}: {
  tag: string
  bg: string
  title: string
  date: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full border-b border-border px-6 py-4 text-left transition-colors duration-200 hover:bg-surface"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className="noise relative overflow-hidden px-2 py-0.5 label-sm" style={{ backgroundColor: bg }}>
          <span className="relative z-10">{tag}</span>
        </span>
        <span className="font-mono text-[11px] text-text-dim">{date}</span>
      </div>
      <p className="text-sm font-semibold leading-snug transition-colors duration-200 group-hover:text-green-bright">
        {title}
      </p>
    </button>
  )
}

export default function ReaderApp({ payload }: AppProps) {
  const [tab, setTab] = useState<Tab>("press")
  const [selection, setSelection] = useState<Selection | null>(null)

  // The Files app deep-links into an already-open Reader by re-sending payload;
  // adjust state during render when the payload prop changes.
  const [lastPayload, setLastPayload] = useState<unknown>(undefined)
  if (payload !== lastPayload) {
    setLastPayload(payload)
    if (isReaderPayload(payload)) {
      setTab(payload.kind)
      setSelection({ kind: payload.kind, slug: payload.slug })
    }
  }

  if (selection) {
    const press = selection.kind === "press" ? pressReleases.find((r) => r.slug === selection.slug) : null
    const blog = selection.kind === "blog" ? blogPosts.find((p) => p.slug === selection.slug) : null
    const item = press ?? blog

    return (
      <div className="flex h-full flex-col bg-base">
        <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-text-muted transition-colors duration-200 hover:bg-white/[0.06] hover:text-text"
          >
            <ArrowLeft className="size-3.5" /> All articles
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!item ? (
            <p className="px-6 py-10 text-sm text-text-muted">This article seems to be missing.</p>
          ) : (
            <article className="px-6 py-8">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="noise relative overflow-hidden px-2 py-0.5 label-sm" style={{ backgroundColor: item.bg }}>
                  <span className="relative z-10">{item.tag}</span>
                </span>
                <span className="font-mono text-[11px] text-text-dim">{item.date}</span>
              </div>
              <h1 className="max-w-xl text-xl font-bold leading-snug tracking-[-0.02em] sm:text-2xl">
                {item.title}
              </h1>

              {press ? (
                <div className="mt-6 max-w-xl space-y-4 text-sm leading-relaxed text-text-muted">
                  {press.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {press.pullQuote && (
                    <blockquote className="my-6 border-l-2 border-gold pl-5">
                      <p className="font-display text-lg italic text-gold">"{press.pullQuote.quote}"</p>
                      <p className="mt-2 label-sm text-text-dim">{press.pullQuote.attribution}</p>
                    </blockquote>
                  )}
                </div>
              ) : (
                <div className="mt-6 max-w-xl space-y-6">
                  <p className="text-sm leading-relaxed text-text-muted">{blog!.excerpt}</p>
                  <Link
                    to="/blog"
                    target="_blank"
                    className="link-underline inline-flex items-center gap-1 text-sm font-medium text-green-bright"
                  >
                    Read the full post on the blog <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        {(["press", "blog"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1 text-[12px] font-semibold transition-colors duration-200 ${
              tab === t ? "bg-white/[0.1] text-text" : "text-text-dim hover:bg-white/[0.05] hover:text-text-muted"
            }`}
          >
            {t === "press" ? "Press" : "Blog"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "press"
          ? pressReleases.map((release) => (
              <ListRow
                key={release.slug}
                tag={release.tag}
                bg={release.bg}
                title={release.title}
                date={release.date}
                onClick={() => setSelection({ kind: "press", slug: release.slug })}
              />
            ))
          : blogPosts.map((post) => (
              <ListRow
                key={post.slug}
                tag={post.tag}
                bg={post.bg}
                title={post.title}
                date={post.date}
                onClick={() => setSelection({ kind: "blog", slug: post.slug })}
              />
            ))}
      </div>
    </div>
  )
}

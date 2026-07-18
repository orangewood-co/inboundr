import { useState } from "react"
import { ArrowLeft, FileText, Folder, Newspaper, Scale, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { pressReleases } from "@/data/press"
import { blogPosts } from "@/data/blog"
import { useOs } from "../context"

interface OsFile {
  id: string
  name: string
  meta: string
  action: { type: "reader"; kind: "press" | "blog"; slug: string } | { type: "link"; to: string }
}

interface OsFolder {
  id: string
  name: string
  icon: LucideIcon
  files: OsFile[]
}

const FOLDERS: OsFolder[] = [
  {
    id: "press",
    name: "Press",
    icon: Newspaper,
    files: pressReleases.map((release) => ({
      id: `press-${release.slug}`,
      name: `${release.slug}.pdf`,
      meta: release.date,
      action: { type: "reader", kind: "press", slug: release.slug },
    })),
  },
  {
    id: "blog",
    name: "Blog",
    icon: FileText,
    files: blogPosts.map((post) => ({
      id: `blog-${post.slug}`,
      name: `${post.slug}.md`,
      meta: post.date,
      action: { type: "reader", kind: "blog", slug: post.slug },
    })),
  },
  {
    id: "legal",
    name: "Legal",
    icon: Scale,
    files: [
      { id: "privacy", name: "privacy-policy.pdf", meta: "opens on the site", action: { type: "link", to: "/privacy" } },
      { id: "terms", name: "terms-of-service.pdf", meta: "opens on the site", action: { type: "link", to: "/terms" } },
      { id: "security", name: "security-overview.pdf", meta: "opens on the site", action: { type: "link", to: "/security" } },
      { id: "subprocessors", name: "subprocessors.csv", meta: "opens on the site", action: { type: "link", to: "/subprocessors" } },
    ],
  },
  {
    id: "team",
    name: "Team",
    icon: Users,
    files: [
      { id: "careers", name: "open-roles.txt", meta: "opens on the site", action: { type: "link", to: "/careers" } },
      { id: "manifesto", name: "manifesto.txt", meta: "opens on the site", action: { type: "link", to: "/about" } },
    ],
  },
]

export default function FilesApp() {
  const { openApp } = useOs()
  const [folderId, setFolderId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const folder = FOLDERS.find((f) => f.id === folderId) ?? null

  const openFile = (file: OsFile) => {
    if (file.action.type === "reader") {
      openApp("reader", { kind: file.action.kind, slug: file.action.slug })
    } else {
      window.open(file.action.to, "_blank", "noopener")
    }
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        {folder ? (
          <button
            type="button"
            onClick={() => {
              setFolderId(null)
              setSelected(null)
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-[13px] font-medium text-text-muted transition-colors duration-200 hover:text-text"
          >
            <ArrowLeft className="size-3.5" /> Home
          </button>
        ) : (
          <span className="px-2 label-sm text-text-dim">Home</span>
        )}
        {folder && (
          <>
            <span className="text-text-dim">/</span>
            <span className="label-sm text-text">{folder.name}</span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!folder ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {FOLDERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderId(f.id)}
                className="flex flex-col items-center gap-2 border border-transparent p-4 transition-colors duration-200 hover:border-border hover:bg-surface"
              >
                <Folder className="size-8 text-green-bright" strokeWidth={1.25} />
                <span className="text-[12px] font-medium">{f.name}</span>
                <span className="font-mono text-[10px] text-text-dim">{f.files.length} items</span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            {folder.files.map((file) => {
              const isSelected = selected === file.id
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => (isSelected ? openFile(file) : setSelected(file.id))}
                  onDoubleClick={() => openFile(file)}
                  className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors duration-200 ${
                    isSelected ? "bg-surface-raised" : "hover:bg-surface"
                  }`}
                >
                  <FileText className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{file.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-text-dim">{file.meta}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center border-t border-border px-4 font-mono text-[11px] text-text-dim">
        {folder ? "click to select, click again to open" : `${FOLDERS.length} folders`}
      </div>
    </div>
  )
}

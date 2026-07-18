import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Folder,
  HardDrive,
  Home,
  LayoutGrid,
  List,
  Monitor,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { pressReleases } from "@/data/press"
import { blogPosts } from "@/data/blog"
import { MEMES } from "../memes"
import { useOs } from "../context"
import type { AppProps } from "../types"

type LocationId =
  | "home"
  | "thispc"
  | "drive-c"
  | "drive-d"
  | "drive-e"
  | "press"
  | "blog"
  | "legal"
  | "team"
  | "documents"
  | "memes"

export interface ExplorerPayload {
  location: string
}

function isExplorerPayload(payload: unknown): payload is ExplorerPayload {
  return typeof payload === "object" && payload !== null && "location" in payload
}

interface FsFile {
  id: string
  name: string
  meta: string
  icon?: LucideIcon
  /** Thumbnail image; rendered instead of the icon in grid view. */
  thumb?: string
  action?:
    | { type: "reader"; kind: "press" | "blog"; slug: string }
    | { type: "link"; to: string }
    | { type: "photos"; index: number }
}

const FOLDER_FILES: Record<string, FsFile[]> = {
  memes: MEMES.map((meme, i) => ({
    id: `meme-${meme.name}`,
    name: meme.name,
    meta: "certified fresh",
    thumb: meme.src,
    action: { type: "photos", index: i },
  })),
  press: pressReleases.map((release) => ({
    id: `press-${release.slug}`,
    name: `${release.slug}.pdf`,
    meta: release.date,
    action: { type: "reader", kind: "press", slug: release.slug },
  })),
  blog: blogPosts.map((post) => ({
    id: `blog-${post.slug}`,
    name: `${post.slug}.md`,
    meta: post.date,
    action: { type: "reader", kind: "blog", slug: post.slug },
  })),
  legal: [
    { id: "privacy", name: "privacy-policy.pdf", meta: "opens on the site", action: { type: "link", to: "/privacy" } },
    { id: "terms", name: "terms-of-service.pdf", meta: "opens on the site", action: { type: "link", to: "/terms" } },
    { id: "security", name: "security-overview.pdf", meta: "opens on the site", action: { type: "link", to: "/security" } },
    { id: "subprocessors", name: "subprocessors.csv", meta: "opens on the site", icon: FileSpreadsheet, action: { type: "link", to: "/subprocessors" } },
  ],
  team: [
    { id: "careers", name: "open-roles.txt", meta: "opens on the site", action: { type: "link", to: "/careers" } },
    { id: "manifesto", name: "manifesto.txt", meta: "opens on the site", action: { type: "link", to: "/about" } },
  ],
  documents: [
    { id: "playbook", name: "inbound-playbook-final-v37-FINAL.docx", meta: "still not final" },
    { id: "pipeline", name: "q3-pipeline.xlsx", meta: "big if true", icon: FileSpreadsheet },
    { id: "passwords", name: "definitely-not-passwords.txt", meta: "nothing to see here" },
  ],
}

const FOLDERS: Array<{ id: LocationId; name: string }> = [
  { id: "memes", name: "Memes" },
  { id: "press", name: "Press" },
  { id: "blog", name: "Blog" },
  { id: "legal", name: "Legal" },
  { id: "team", name: "Team" },
  { id: "documents", name: "Documents" },
]

const DRIVES: Array<{ id: LocationId; name: string; used: number; detail: string }> = [
  { id: "drive-c", name: "Local Disk (C:) — InboundrOS", used: 42, detail: "148 GB free of 256 GB" },
  { id: "drive-d", name: "Leads (D:)", used: 98, detail: "You should really follow up" },
  { id: "drive-e", name: "Archive (E:)", used: 12, detail: "Cold outreach, quarantined" },
]

const DRIVE_FILES: Record<string, FsFile[]> = {
  "drive-d": [
    { id: "leads", name: "warm-leads-backlog.csv", meta: "3.2 GB — growing" },
    { id: "hot", name: "hot-leads.csv", meta: "handled by Inboundr already" },
  ],
  "drive-e": [{ id: "outreach", name: "cold-outreach-2019.zip", meta: "do not open" }],
}

/** Breadcrumb trail for each location, in order. */
const TRAIL: Record<LocationId, Array<{ id: LocationId; label: string }>> = {
  home: [{ id: "home", label: "Home" }],
  thispc: [{ id: "thispc", label: "This PC" }],
  "drive-c": [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
  ],
  "drive-d": [
    { id: "thispc", label: "This PC" },
    { id: "drive-d", label: "Leads (D:)" },
  ],
  "drive-e": [
    { id: "thispc", label: "This PC" },
    { id: "drive-e", label: "Archive (E:)" },
  ],
  press: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "press", label: "Press" },
  ],
  blog: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "blog", label: "Blog" },
  ],
  legal: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "legal", label: "Legal" },
  ],
  team: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "team", label: "Team" },
  ],
  documents: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "documents", label: "Documents" },
  ],
  memes: [
    { id: "thispc", label: "This PC" },
    { id: "drive-c", label: "Local Disk (C:)" },
    { id: "memes", label: "Memes" },
  ],
}

function parentOf(location: LocationId): LocationId | null {
  const trail = TRAIL[location]
  return trail.length > 1 ? trail[trail.length - 2].id : null
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-md transition-colors duration-150 ${
        disabled ? "text-text-dim/50" : "text-text-muted hover:bg-white/[0.08] hover:text-text"
      }`}
    >
      {children}
    </button>
  )
}

export default function ExplorerApp({ payload }: AppProps) {
  const { openApp } = useOs()
  const [history, setHistory] = useState<LocationId[]>(["home"])
  const [index, setIndex] = useState(0)
  const [view, setView] = useState<"grid" | "list">("grid")
  const [selected, setSelected] = useState<string | null>(null)

  const location = history[index]

  const navigate = (target: LocationId) => {
    if (target === location) return
    setHistory([...history.slice(0, index + 1), target])
    setIndex(index + 1)
    setSelected(null)
  }

  // Desktop shortcuts deep-link a location by (re-)sending payload.
  const [lastPayload, setLastPayload] = useState<unknown>(undefined)
  if (payload !== lastPayload) {
    setLastPayload(payload)
    if (isExplorerPayload(payload) && payload.location in TRAIL && payload.location !== location) {
      const target = payload.location as LocationId
      setHistory([...history.slice(0, index + 1), target])
      setIndex(index + 1)
      setSelected(null)
    }
  }
  const back = () => index > 0 && (setIndex(index - 1), setSelected(null))
  const forward = () => index < history.length - 1 && (setIndex(index + 1), setSelected(null))
  const up = () => {
    const parent = parentOf(location)
    if (parent) navigate(parent)
  }

  const openFile = (file: FsFile) => {
    if (!file.action) return
    if (file.action.type === "reader") {
      openApp("reader", { kind: file.action.kind, slug: file.action.slug })
    } else if (file.action.type === "photos") {
      openApp("photos", { index: file.action.index })
    } else {
      window.open(file.action.to, "_blank", "noopener")
    }
  }

  const files: FsFile[] = useMemo(() => {
    if (location in FOLDER_FILES) return FOLDER_FILES[location]
    if (location in DRIVE_FILES) return DRIVE_FILES[location]
    return []
  }, [location])

  const itemCount =
    location === "home"
      ? FOLDERS.length
      : location === "thispc"
        ? DRIVES.length
        : location === "drive-c"
          ? FOLDERS.length
          : files.length

  /* --------------------------------- pieces --------------------------------- */

  const renderFolderTile = (folder: { id: LocationId; name: string }) => (
    <button
      key={folder.id}
      type="button"
      onDoubleClick={() => navigate(folder.id)}
      onClick={() => (selected === folder.id ? navigate(folder.id) : setSelected(folder.id))}
      className={`flex flex-col items-center gap-2 rounded-md border p-4 transition-colors duration-150 ${
        selected === folder.id
          ? "border-green-bright/40 bg-green-bright/10"
          : "border-transparent hover:border-white/10 hover:bg-white/[0.05]"
      }`}
    >
      <Folder className="size-9 fill-green/40 text-green-bright" strokeWidth={1.25} />
      <span className="text-[12px] font-medium">{folder.name}</span>
    </button>
  )

  const renderFile = (file: FsFile) => {
    const Icon = file.icon ?? FileText
    const isSelected = selected === file.id
    const inert = !file.action
    if (view === "grid") {
      return (
        <button
          key={file.id}
          type="button"
          title={inert ? "This one stays on the disk" : undefined}
          onDoubleClick={() => openFile(file)}
          onClick={() => (isSelected ? openFile(file) : setSelected(file.id))}
          className={`flex w-full flex-col items-center gap-2 rounded-md border p-4 text-center transition-colors duration-150 ${
            isSelected
              ? "border-green-bright/40 bg-green-bright/10"
              : "border-transparent hover:border-white/10 hover:bg-white/[0.05]"
          }`}
        >
          {file.thumb ? (
            <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-white/[0.08] bg-black/40">
              <img
                src={file.thumb}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <Icon className={`size-9 ${inert ? "text-text-dim" : "text-text-muted"}`} strokeWidth={1.25} />
          )}
          <span className="w-full break-all font-mono text-[11px] leading-tight">{file.name}</span>
          <span className="text-[10px] text-text-dim">{file.meta}</span>
        </button>
      )
    }
    return (
      <button
        key={file.id}
        type="button"
        title={inert ? "This one stays on the disk" : undefined}
        onDoubleClick={() => openFile(file)}
        onClick={() => (isSelected ? openFile(file) : setSelected(file.id))}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 ${
          isSelected ? "bg-green-bright/10" : "hover:bg-white/[0.05]"
        }`}
      >
        {file.thumb ? (
          <img
            src={file.thumb}
            alt=""
            loading="lazy"
            draggable={false}
            className="size-5 shrink-0 rounded-sm border border-white/[0.08] object-cover"
          />
        ) : (
          <Icon className={`size-4 shrink-0 ${inert ? "text-text-dim" : "text-text-muted"}`} strokeWidth={1.5} />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{file.name}</span>
        <span className="shrink-0 text-[10.5px] text-text-dim">{file.meta}</span>
      </button>
    )
  }

  /* --------------------------------- render --------------------------------- */

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-white/[0.06] px-2">
        <ToolbarButton label="Back" disabled={index === 0} onClick={back}>
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label="Forward" disabled={index >= history.length - 1} onClick={forward}>
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </ToolbarButton>
        <ToolbarButton label="Up" disabled={!parentOf(location)} onClick={up}>
          <ArrowUp className="size-4" strokeWidth={1.75} />
        </ToolbarButton>

        {/* Breadcrumbs */}
        <div className="mx-1 flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-md border border-white/[0.08] bg-white/[0.03] px-2">
          {TRAIL[location].map((crumb, i, arr) => (
            <span key={crumb.id} className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => navigate(crumb.id)}
                className={`rounded px-1.5 py-0.5 text-[12px] transition-colors duration-150 ${
                  i === arr.length - 1
                    ? "font-medium text-text"
                    : "text-text-muted hover:bg-white/[0.08] hover:text-text"
                }`}
              >
                {crumb.label}
              </button>
              {i < arr.length - 1 && <ChevronRight className="size-3 text-text-dim" />}
            </span>
          ))}
        </div>

        <ToolbarButton label={view === "grid" ? "List view" : "Grid view"} onClick={() => setView(view === "grid" ? "list" : "grid")}>
          {view === "grid" ? <List className="size-4" strokeWidth={1.75} /> : <LayoutGrid className="size-4" strokeWidth={1.75} />}
        </ToolbarButton>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <nav className="hidden w-44 shrink-0 space-y-0.5 border-r border-white/[0.06] p-2 sm:block">
          {[
            { id: "home" as LocationId, label: "Home", icon: Home },
            { id: "thispc" as LocationId, label: "This PC", icon: Monitor },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ${
                location === item.id ? "bg-white/[0.08] text-text" : "text-text-muted hover:bg-white/[0.05] hover:text-text"
              }`}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
          <div className="mx-2 my-2 h-px bg-white/[0.06]" />
          {FOLDERS.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => navigate(folder.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors duration-150 ${
                location === folder.id ? "bg-white/[0.08] text-text" : "text-text-muted hover:bg-white/[0.05] hover:text-text"
              }`}
            >
              <Folder className="size-4 text-green-bright/80" strokeWidth={1.75} />
              {folder.name}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="os-scroll min-w-0 flex-1 overflow-y-auto p-3">
          {location === "home" && (
            <>
              <p className="mb-2 px-1 text-[12px] font-semibold text-text-muted">Quick access</p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1.5">
                {FOLDERS.map(renderFolderTile)}
              </div>
              <p className="mb-2 mt-5 px-1 text-[12px] font-semibold text-text-muted">Recent</p>
              <div className="space-y-0.5">
                {[...FOLDER_FILES.press.slice(0, 2), ...FOLDER_FILES.blog.slice(0, 2)].map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => openFile(file)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.05]"
                  >
                    <FileText className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{file.name}</span>
                    <span className="shrink-0 text-[10.5px] text-text-dim">{file.meta}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {location === "thispc" && (
            <>
              <p className="mb-2 px-1 text-[12px] font-semibold text-text-muted">
                Devices and drives
              </p>
              <div className="grid gap-1.5 lg:grid-cols-2">
                {DRIVES.map((drive) => (
                  <button
                    key={drive.id}
                    type="button"
                    onDoubleClick={() => navigate(drive.id)}
                    onClick={() => (selected === drive.id ? navigate(drive.id) : setSelected(drive.id))}
                    className={`flex items-center gap-3.5 rounded-md border p-3.5 text-left transition-colors duration-150 ${
                      selected === drive.id
                        ? "border-green-bright/40 bg-green-bright/10"
                        : "border-transparent hover:border-white/10 hover:bg-white/[0.05]"
                    }`}
                  >
                    <HardDrive className="size-9 shrink-0 text-text-muted" strokeWidth={1.25} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{drive.name}</span>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <span
                          className={`block h-full rounded-full ${drive.used > 90 ? "bg-[#c42b1c]" : "bg-green-bright"}`}
                          style={{ width: `${drive.used}%` }}
                        />
                      </span>
                      <span className="mt-1 block text-[10.5px] text-text-dim">{drive.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {location === "drive-c" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1.5">
              {FOLDERS.map(renderFolderTile)}
            </div>
          )}

          {(location in FOLDER_FILES || location in DRIVE_FILES) && (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-1.5"
                  : "space-y-0.5"
              }
            >
              {files.map(renderFile)}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-white/[0.06] px-3 text-[11px] text-text-dim">
        <span>{itemCount} items</span>
        <span className="hidden sm:block">
          {selected ? "1 item selected — click again to open" : "InboundrOS"}
        </span>
      </div>
    </div>
  )
}

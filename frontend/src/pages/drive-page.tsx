import * as React from "react"
import { toast } from "sonner"
import {
  DownloadIcon,
  Edit3Icon,
  EyeIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  HardDriveIcon,
  ImageIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SearchIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
  Users2Icon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { CopyableText } from "@/components/copy-button"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  canPreview,
  createDriveExport,
  createDriveFolder,
  createDrivePublicLink,
  formatBytes,
  getDriveExport,
  getDriveFileUrl,
  listDriveNodes,
  listDrivePublicLinks,
  listDriveShares,
  moveDriveNode,
  permanentlyDeleteDriveNode,
  renameDriveNode,
  restoreDriveNode,
  revokeDrivePublicLink,
  shareDriveNode,
  trashDriveNode,
  unshareDriveNode,
  uploadDriveFile,
  type DriveNode,
  type DrivePublicLink,
  type DriveShare,
} from "@/lib/drive"

type DriveView = "my" | "shared" | "trash"
type LayoutMode = "list" | "grid"

const LAYOUT_STORAGE_KEY = "drive:layout"

function getInitialLayout(): LayoutMode {
  if (typeof window === "undefined") return "list"
  return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === "grid" ? "grid" : "list"
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.345, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Number.POSITIVE_INFINITY, unit: "year" },
  ] as const

  let duration = diffInSeconds
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" }).format(
        Math.round(duration),
        division.unit
      )
    }
    duration /= division.amount
  }

  return "-"
}

function iconForNode(node: DriveNode): { Icon: typeof FileIcon; className: string } {
  if (node.type === "folder") return { Icon: FolderIcon, className: "text-sky-500" }
  const type = node.contentType ?? ""
  const name = node.name.toLowerCase()
  if (type.startsWith("image/")) return { Icon: ImageIcon, className: "text-violet-500" }
  if (type.startsWith("video/")) return { Icon: FileVideoIcon, className: "text-rose-500" }
  if (type.startsWith("audio/")) return { Icon: FileAudioIcon, className: "text-amber-500" }
  if (type === "application/pdf" || type.startsWith("text/")) {
    return { Icon: FileTextIcon, className: "text-emerald-500" }
  }
  if (/\.(zip|rar|7z|tar|gz|bz2)$/.test(name) || type.includes("zip") || type.includes("compressed")) {
    return { Icon: FileArchiveIcon, className: "text-orange-500" }
  }
  return { Icon: FileIcon, className: "text-muted-foreground" }
}

export default function DrivePage() {
  const [nodes, setNodes] = React.useState<DriveNode[]>([])
  const [view, setView] = React.useState<DriveView>("my")
  const [layout, setLayout] = React.useState<LayoutMode>(getInitialLayout)
  const [parent, setParent] = React.useState<DriveNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveNode[]>([])
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [upload, setUpload] = React.useState<{ name: string; progress: number } | null>(null)
  const [viewer, setViewer] = React.useState<{ node: DriveNode; url: string } | null>(null)
  const [sharingNode, setSharingNode] = React.useState<DriveNode | null>(null)
  const [folderDialog, setFolderDialog] = React.useState<{ mode: "create" | "rename"; node?: DriveNode } | null>(null)
  const [moveNodeTarget, setMoveNodeTarget] = React.useState<DriveNode | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DriveNode | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const loadNodes = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await listDriveNodes({
        parentId: view === "my" ? parent?._id : null,
        view,
        search: debouncedSearch,
      })
      setNodes(response.nodes)
    } catch (err: any) {
      toast.error(err.message || "Failed to load Drive")
    } finally {
      setLoading(false)
    }
  }, [parent?._id, debouncedSearch, view])

  React.useEffect(() => {
    void loadNodes()
  }, [loadNodes])

  function changeLayout(next: LayoutMode) {
    setLayout(next)
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, next)
  }

  function changeView(next: DriveView) {
    setView(next)
    setParent(null)
    setBreadcrumbs([])
  }

  function openFolder(node: DriveNode) {
    setView("my")
    setParent(node)
    setBreadcrumbs((items) => [...items, node])
  }

  function jumpToCrumb(index: number) {
    if (index < 0) {
      setParent(null)
      setBreadcrumbs([])
      return
    }
    const next = breadcrumbs[index]
    setParent(next)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))
  }

  async function handleUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUpload({ name: file.name, progress: 0 })
    try {
      await uploadDriveFile(file, parent?._id ?? null, (progress) =>
        setUpload({ name: file.name, progress })
      )
      toast.success("File uploaded")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setUpload(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function openViewer(node: DriveNode) {
    try {
      const { url } = await getDriveFileUrl(node._id)
      setViewer({ node, url })
    } catch (err: any) {
      toast.error(err.message || "Unable to preview file")
    }
  }

  async function downloadNode(node: DriveNode) {
    try {
      if (node.type === "folder") {
        const { job } = await createDriveExport(node._id)
        toast.info("Folder ZIP export started")
        pollExport(job._id)
        return
      }
      const { url } = await getDriveFileUrl(node._id, true)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err: any) {
      toast.error(err.message || "Download failed")
    }
  }

  async function pollExport(jobId: string) {
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
      const { job } = await getDriveExport(jobId)
      if (job?.status === "failed") {
        toast.error(job.error || "Folder export failed")
        return
      }
      if (job?.status === "completed") {
        const result = await getDriveExport(jobId, true)
        if (result.url) window.open(result.url, "_blank", "noopener,noreferrer")
        return
      }
    }
    toast.info("Export is still running. Try download again shortly.")
  }

  function activateNode(node: DriveNode) {
    if (node.type === "folder") openFolder(node)
    else if (canPreview(node)) void openViewer(node)
    else void downloadNode(node)
  }

  async function moveToTrash(node: DriveNode) {
    try {
      await trashDriveNode(node._id)
      toast.success("Moved to Trash")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Delete failed")
    }
  }

  async function restoreNode(node: DriveNode) {
    try {
      await restoreDriveNode(node._id)
      toast.success("Restored")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Restore failed")
    }
  }

  const isEmpty = !loading && nodes.length === 0

  function renderActions(node: DriveNode) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {node.type === "file" && canPreview(node) && (
            <DropdownMenuItem onClick={() => void openViewer(node)}>
              <EyeIcon className="size-4" />
              Preview
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => void downloadNode(node)}>
            <DownloadIcon className="size-4" />
            Download
          </DropdownMenuItem>
          {view !== "trash" && (
            <>
              <DropdownMenuItem onClick={() => setFolderDialog({ mode: "rename", node })}>
                <Edit3Icon className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMoveNodeTarget(node)}>
                <FolderInputIcon className="size-4" />
                Move
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSharingNode(node)}>
                <Share2Icon className="size-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {view === "trash" && (
            <DropdownMenuItem onClick={() => void restoreNode(node)}>
              <RotateCcwIcon className="size-4" />
              Restore
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => (view === "trash" ? setDeleteTarget(node) : void moveToTrash(node))}
          >
            <Trash2Icon className="size-4" />
            {view === "trash" ? "Delete forever" : "Move to Trash"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <TooltipProvider>
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Drive" }]} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />

          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <HardDriveIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Drive</h2>
              {!loading && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                  {nodes.length.toLocaleString("en-IN")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setFolderDialog({ mode: "create" })}>
                <FolderPlusIcon className="size-4" />
                New folder
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                Upload
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <Tabs value={view} onValueChange={(value) => changeView(value as DriveView)}>
              <TabsList>
                <TabsTrigger value="my">My files</TabsTrigger>
                <TabsTrigger value="shared">Shared with me</TabsTrigger>
                <TabsTrigger value="trash">Trash</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative ml-auto min-w-56 flex-1 sm:max-w-xs">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search Drive"
                className="pl-9"
              />
            </div>

            <div className="flex items-center rounded-lg border p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === "list" ? "secondary" : "ghost"}
                    size="icon-sm"
                    onClick={() => changeLayout("list")}
                  >
                    <ListIcon className="size-4" />
                    <span className="sr-only">List view</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>List view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layout === "grid" ? "secondary" : "ghost"}
                    size="icon-sm"
                    onClick={() => changeLayout("grid")}
                  >
                    <LayoutGridIcon className="size-4" />
                    <span className="sr-only">Grid view</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {view === "my" && (
            <div className="border-b px-4 py-2.5">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    {breadcrumbs.length === 0 ? (
                      <BreadcrumbPage className="flex items-center gap-1.5">
                        <HardDriveIcon className="size-3.5" />
                        Drive
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5"
                          onClick={() => jumpToCrumb(-1)}
                        >
                          <HardDriveIcon className="size-3.5" />
                          Drive
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {breadcrumbs.map((crumb, index) => {
                    const isLast = index === breadcrumbs.length - 1
                    return (
                      <React.Fragment key={crumb._id}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <button type="button" onClick={() => jumpToCrumb(index)}>
                                {crumb.name}
                              </button>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          )}

          {upload && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm shadow-xs">
              <Spinner className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{upload.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{upload.progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <DriveSkeleton layout={layout} />
          ) : isEmpty ? (
            <DriveEmptyState view={view} search={debouncedSearch} hasParent={Boolean(parent)} />
          ) : layout === "list" ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5">Name</th>
                    <th className="px-5 py-2.5">Type</th>
                    <th className="px-5 py-2.5">Size</th>
                    <th className="px-5 py-2.5">Access</th>
                    <th className="px-5 py-2.5">Updated</th>
                    <th className="w-12 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="animate-in fade-in-0 duration-300">
                  {nodes.map((node) => {
                    const { Icon, className } = iconForNode(node)
                    return (
                      <tr
                        key={node._id}
                        className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30"
                        onClick={() => activateNode(node)}
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5 font-medium">
                            <Icon className={cn("size-4 shrink-0", className)} />
                            <span className="truncate">{node.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 align-middle text-muted-foreground">
                          {node.type === "folder" ? "Folder" : node.contentType || "File"}
                        </td>
                        <td className="px-5 py-3 align-middle tabular-nums text-muted-foreground">
                          {node.type === "folder" ? "-" : formatBytes(node.size)}
                        </td>
                        <td className="px-5 py-3 align-middle capitalize text-muted-foreground">
                          {node.role ?? "viewer"}
                        </td>
                        <td className="px-5 py-3 align-middle text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{formatRelativeTime(node.updatedAt)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatDate(node.updatedAt)}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                            {renderActions(node)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-2 gap-3 animate-in fade-in-0 duration-300 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {nodes.map((node) => {
                  const { Icon, className } = iconForNode(node)
                  return (
                    <div
                      key={node._id}
                      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
                      onClick={() => activateNode(node)}
                    >
                      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                        {renderActions(node)}
                      </div>
                      <div className="flex h-20 items-center justify-center rounded-lg bg-muted/40">
                        <Icon className={cn("size-9", className)} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={node.name}>
                          {node.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {node.type === "folder" ? "Folder" : formatBytes(node.size)}
                          {" · "}
                          {formatRelativeTime(node.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </AppLayout>

      <FileViewerDialog viewer={viewer} onOpenChange={(open) => !open && setViewer(null)} />
      <ShareDialog node={sharingNode} onOpenChange={(open) => !open && setSharingNode(null)} />
      <FolderNameDialog
        state={folderDialog}
        onOpenChange={(open) => !open && setFolderDialog(null)}
        onDone={loadNodes}
        parentId={parent?._id ?? null}
      />
      <MoveDialog
        node={moveNodeTarget}
        onOpenChange={(open) => !open && setMoveNodeTarget(null)}
        onDone={loadNodes}
      />
      <DeleteDialog
        node={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDone={loadNodes}
      />
    </TooltipProvider>
  )
}

function DriveSkeleton({ layout }: { layout: LayoutMode }) {
  if (layout === "grid") {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex-1 divide-y overflow-hidden">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[2fr_1fr_0.6fr_0.6fr_1fr_3rem] items-center gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-8 rounded-lg justify-self-end" />
        </div>
      ))}
    </div>
  )
}

function DriveEmptyState({
  view,
  search,
  hasParent,
}: {
  view: DriveView
  search: string
  hasParent: boolean
}) {
  let Icon = FolderIcon
  let title = "This folder is empty"
  let description = "Upload a file or create a folder to get started."

  if (search) {
    Icon = SearchIcon
    title = "No matches found"
    description = "Try a different file or folder name."
  } else if (view === "shared") {
    Icon = Users2Icon
    title = "Nothing shared with you"
    description = "Files and folders shared by your team will appear here."
  } else if (view === "trash") {
    Icon = Trash2Icon
    title = "Trash is empty"
    description = "Items you delete will rest here before being removed permanently."
  } else if (!hasParent) {
    Icon = HardDriveIcon
    title = "Your Drive is empty"
    description = "Upload a file or create a folder to get started."
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function FolderNameDialog({
  state,
  onOpenChange,
  onDone,
  parentId,
}: {
  state: { mode: "create" | "rename"; node?: DriveNode } | null
  onOpenChange: (open: boolean) => void
  onDone: () => Promise<void> | void
  parentId: string | null
}) {
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (state) setName(state.mode === "rename" ? state.node?.name ?? "" : "")
  }, [state])

  const isRename = state?.mode === "rename"

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (isRename && trimmed === state?.node?.name) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      if (isRename && state?.node) {
        await renameDriveNode(state.node._id, trimmed)
        toast.success("Renamed")
      } else {
        await createDriveFolder(trimmed, parentId)
        toast.success("Folder created")
      }
      onOpenChange(false)
      await onDone()
    } catch (err: any) {
      toast.error(err.message || (isRename ? "Rename failed" : "Failed to create folder"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isRename ? "Rename" : "New folder"}</DialogTitle>
          <DialogDescription>
            {isRename ? "Enter a new name for this item." : "Give your folder a name."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="drive-folder-name">Name</Label>
          <Input
            id="drive-folder-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void submit()
              }
            }}
            placeholder={isRename ? "Item name" : "Untitled folder"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving && <Spinner data-icon="inline-start" />}
            {isRename ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({
  node,
  onOpenChange,
  onDone,
}: {
  node: DriveNode | null
  onOpenChange: (open: boolean) => void
  onDone: () => Promise<void> | void
}) {
  const [target, setTarget] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (node) setTarget("")
  }, [node])

  async function submit() {
    if (!node) return
    setSaving(true)
    try {
      await moveDriveNode(node._id, target.trim() || null)
      toast.success("Moved")
      onOpenChange(false)
      await onDone()
    } catch (err: any) {
      toast.error(err.message || "Move failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Move {node?.name}</DialogTitle>
          <DialogDescription>
            Paste the destination folder ID, or leave it empty to move to the Drive root.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="drive-move-target">Destination folder ID</Label>
          <Input
            id="drive-move-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="Leave empty for Drive root"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  node,
  onOpenChange,
  onDone,
}: {
  node: DriveNode | null
  onOpenChange: (open: boolean) => void
  onDone: () => Promise<void> | void
}) {
  const [deleting, setDeleting] = React.useState(false)

  async function submit() {
    if (!node) return
    setDeleting(true)
    try {
      await permanentlyDeleteDriveNode(node._id)
      toast.success("Deleted permanently")
      onOpenChange(false)
      await onDone()
    } catch (err: any) {
      toast.error(err.message || "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete forever</DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-medium text-foreground">{node?.name}</span>? This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={deleting}>
            {deleting && <Spinner data-icon="inline-start" />}
            Delete forever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FileViewerDialog({
  viewer,
  onOpenChange,
}: {
  viewer: { node: DriveNode; url: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const type = viewer?.node.contentType ?? ""
  return (
    <Dialog open={Boolean(viewer)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{viewer?.node.name}</DialogTitle>
          <DialogDescription>{type || "File preview"}</DialogDescription>
        </DialogHeader>
        {viewer && (
          <div className="h-[70svh] overflow-hidden rounded-lg border bg-background">
            {type.startsWith("image/") ? (
              <img src={viewer.url} alt={viewer.node.name} className="h-full w-full object-contain" />
            ) : type.startsWith("video/") ? (
              <video src={viewer.url} controls className="h-full w-full" />
            ) : type.startsWith("audio/") ? (
              <div className="flex h-full items-center justify-center p-6">
                <audio src={viewer.url} controls className="w-full" />
              </div>
            ) : (
              <iframe title={viewer.node.name} src={viewer.url} className="h-full w-full" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({ node, onOpenChange }: { node: DriveNode | null; onOpenChange: (open: boolean) => void }) {
  const [shares, setShares] = React.useState<DriveShare[]>([])
  const [links, setLinks] = React.useState<DrivePublicLink[]>([])
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"viewer" | "editor">("viewer")
  const [password, setPassword] = React.useState("")

  const refresh = React.useCallback(async () => {
    if (!node) return
    try {
      const [shareResponse, linkResponse] = await Promise.all([
        listDriveShares(node._id),
        listDrivePublicLinks(node._id),
      ])
      setShares(shareResponse.shares)
      setLinks(linkResponse.links)
    } catch (err: any) {
      toast.error(err.message || "Failed to load sharing")
    }
  }, [node])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function addShare() {
    if (!node || !email.trim()) return
    try {
      await shareDriveNode(node._id, { email, role })
      setEmail("")
      toast.success("User shared")
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to share")
    }
  }

  async function createLink() {
    if (!node) return
    try {
      const { link } = await createDrivePublicLink(node._id, { password: password || undefined })
      setPassword("")
      await navigator.clipboard.writeText(link.shareUrl)
      toast.success("Public link copied")
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to create public link")
    }
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {node?.name}</DialogTitle>
          <DialogDescription>
            Internal editors can modify content. Public links are view-only and expire in 30 days by default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Share with organization user</Label>
            <div className="flex gap-2">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
              <Select value={role} onValueChange={(value) => setRole(value as "viewer" | "editor")}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void addShare()}>Share</Button>
            </div>
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.userId}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>
                    {share.user?.email ?? share.userId} · <span className="capitalize">{share.role}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => node && void unshareDriveNode(node._id, share.userId).then(refresh)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Public view link</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Optional password"
              />
              <Button onClick={() => void createLink()}>
                <LinkIcon className="size-4" />
                Create
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((link) => (
                <div
                  key={link._id}
                  className="group flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <CopyableText value={link.shareUrl} label="Link copied" className="min-w-0">
                    <span className="truncate">{link.shareUrl}</span>
                  </CopyableText>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => node && void revokeDrivePublicLink(node._id, link._id).then(refresh)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

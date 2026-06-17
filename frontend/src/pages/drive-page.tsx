import * as React from "react"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  AlertCircleIcon,
  ArrowDownNarrowWideIcon,
  ArrowUpNarrowWideIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  Edit3Icon,
  EyeIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon,
  FileTextIcon,
  FileUpIcon,
  FileVideoIcon,
  FilterIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  FolderUpIcon,
  HardDriveIcon,
  ImageIcon,
  InfoIcon,
  LayoutGridIcon,
  LinkIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  Users2Icon,
  XIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { CopyableText } from "@/components/copy-button"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
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
import { PageToolbar } from "@/components/page-header"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  canPreview,
  createDriveExport,
  createDriveFolder,
  createDrivePublicLink,
  emailDrivePublicLink,
  formatBytes,
  formatDriveNodeType,
  getDriveExport,
  getDriveFileUrl,
  getDriveQuota,
  listDriveNodes,
  listDrivePublicLinks,
  listDriveShares,
  moveDriveNode,
  permanentlyDeleteDriveNode,
  renameDriveNode,
  restoreDriveNode,
  revokeDrivePublicLink,
  shareDriveNode,
  suggestDriveNodeName,
  trashDriveNode,
  unshareDriveNode,
  type DriveNode,
  type DrivePublicLink,
  type DriveQuota,
  type DriveShare,
  type DriveSortDir,
  type DriveSortField,
} from "@/lib/drive"
import {
  buildDescriptorsFromEntries,
  buildDescriptorsFromFileList,
  useDriveUploads,
  type UploadTask,
} from "@/lib/drive-uploads"

type DriveView = "my" | "shared" | "trash"
type LayoutMode = "list" | "grid"

const LAYOUT_STORAGE_KEY = "drive:layout"
const SORT_STORAGE_KEY = "drive:sort"

interface DriveSortState {
  field: DriveSortField
  dir: DriveSortDir
}

const DRIVE_SORT_OPTIONS: { id: DriveSortField; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "updatedAt", label: "Last Modified" },
  { id: "size", label: "Size" },
  { id: "type", label: "Type" },
]

const DRIVE_TYPE_FILTERS: { id: string; label: string }[] = [
  { id: "folders", label: "Folders" },
  { id: "documents", label: "Documents" },
  { id: "spreadsheets", label: "Spreadsheets" },
  { id: "presentations", label: "Presentations" },
  { id: "pdfs", label: "PDFs" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "archives", label: "Archives" },
  { id: "other", label: "Other" },
]

function getInitialLayout(): LayoutMode {
  if (typeof window === "undefined") return "list"
  return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === "grid" ? "grid" : "list"
}

function getInitialSort(): DriveSortState {
  const fallback: DriveSortState = { field: "name", dir: "asc" }
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<DriveSortState>
    const field = DRIVE_SORT_OPTIONS.some((option) => option.id === parsed.field)
      ? (parsed.field as DriveSortField)
      : "name"
    const dir: DriveSortDir = parsed.dir === "desc" ? "desc" : "asc"
    return { field, dir }
  } catch {
    return fallback
  }
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

function hasFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files")
}

export default function DrivePage() {
  const [nodes, setNodes] = React.useState<DriveNode[]>([])
  const [view, setView] = React.useState<DriveView>("my")
  const [layout, setLayout] = React.useState<LayoutMode>(getInitialLayout)
  const [parent, setParent] = React.useState<DriveNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveNode[]>([])
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [sort, setSort] = React.useState<DriveSortState>(getInitialSort)
  const [typeFilters, setTypeFilters] = React.useState<Set<string>>(new Set())
  const [quota, setQuota] = React.useState<DriveQuota | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [detailsNode, setDetailsNode] = React.useState<DriveNode | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [viewer, setViewer] = React.useState<{ node: DriveNode; url: string } | null>(null)
  const [sharingNode, setSharingNode] = React.useState<DriveNode | null>(null)
  const [folderDialog, setFolderDialog] = React.useState<{ mode: "create" | "rename"; node?: DriveNode } | null>(null)
  const [moveNodeTarget, setMoveNodeTarget] = React.useState<DriveNode | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DriveNode | null>(null)

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [lastIndex, setLastIndex] = React.useState<number | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)

  const [activeNode, setActiveNode] = React.useState<DriveNode | null>(null)
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false)
  const [externalTargetId, setExternalTargetId] = React.useState<string | null>(null)
  const [preparing, setPreparing] = React.useState(false)
  const dragDepth = React.useRef(0)

  const filesInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)

  const dragEnabled = view === "my"

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  const typeFilterKey = React.useMemo(() => [...typeFilters].sort().join(","), [typeFilters])

  const loadNodes = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await listDriveNodes({
        parentId: view === "my" ? parent?._id : null,
        view,
        search: debouncedSearch,
        sort: sort.field,
        dir: sort.dir,
        types: typeFilterKey ? typeFilterKey.split(",") : undefined,
      })
      setNodes(response.nodes)
    } catch (err: any) {
      toast.error(err.message || "Failed to load Drive")
    } finally {
      setLoading(false)
    }
  }, [parent?._id, debouncedSearch, view, sort.field, sort.dir, typeFilterKey])

  React.useEffect(() => {
    void loadNodes()
  }, [loadNodes])

  React.useEffect(() => {
    let cancelled = false
    void getDriveQuota()
      .then((response) => {
        if (!cancelled) setQuota(response.quota)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setLastIndex(null)
  }, [])

  React.useEffect(() => {
    clearSelection()
  }, [view, parent?._id, debouncedSearch, typeFilterKey, clearSelection])

  // Keep the Details panel in sync with the single selected item.
  React.useEffect(() => {
    if (!detailsOpen) return
    if (selectedIds.size === 1) {
      const id = [...selectedIds][0]
      const match = nodes.find((node) => node._id === id)
      if (match) setDetailsNode(match)
    }
  }, [detailsOpen, selectedIds, nodes])

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      if (detailsOpen) {
        setDetailsOpen(false)
        return
      }
      if (selectedIds.size > 0) clearSelection()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [detailsOpen, selectedIds, clearSelection])

  const uploads = useDriveUploads(loadNodes)

  React.useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "")
      folderInputRef.current.setAttribute("directory", "")
    }
  }, [])

  function changeLayout(next: LayoutMode) {
    setLayout(next)
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, next)
  }

  function persistSort(next: DriveSortState) {
    setSort(next)
    window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next))
  }

  function changeSortField(field: DriveSortField) {
    persistSort({ field, dir: sort.dir })
  }

  function toggleSortDir() {
    persistSort({ field: sort.field, dir: sort.dir === "asc" ? "desc" : "asc" })
  }

  function toggleTypeFilter(id: string) {
    setTypeFilters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openDetails(node: DriveNode) {
    setDetailsNode(node)
    setDetailsOpen(true)
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

  // --- Selection -----------------------------------------------------------

  const anySelected = selectedIds.size > 0
  const allSelected = nodes.length > 0 && selectedIds.size === nodes.length

  function toggleSelect(id: string, index: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastIndex(index)
  }

  function selectRange(index: number) {
    const start = lastIndex == null ? index : lastIndex
    const [from, to] = start <= index ? [start, index] : [index, start]
    const ids = nodes.slice(from, to + 1).map((node) => node._id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
    setLastIndex(index)
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === nodes.length ? new Set() : new Set(nodes.map((node) => node._id))))
  }

  function selectOnly(id: string, index: number) {
    setSelectedIds(new Set([id]))
    setLastIndex(index)
  }

  function handleItemClick(event: React.MouseEvent, node: DriveNode, index: number) {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      toggleSelect(node._id, index)
      return
    }
    if (event.shiftKey) {
      event.preventDefault()
      selectRange(index)
      return
    }
    selectOnly(node._id, index)
  }

  function handleItemDoubleClick(node: DriveNode) {
    activateNode(node)
  }

  function handleContextSelect(node: DriveNode, index: number) {
    if (!selectedIds.has(node._id)) selectOnly(node._id, index)
  }

  function handleCheckboxClick(event: React.MouseEvent, node: DriveNode, index: number) {
    if (event.shiftKey) selectRange(index)
    else toggleSelect(node._id, index)
  }

  // --- Bulk actions --------------------------------------------------------

  async function runBulk(
    action: (id: string) => Promise<unknown>,
    labels: { one: string; many: (n: number) => string }
  ) {
    const ids = [...selectedIds]
    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        await action(id)
        ok += 1
      } catch {
        fail += 1
      }
    }
    if (ok) toast.success(ok === 1 ? labels.one : labels.many(ok))
    if (fail) toast.error(`${fail} item${fail === 1 ? "" : "s"} could not be processed`)
    clearSelection()
    await loadNodes()
  }

  async function downloadSelection() {
    const selected = nodes.filter((node) => selectedIds.has(node._id))
    for (const node of selected) await downloadNode(node)
  }

  const singleSelectedNode = selectedIds.size === 1 ? nodes.find((node) => selectedIds.has(node._id)) ?? null : null

  // --- Drag to move --------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    setActiveNode((event.active.data.current?.node as DriveNode) ?? null)
  }

  async function moveItems(ids: string[], destParentId: string | null) {
    let ok = 0
    let fail = 0
    let lastError = ""
    for (const id of ids) {
      try {
        await moveDriveNode(id, destParentId)
        ok += 1
      } catch (err: any) {
        fail += 1
        lastError = err?.message || lastError
      }
    }
    if (ok) toast.success(ok === 1 ? "Moved" : `${ok} items moved`)
    if (fail) toast.error(lastError || `${fail} item${fail === 1 ? "" : "s"} could not be moved`)
    clearSelection()
    await loadNodes()
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveNode(null)
    const over = event.over
    if (!over) return

    const activeId = String(event.active.id)
    const overId = String(over.id)

    let destParentId: string | null
    if (overId === "crumb:root") destParentId = null
    else if (overId.startsWith("crumb:")) destParentId = overId.slice("crumb:".length)
    else if (overId.startsWith("drop:")) destParentId = overId.slice("drop:".length)
    else return

    const currentParentId = parent?._id ?? null
    if (destParentId === currentParentId) return

    const ids = selectedIds.has(activeId) && selectedIds.size > 0 ? [...selectedIds] : [activeId]
    const filtered = ids.filter((id) => id !== destParentId)
    if (!filtered.length) return

    void moveItems(filtered, destParentId)
  }

  // --- External (OS) uploads ----------------------------------------------

  async function startUpload(entries: FileSystemEntry[], looseFiles: File[], targetParentId: string | null) {
    if (!entries.length && !looseFiles.length) return
    setPreparing(true)
    try {
      const descriptors = await buildDescriptorsFromEntries(entries, looseFiles, targetParentId)
      if (!descriptors.length) {
        toast.info("No files found to upload")
        return
      }
      uploads.enqueue(descriptors)
    } catch (err: any) {
      toast.error(err?.message || "Could not read the dropped items")
    } finally {
      setPreparing(false)
    }
  }

  function onAreaDragEnter(event: React.DragEvent) {
    if (!dragEnabled || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setIsDraggingFiles(true)
  }

  function onAreaDragOver(event: React.DragEvent) {
    if (!dragEnabled || !hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  function onAreaDragLeave(event: React.DragEvent) {
    if (!dragEnabled || !hasFiles(event)) return
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDraggingFiles(false)
      setExternalTargetId(null)
    }
  }

  function onAreaDrop(event: React.DragEvent) {
    if (!dragEnabled || !hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setIsDraggingFiles(false)
    const targetParentId = externalTargetId ?? parent?._id ?? null
    setExternalTargetId(null)

    const entries: FileSystemEntry[] = []
    const looseFiles: File[] = []
    const items = event.dataTransfer.items
    if (items && items.length) {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        if (item.kind !== "file") continue
        const entry = item.webkitGetAsEntry?.()
        if (entry) entries.push(entry)
        else {
          const file = item.getAsFile()
          if (file) looseFiles.push(file)
        }
      }
    } else {
      for (const file of Array.from(event.dataTransfer.files)) looseFiles.push(file)
    }
    void startUpload(entries, looseFiles, targetParentId)
  }

  function onFolderDragOver(event: React.DragEvent, node: DriveNode) {
    if (!dragEnabled || !hasFiles(event)) return
    event.preventDefault()
    setExternalTargetId(node._id)
  }

  function onFolderDragLeave(event: React.DragEvent, node: DriveNode) {
    if (!hasFiles(event)) return
    setExternalTargetId((prev) => (prev === node._id ? null : prev))
  }

  async function onFilesPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!files.length) return
    setPreparing(true)
    try {
      const descriptors = await buildDescriptorsFromFileList(files, parent?._id ?? null)
      uploads.enqueue(descriptors)
    } catch (err: any) {
      toast.error(err?.message || "Upload failed")
    } finally {
      setPreparing(false)
    }
  }

  const isEmpty = !loading && nodes.length === 0
  const dragCount = activeNode && selectedIds.has(activeNode._id) ? selectedIds.size : 1

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
            </>
          )}
          <DropdownMenuItem onClick={() => openDetails(node)}>
            <InfoIcon className="size-4" />
            Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {view === "trash" && (
            <DropdownMenuItem onClick={() => void restoreNode(node)}>
              <RotateCcwIcon className="size-4" />
              Restore
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant={view === "trash" ? "destructive" : undefined}
            onClick={() => (view === "trash" ? setDeleteTarget(node) : void moveToTrash(node))}
          >
            <Trash2Icon className="size-4" />
            {view === "trash" ? "Delete Forever" : "Trash"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderItemMenu(node: DriveNode, index: number, children: React.ReactNode) {
    const isMulti = selectedIds.has(node._id) && selectedIds.size > 1
    return (
      <ContextMenu
        onOpenChange={(open) => {
          if (open) handleContextSelect(node, index)
        }}
      >
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {isMulti ? (
            <>
              <ContextMenuItem onSelect={() => void downloadSelection()}>
                <DownloadIcon className="size-4" />
                Download
              </ContextMenuItem>
              <ContextMenuSeparator />
              {view === "trash" ? (
                <>
                  <ContextMenuItem
                    onSelect={() =>
                      void runBulk((id) => restoreDriveNode(id), {
                        one: "Restored",
                        many: (n) => `${n} items restored`,
                      })
                    }
                  >
                    <RotateCcwIcon className="size-4" />
                    Restore
                  </ContextMenuItem>
                  <ContextMenuItem variant="destructive" onSelect={() => setBulkDeleteOpen(true)}>
                    <Trash2Icon className="size-4" />
                    Delete Forever
                  </ContextMenuItem>
                </>
              ) : (
                <ContextMenuItem
                  onSelect={() =>
                    void runBulk((id) => trashDriveNode(id), {
                      one: "Moved to Trash",
                      many: (n) => `${n} items moved to Trash`,
                    })
                  }
                >
                  <Trash2Icon className="size-4" />
                  Trash
                </ContextMenuItem>
              )}
            </>
          ) : (
            <>
              <ContextMenuItem onSelect={() => activateNode(node)}>
                {node.type === "folder" ? <FolderIcon className="size-4" /> : <EyeIcon className="size-4" />}
                Open
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void downloadNode(node)}>
                <DownloadIcon className="size-4" />
                Download
              </ContextMenuItem>
              {view !== "trash" && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => setFolderDialog({ mode: "rename", node })}>
                    <Edit3Icon className="size-4" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => setMoveNodeTarget(node)}>
                    <FolderInputIcon className="size-4" />
                    Move
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => setSharingNode(node)}>
                    <Share2Icon className="size-4" />
                    Share
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuItem onSelect={() => openDetails(node)}>
                <InfoIcon className="size-4" />
                Details
              </ContextMenuItem>
              <ContextMenuSeparator />
              {view === "trash" && (
                <ContextMenuItem onSelect={() => void restoreNode(node)}>
                  <RotateCcwIcon className="size-4" />
                  Restore
                </ContextMenuItem>
              )}
              <ContextMenuItem
                variant={view === "trash" ? "destructive" : undefined}
                onSelect={() => (view === "trash" ? setDeleteTarget(node) : void moveToTrash(node))}
              >
                <Trash2Icon className="size-4" />
                {view === "trash" ? "Delete Forever" : "Trash"}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <TooltipProvider>
      <AppLayout>
        <SiteHeader breadcrumbs={[{ label: "Drive" }]} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <input ref={filesInputRef} type="file" multiple className="hidden" onChange={(e) => void onFilesPicked(e)} />
          <input ref={folderInputRef} type="file" multiple className="hidden" onChange={(e) => void onFilesPicked(e)} />

          <PageToolbar
            icon={HardDriveIcon}
            title="Drive"
            count={loading ? null : nodes.length}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => setFolderDialog({ mode: "create" })}>
                  <FolderPlusIcon className="size-4" />
                  New Folder
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <UploadIcon className="size-4" />
                      Upload
                      <ChevronDownIcon className="size-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => filesInputRef.current?.click()}>
                      <FileUpIcon className="size-4" />
                      Upload Files
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                      <FolderUpIcon className="size-4" />
                      Upload Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          />

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveNode(null)}
          >
            {anySelected ? (
              <div className="flex min-h-15 flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
                <Button variant="ghost" size="icon-sm" onClick={clearSelection}>
                  <XIcon className="size-4" />
                  <span className="sr-only">Clear selection</span>
                </Button>
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <div className="mx-1 h-5 w-px shrink-0 self-center bg-border" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => void downloadSelection()}>
                    <DownloadIcon className="size-4" />
                    Download
                  </Button>
                  {view !== "trash" && (
                    <>
                      {singleSelectedNode && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setSharingNode(singleSelectedNode)}>
                            <Share2Icon className="size-4" />
                            Share
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setMoveNodeTarget(singleSelectedNode)}>
                            <FolderInputIcon className="size-4" />
                            Move
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFolderDialog({ mode: "rename", node: singleSelectedNode })}
                          >
                            <Edit3Icon className="size-4" />
                            Rename
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {singleSelectedNode && (
                    <Button variant="ghost" size="sm" onClick={() => openDetails(singleSelectedNode)}>
                      <InfoIcon className="size-4" />
                      Details
                    </Button>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {view === "trash" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void runBulk((id) => restoreDriveNode(id), {
                            one: "Restored",
                            many: (n) => `${n} items restored`,
                          })
                        }
                      >
                        <RotateCcwIcon className="size-4" />
                        Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                        <Trash2Icon className="size-4" />
                        Delete Forever
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void runBulk((id) => trashDriveNode(id), {
                          one: "Moved to Trash",
                          many: (n) => `${n} items moved to Trash`,
                        })
                      }
                    >
                      <Trash2Icon className="size-4" />
                      Trash
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-15 flex-wrap items-center gap-3 border-b px-4 py-3">
                <Tabs value={view} onValueChange={(value) => changeView(value as DriveView)}>
                  <TabsList>
                    <TabsTrigger value="my">My Files</TabsTrigger>
                    <TabsTrigger value="shared">Shared with Me</TabsTrigger>
                    <TabsTrigger value="trash">Trash</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative ml-auto min-w-56 flex-1 sm:max-w-xs">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search Drive"
                    className="pl-9 pr-9"
                  />
                  {search && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setSearch("")}
                    >
                      <XIcon className="size-4" />
                      <span className="sr-only">Clear search</span>
                    </Button>
                  )}
                </div>

                <DriveFilterControl selected={typeFilters} onToggle={toggleTypeFilter} onClear={() => setTypeFilters(new Set())} />
                <DriveSortControl sort={sort} onChangeField={changeSortField} onToggleDir={toggleSortDir} />

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
            )}

            {view === "my" && (
              <div className="border-b px-4 py-2.5">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <CrumbDroppable
                        id="crumb:root"
                        disabled={!dragEnabled}
                        isCurrent={breadcrumbs.length === 0}
                        onClick={() => jumpToCrumb(-1)}
                      >
                        <HardDriveIcon className="size-3.5" />
                        Drive
                      </CrumbDroppable>
                    </BreadcrumbItem>
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1
                      return (
                        <React.Fragment key={crumb._id}>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <CrumbDroppable
                              id={`crumb:${crumb._id}`}
                              disabled={!dragEnabled || isLast}
                              isCurrent={isLast}
                              onClick={() => jumpToCrumb(index)}
                            >
                              {crumb.name}
                            </CrumbDroppable>
                          </BreadcrumbItem>
                        </React.Fragment>
                      )
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            )}

            <div className="flex min-h-0 flex-1">
              <AreaContextMenu
                enabled={view === "my"}
                onNewFolder={() => setFolderDialog({ mode: "create" })}
                onUploadFiles={() => filesInputRef.current?.click()}
                onUploadFolder={() => folderInputRef.current?.click()}
              >
                <div
                  className="relative flex min-h-0 flex-1 flex-col"
                  onDragEnter={onAreaDragEnter}
                  onDragOver={onAreaDragOver}
                  onDragLeave={onAreaDragLeave}
                  onDrop={onAreaDrop}
                >
              {loading ? (
                <DriveSkeleton layout={layout} />
              ) : isEmpty ? (
                <DriveEmptyState view={view} search={debouncedSearch} hasParent={Boolean(parent)} />
              ) : layout === "list" ? (
                <div className="flex-1 overflow-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <th className="w-10 py-2.5 pr-0 pl-4">
                          <span
                            className="inline-flex"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelectAll()
                            }}
                          >
                            <Checkbox checked={allSelected} tabIndex={-1} aria-label="Select all" />
                          </span>
                        </th>
                        <th className="px-3 py-2.5">Name</th>
                        <th className="px-5 py-2.5">Type</th>
                        <th className="px-5 py-2.5">Size</th>
                        <th className="px-5 py-2.5">Access</th>
                        <th className="px-5 py-2.5">Updated</th>
                        <th className="w-12 px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="animate-in fade-in-0 duration-300">
                      {nodes.map((node, index) => (
                        <DriveListRow
                          key={node._id}
                          node={node}
                          index={index}
                          selected={selectedIds.has(node._id)}
                          anySelected={anySelected}
                          dragEnabled={dragEnabled}
                          isExternalTarget={externalTargetId === node._id}
                          onItemClick={handleItemClick}
                          onItemDoubleClick={handleItemDoubleClick}
                          onCheckboxClick={handleCheckboxClick}
                          onFolderDragOver={onFolderDragOver}
                          onFolderDragLeave={onFolderDragLeave}
                          actions={renderActions(node)}
                          renderMenu={(children) => renderItemMenu(node, index, children)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4">
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in-0 duration-300 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {nodes.map((node, index) => (
                      <DriveGridCard
                        key={node._id}
                        node={node}
                        index={index}
                        selected={selectedIds.has(node._id)}
                        anySelected={anySelected}
                        dragEnabled={dragEnabled}
                        isExternalTarget={externalTargetId === node._id}
                        onItemClick={handleItemClick}
                        onItemDoubleClick={handleItemDoubleClick}
                        onCheckboxClick={handleCheckboxClick}
                        onFolderDragOver={onFolderDragOver}
                        onFolderDragLeave={onFolderDragLeave}
                        actions={renderActions(node)}
                        renderMenu={(children) => renderItemMenu(node, index, children)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isDraggingFiles && (
                <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <UploadCloudIcon className="size-9" />
                    <p className="text-sm font-medium">
                      {externalTargetId ? "Drop to upload into folder" : "Drop files to upload"}
                    </p>
                  </div>
                </div>
              )}
                </div>
              </AreaContextMenu>
              {detailsOpen && (
                <DriveDetailsPanel
                  node={detailsNode}
                  locationName={parent?.name ?? "Drive"}
                  onClose={() => setDetailsOpen(false)}
                />
              )}
            </div>

            <DriveStatusBar
              nodes={nodes}
              selectedCount={selectedIds.size}
              selectedBytes={nodes.reduce(
                (sum, node) => (selectedIds.has(node._id) && node.type === "file" ? sum + node.size : sum),
                0
              )}
              quota={quota}
              capped={!loading && nodes.length >= 250}
            />

            <DragOverlay dropAnimation={null}>
              {activeNode ? (
                <div className="flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm font-medium shadow-lg">
                  {dragCount > 1 ? (
                    <>
                      <FileIcon className="size-4 text-muted-foreground" />
                      {dragCount} items
                    </>
                  ) : (
                    (() => {
                      const { Icon, className } = iconForNode(activeNode)
                      return (
                        <>
                          <Icon className={cn("size-4", className)} />
                          <span className="max-w-48 truncate">{activeNode.name}</span>
                        </>
                      )
                    })()
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </AppLayout>

      <UploadQueuePanel tasks={uploads.tasks} preparing={preparing} onDismiss={uploads.dismissFinished} />

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
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        count={selectedIds.size}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={async () => {
          setBulkDeleteOpen(false)
          await runBulk((id) => permanentlyDeleteDriveNode(id), {
            one: "Deleted permanently",
            many: (n) => `${n} items deleted`,
          })
        }}
      />
    </TooltipProvider>
  )
}

interface ItemViewProps {
  node: DriveNode
  index: number
  selected: boolean
  anySelected: boolean
  dragEnabled: boolean
  isExternalTarget: boolean
  onItemClick: (event: React.MouseEvent, node: DriveNode, index: number) => void
  onItemDoubleClick: (node: DriveNode) => void
  onCheckboxClick: (event: React.MouseEvent, node: DriveNode, index: number) => void
  onFolderDragOver: (event: React.DragEvent, node: DriveNode) => void
  onFolderDragLeave: (event: React.DragEvent, node: DriveNode) => void
  actions: React.ReactNode
  renderMenu: (children: React.ReactNode) => React.ReactNode
}

function DriveListRow({
  node,
  index,
  selected,
  anySelected,
  dragEnabled,
  isExternalTarget,
  onItemClick,
  onItemDoubleClick,
  onCheckboxClick,
  onFolderDragOver,
  onFolderDragLeave,
  actions,
  renderMenu,
}: ItemViewProps) {
  const isFolder = node.type === "folder"
  const { Icon, className } = iconForNode(node)
  const drag = useDraggable({ id: node._id, data: { node }, disabled: !dragEnabled })
  const drop = useDroppable({ id: `drop:${node._id}`, data: { node }, disabled: !dragEnabled || !isFolder })

  const setRefs = (element: HTMLTableRowElement | null) => {
    drag.setNodeRef(element)
    if (isFolder) drop.setNodeRef(element)
  }

  const highlighted = (isFolder && drop.isOver) || isExternalTarget

  return renderMenu(
    <tr
      ref={setRefs}
      {...(dragEnabled ? drag.attributes : {})}
      {...(dragEnabled ? drag.listeners : {})}
      className={cn(
        "group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/30",
        selected && "bg-primary/5",
        highlighted && "bg-primary/10 outline outline-2 -outline-offset-2 outline-primary/50",
        drag.isDragging && "opacity-40"
      )}
      onClick={(event) => onItemClick(event, node, index)}
      onDoubleClick={() => onItemDoubleClick(node)}
      onContextMenu={(event) => event.stopPropagation()}
      onDragOver={isFolder ? (event) => onFolderDragOver(event, node) : undefined}
      onDragLeave={isFolder ? (event) => onFolderDragLeave(event, node) : undefined}
    >
      <td className="w-10 py-3 pr-0 pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
        <span
          className="inline-flex"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onCheckboxClick(e, node, index)
          }}
        >
          <Checkbox
            checked={selected}
            tabIndex={-1}
            aria-label={`Select ${node.name}`}
            className={cn("transition-opacity", !selected && !anySelected && "opacity-0 group-hover:opacity-100")}
          />
        </span>
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="flex items-center gap-2.5 font-medium">
          <Icon className={cn("size-4 shrink-0", className)} />
          <span className="truncate">{node.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 align-middle text-muted-foreground">
        {formatDriveNodeType(node)}
      </td>
      <td className="px-5 py-3 align-middle tabular-nums text-muted-foreground">
        {node.type === "folder" ? "-" : formatBytes(node.size)}
      </td>
      <td className="px-5 py-3 align-middle capitalize text-muted-foreground">{node.role ?? "viewer"}</td>
      <td className="px-5 py-3 align-middle text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{formatRelativeTime(node.updatedAt)}</span>
          </TooltipTrigger>
          <TooltipContent>{formatDateTime(node.updatedAt)}</TooltipContent>
        </Tooltip>
      </td>
      <td
        className="px-3 py-3 align-middle"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
          {actions}
        </div>
      </td>
    </tr>
  )
}

function DriveGridCard({
  node,
  index,
  selected,
  anySelected,
  dragEnabled,
  isExternalTarget,
  onItemClick,
  onItemDoubleClick,
  onCheckboxClick,
  onFolderDragOver,
  onFolderDragLeave,
  actions,
  renderMenu,
}: ItemViewProps) {
  const isFolder = node.type === "folder"
  const { Icon, className } = iconForNode(node)
  const drag = useDraggable({ id: node._id, data: { node }, disabled: !dragEnabled })
  const drop = useDroppable({ id: `drop:${node._id}`, data: { node }, disabled: !dragEnabled || !isFolder })

  const setRefs = (element: HTMLDivElement | null) => {
    drag.setNodeRef(element)
    if (isFolder) drop.setNodeRef(element)
  }

  const highlighted = (isFolder && drop.isOver) || isExternalTarget
  const metadata = isFolder ? "Folder" : `${formatDriveNodeType(node)} · ${formatBytes(node.size)}`

  return renderMenu(
    <div
      ref={setRefs}
      {...(dragEnabled ? drag.attributes : {})}
      {...(dragEnabled ? drag.listeners : {})}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30",
        selected && "border-primary/50 bg-primary/5",
        highlighted && "border-primary bg-primary/10 outline outline-2 -outline-offset-2 outline-primary/50",
        drag.isDragging && "opacity-40"
      )}
      onClick={(event) => onItemClick(event, node, index)}
      onDoubleClick={() => onItemDoubleClick(node)}
      onContextMenu={(event) => event.stopPropagation()}
      onDragOver={isFolder ? (event) => onFolderDragOver(event, node) : undefined}
      onDragLeave={isFolder ? (event) => onFolderDragLeave(event, node) : undefined}
    >
      <span
        className={cn(
          "absolute top-2 left-2 z-10 inline-flex transition-opacity",
          !selected && !anySelected && "opacity-0 group-hover:opacity-100"
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onCheckboxClick(e, node, index)
        }}
      >
        <Checkbox checked={selected} tabIndex={-1} aria-label={`Select ${node.name}`} className="bg-background" />
      </span>
      <div
        className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
      <div className="flex h-20 items-center justify-center rounded-lg bg-muted/40">
        <Icon className={cn("size-9", className)} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={node.name}>
          {node.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {metadata}
          {" · "}
          {formatRelativeTime(node.updatedAt)}
        </p>
      </div>
    </div>
  )
}

function DriveSortControl({
  sort,
  onChangeField,
  onToggleDir,
}: {
  sort: DriveSortState
  onChangeField: (field: DriveSortField) => void
  onToggleDir: () => void
}) {
  const activeLabel = DRIVE_SORT_OPTIONS.find((option) => option.id === sort.field)?.label ?? "Name"
  const DirIcon = sort.dir === "asc" ? ArrowDownNarrowWideIcon : ArrowUpNarrowWideIcon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <DirIcon className="size-4" />
          {activeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Sort By</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort.field} onValueChange={(value) => onChangeField(value as DriveSortField)}>
          {DRIVE_SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={(event) => event.preventDefault()} onSelect={(event) => { event.preventDefault(); onToggleDir() }}>
          <DirIcon className="size-4" />
          {sort.dir === "asc" ? "Ascending" : "Descending"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DriveFilterControl({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const count = selected.size
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <FilterIcon className="size-4" />
          Filters
          {count > 0 && (
            <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">File Type</span>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-1.5 py-0.5 text-xs" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
        <div className="mt-1 space-y-0.5">
          {DRIVE_TYPE_FILTERS.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onToggle(type.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <Checkbox checked={selected.has(type.id)} tabIndex={-1} className="pointer-events-none" />
              {type.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AreaContextMenu({
  enabled,
  onNewFolder,
  onUploadFiles,
  onUploadFolder,
  children,
}: {
  enabled: boolean
  onNewFolder: () => void
  onUploadFiles: () => void
  onUploadFolder: () => void
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onNewFolder}>
          <FolderPlusIcon className="size-4" />
          New Folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onUploadFiles}>
          <FileUpIcon className="size-4" />
          Upload Files
        </ContextMenuItem>
        <ContextMenuItem onSelect={onUploadFolder}>
          <FolderUpIcon className="size-4" />
          Upload Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function DriveDetailRow({
  label,
  value,
  capitalize,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("break-words text-foreground", capitalize && "capitalize")}>{value}</dd>
    </div>
  )
}

function DriveDetailsPanel({
  node,
  locationName,
  onClose,
}: {
  node: DriveNode | null
  locationName: string
  onClose: () => void
}) {
  const { Icon, className } = node ? iconForNode(node) : { Icon: FileIcon, className: "text-muted-foreground" }
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-card animate-in slide-in-from-right-2 fade-in-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Details</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <XIcon className="size-4" />
          <span className="sr-only">Close details</span>
        </Button>
      </div>
      {node ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
              <Icon className={cn("size-5", className)} />
            </div>
            <p className="min-w-0 truncate text-sm font-medium" title={node.name}>
              {node.name}
            </p>
          </div>
          <Separator className="my-4" />
          <dl className="space-y-3.5 text-sm">
            <DriveDetailRow label="Type" value={formatDriveNodeType(node)} />
            <DriveDetailRow label="Size" value={node.type === "folder" ? "—" : formatBytes(node.size)} />
            <DriveDetailRow label="Location" value={locationName} />
            <DriveDetailRow label="Modified" value={formatDateTime(node.updatedAt)} />
            <DriveDetailRow label="Created" value={formatDateTime(node.createdAt)} />
            <DriveDetailRow label="Access" value={node.role ?? "viewer"} capitalize />
          </dl>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select an item to see its details.
        </div>
      )}
    </aside>
  )
}

function DriveStatusBar({
  nodes,
  selectedCount,
  selectedBytes,
  quota,
  capped,
}: {
  nodes: DriveNode[]
  selectedCount: number
  selectedBytes: number
  quota: DriveQuota | null
  capped: boolean
}) {
  const folderCount = nodes.filter((node) => node.type === "folder").length
  const fileCount = nodes.length - folderCount
  const totalBytes = nodes.reduce((sum, node) => (node.type === "file" ? sum + node.size : sum), 0)
  const left =
    selectedCount > 0
      ? `${selectedCount} selected · ${formatBytes(selectedBytes)}`
      : `${folderCount} ${folderCount === 1 ? "folder" : "folders"}, ${fileCount} ${
          fileCount === 1 ? "file" : "files"
        } · ${formatBytes(totalBytes)}`
  const usage = quota
    ? `${formatBytes(quota.usedBytes + quota.reservedBytes)} of ${formatBytes(quota.limitBytes)} used`
    : null
  return (
    <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>{left}</span>
        {capped && <span className="text-amber-600 dark:text-amber-500">Showing first 250</span>}
      </div>
      {usage && <span className="shrink-0 tabular-nums">{usage}</span>}
    </div>
  )
}

function CrumbDroppable({
  id,
  disabled,
  isCurrent,
  onClick,
  children,
}: {
  id: string
  disabled: boolean
  isCurrent: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const drop = useDroppable({ id, disabled })
  return (
    <button
      ref={drop.setNodeRef}
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors",
        isCurrent ? "font-normal text-foreground" : "text-muted-foreground hover:text-foreground",
        drop.isOver && "bg-primary/10 text-primary outline outline-2 -outline-offset-2 outline-primary/50"
      )}
    >
      {children}
    </button>
  )
}

function UploadQueuePanel({
  tasks,
  preparing,
  onDismiss,
}: {
  tasks: UploadTask[]
  preparing: boolean
  onDismiss: () => void
}) {
  const [collapsed, setCollapsed] = React.useState(false)

  const total = tasks.length
  const done = tasks.filter((task) => task.status === "done").length
  const failed = tasks.filter((task) => task.status === "error").length
  const active = tasks.some((task) => task.status === "pending" || task.status === "uploading")
  const progress = total
    ? Math.round(
        tasks.reduce((sum, task) => {
          if (task.status === "done") return sum + 100
          if (task.status === "uploading") return sum + task.progress
          return sum
        }, 0) / total
      )
    : 0

  React.useEffect(() => {
    if (!total || active || failed > 0) return
    const timeout = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timeout)
  }, [total, active, failed, onDismiss])

  if (!total && !preparing) return null

  const headerLabel = preparing
    ? "Preparing upload..."
    : active
      ? `Uploading ${Math.min(done + 1, total)} of ${total}`
      : failed > 0
        ? `Uploaded ${done}, ${failed} failed`
        : `Uploaded ${done} ${done === 1 ? "file" : "files"}`

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-xl border bg-card shadow-lg animate-in slide-in-from-bottom-2 fade-in-0">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {active || preparing ? (
            <Spinner className="size-4 shrink-0 text-primary" />
          ) : failed > 0 ? (
            <AlertCircleIcon className="size-4 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2Icon className="size-4 shrink-0 text-success" />
          )}
          <span className="truncate text-sm font-medium">{headerLabel}</span>
          {active && !preparing && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progress}%</span>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
            <span className="sr-only">{collapsed ? "Expand" : "Collapse"}</span>
          </Button>
          {!active && !preparing && (
            <Button variant="ghost" size="icon-sm" onClick={onDismiss}>
              <XIcon className="size-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-72 overflow-auto p-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2",
                task.status === "uploading" && "bg-muted/30"
              )}
            >
              <div className="shrink-0">
                {task.status === "done" ? (
                  <CheckCircle2Icon className="size-4 text-success" />
                ) : task.status === "error" ? (
                  <AlertCircleIcon className="size-4 text-destructive" />
                ) : task.status === "uploading" ? (
                  <FileUpIcon className="size-4 text-primary" />
                ) : (
                  <FileIcon className="size-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium" title={task.name}>
                    {task.name}
                  </span>
                  <UploadTaskStatus task={task} />
                </div>
                {task.status === "uploading" && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
                {task.status === "error" && (
                  <p className="truncate text-[11px] text-destructive">{task.error || "Upload failed"}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadTaskStatus({ task }: { task: UploadTask }) {
  if (task.status === "uploading") {
    return <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{task.progress}%</span>
  }
  if (task.status === "pending") {
    return <span className="shrink-0 text-[11px] text-muted-foreground">Queued</span>
  }
  if (task.status === "done") {
    return <span className="shrink-0 text-[11px] text-success">Done</span>
  }
  return <span className="shrink-0 text-[11px] text-destructive">Failed</span>
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
          <Skeleton className="size-8 justify-self-end rounded-lg" />
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
  let title = "This Folder Is Empty"
  let description = "Upload a file or create a folder to get started."

  if (search) {
    Icon = SearchIcon
    title = "No Matches Found"
    description = "Try a different file or folder name."
  } else if (view === "shared") {
    Icon = Users2Icon
    title = "Nothing Shared with You"
    description = "Files and folders shared by your team will appear here."
  } else if (view === "trash") {
    Icon = Trash2Icon
    title = "Trash Is Empty"
    description = "Items you delete will rest here before being removed permanently."
  } else if (!hasParent) {
    Icon = HardDriveIcon
    title = "Your Drive Is Empty"
    description = "Drag files here, or use the Upload button to get started."
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
  const [generating, setGenerating] = React.useState(false)

  React.useEffect(() => {
    if (state) setName(state.mode === "rename" ? state.node?.name ?? "" : "")
  }, [state])

  const isRename = state?.mode === "rename"
  const canSuggest = isRename && state?.node?.type === "file"

  async function generateName() {
    if (!state?.node) return
    setGenerating(true)
    try {
      const { name: suggested } = await suggestDriveNodeName(state.node._id)
      if (suggested) setName(suggested)
      else toast.error("Could not generate a name")
    } catch (err: any) {
      toast.error(err.message || "Could not generate a name")
    } finally {
      setGenerating(false)
    }
  }

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
          <DialogTitle>{isRename ? "Rename" : "New Folder"}</DialogTitle>
          <DialogDescription>
            {isRename ? "Enter a new name for this item." : "Give your folder a name."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="drive-folder-name">Name</Label>
          <div className="flex gap-2">
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
              className="flex-1"
            />
            {canSuggest && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void generateName()}
                disabled={generating || saving}
                title="Generate a name from the file's contents with AI"
              >
                {generating ? <Spinner data-icon="inline-start" /> : <SparklesIcon className="size-4" />}
                AI
              </Button>
            )}
          </div>
          {canSuggest && (
            <p className="text-xs text-muted-foreground">
              Use AI to suggest a name based on the file&apos;s contents.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || generating}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || generating || !name.trim()}>
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
            Paste the destination folder ID, or leave it empty to move to the Drive root. Tip: you can also drag items
            onto a folder.
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
          <DialogTitle>Delete Forever</DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-medium text-foreground">{node?.name}</span>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={deleting}>
            {deleting && <Spinner data-icon="inline-start" />}
            Delete Forever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkDeleteDialog({
  open,
  count,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  count: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}) {
  const [deleting, setDeleting] = React.useState(false)

  async function submit() {
    setDeleting(true)
    try {
      await onConfirm()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete Forever</DialogTitle>
          <DialogDescription>
            Permanently delete <span className="font-medium text-foreground">{count}</span>{" "}
            {count === 1 ? "item" : "items"}? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={deleting}>
            {deleting && <Spinner data-icon="inline-start" />}
            Delete Forever
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
  const [emailingLinkId, setEmailingLinkId] = React.useState<string | null>(null)
  const [linkEmail, setLinkEmail] = React.useState("")
  const [sendingEmail, setSendingEmail] = React.useState(false)

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

  async function sendLinkEmail(linkId: string) {
    if (!node || !linkEmail.trim()) return
    setSendingEmail(true)
    try {
      await emailDrivePublicLink(node._id, linkId, linkEmail.trim())
      toast.success("Share email sent")
      setEmailingLinkId(null)
      setLinkEmail("")
    } catch (err: any) {
      toast.error(err.message || "Failed to send share email")
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">Share {node?.name}</DialogTitle>
          <DialogDescription className="max-w-xl">
            Internal editors can modify content. Public links are view-only and expire in 30 days by default.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <div>
              <h3 className="font-medium">Invite a teammate</h3>
              <p className="mt-1 text-sm text-muted-foreground">Give an organization user access to this item.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
              />
              <Select value={role} onValueChange={(value) => setRole(value as "viewer" | "editor")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void addShare()} className="w-full sm:w-auto">
                Share
              </Button>
            </div>
            <div className="space-y-2">
              {shares.map((share) => (
                <div
                  key={share.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
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
          </section>
          <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <div>
              <h3 className="font-medium">Public view link</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create a view-only link. Add a password if needed.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="drive-link-password" className="sr-only">
                  Optional password
                </Label>
                <Input
                  id="drive-link-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Optional password"
                />
              </div>
              <Button onClick={() => void createLink()} className="w-full sm:w-auto">
                <LinkIcon className="size-4" />
                Create
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link._id} className="space-y-3 rounded-lg border bg-background/70 p-3 text-sm">
                  <div className="group grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <CopyableText value={link.shareUrl} label="Link copied" className="min-w-0 rounded-md">
                      <span className="truncate">{link.shareUrl}</span>
                    </CopyableText>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEmailingLinkId(emailingLinkId === link._id ? null : link._id)
                          setLinkEmail("")
                        }}
                      >
                        <MailIcon className="size-4" />
                        Email
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => node && void revokeDrivePublicLink(node._id, link._id).then(refresh)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                  {emailingLinkId === link._id && (
                    <div className="grid gap-2 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        type="email"
                        value={linkEmail}
                        onChange={(event) => setLinkEmail(event.target.value)}
                        placeholder="recipient@example.com"
                        autoFocus
                      />
                      <Button
                        onClick={() => void sendLinkEmail(link._id)}
                        disabled={sendingEmail || !linkEmail.trim()}
                        className="w-full sm:w-auto"
                      >
                        {sendingEmail ? <Spinner className="size-4" /> : <MailIcon className="size-4" />}
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <DialogFooter showCloseButton className="pt-1" />
      </DialogContent>
    </Dialog>
  )
}
